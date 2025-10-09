from flask import Blueprint, render_template, jsonify, request, send_file, session, current_app
import random
import string
import serial
from conexion import conectar, obtener_ip_agente
import datetime
import pdfkit
import io
import os
import threading
import requests  # Para comunicación con el agente local
from utils import login_required, solo_admin_required
from decimal import Decimal
import traceback

bp = Blueprint('facturacion', __name__)

# Configuración del agente de impresión
BASE_URL = "https://pruebasistema.pythonanywhere.com"
TOKEN_AGENTE = "november"
ncf_lock = threading.Lock()
ncf_current_date = None
ncf_sequence_counter = 0

def guardar_factura_pendiente(factura_id, contenido):
    """Guarda una factura pendiente de impresión en la base de datos"""
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO facturas_pendientes_impresion (factura_id, contenido)
            VALUES (%s, %s)
        """, (factura_id, contenido))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error guardando factura pendiente: {str(e)}")
        return False
    finally:
        cursor.close()
        conn.close()

def obtener_facturas_pendientes():
    """Obtiene las facturas pendientes de impresión"""
    conn = conectar()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, factura_id, contenido
            FROM facturas_pendientes_impresion
            WHERE impresa = FALSE AND intentos < 3
            ORDER BY fecha_creacion ASC
            LIMIT 10
        """)
        return cursor.fetchall()
    except Exception as e:
        print(f"Error obteniendo facturas pendientes: {str(e)}")
        return []
    finally:
        cursor.close()
        conn.close()

def marcar_factura_impresa(factura_pendiente_id, exito=True, error=None):
    """Marca una factura como impresa o con error"""
    conn = conectar()
    cursor = conn.cursor()
    try:
        if exito:
            cursor.execute("""
                UPDATE facturas_pendientes_impresion
                SET impresa = TRUE, fecha_impresion = NOW()
                WHERE id = %s
            """, (factura_pendiente_id,))
        else:
            cursor.execute("""
                UPDATE facturas_pendientes_impresion
                SET intentos = intentos + 1, error = %s
                WHERE id = %s
            """, (str(error)[:255], factura_pendiente_id))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"Error actualizando estado de factura: {str(e)}")
        return False
    finally:
        cursor.close()
        conn.close()

def generar_contenido_ticket(factura_id):
    """Genera el contenido del ticket para una factura (sin imprimir)."""
    try:
        # Obtener datos de la factura
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT f.*, 
                   COALESCE(c.nombre, p.nombre) AS persona_nombre,
                   COALESCE(c.cedula, p.rnc_cedula) AS persona_doc,
                   f.tipo
            FROM facturas f
            LEFT JOIN clientes c ON f.cliente_id = c.id AND f.tipo = 'venta'
            LEFT JOIN proveedores p ON f.cliente_id = p.id AND f.tipo = 'compra'
            WHERE f.id = %s
        """, (factura_id,))
        factura = cursor.fetchone()

        if not factura:
            return None

        cursor.execute("""
            SELECT p.nombre, df.cantidad, df.precio, p.impuesto
            FROM detalle_factura df
            JOIN productos p ON df.producto_id = p.id
            WHERE df.factura_id = %s
        """, (factura_id,))
        detalles = cursor.fetchall()

    except Exception as e:
        print(f"Error BD al generar contenido ticket: {str(e)}")
        return None
    finally:
        cursor.close()
        conn.close()

    config_empresa = obtener_configuracion_empresa()
    if not config_empresa:
        return None

    lines = []
    # Cabecera con asteriscos
    lines.append(f"** {config_empresa.get('nombre','MI EMPRESA SRL')} **")
    lines.append(f"RNC: {config_empresa.get('rnc','')}")
    lines.append(f"Tel: {config_empresa.get('telefono','')}")
    lines.append(config_empresa.get('direccion',''))
    lines.append("-" * 40)

    es_compra = factura.get('tipo') == 'compra'

    if es_compra:
        lines.append("COMPRA A PROVEEDOR")
        lines.append(f"DOCUMENTO: {factura.get('ncf','')}")
        lines.append(f"FECHA: {factura['fecha_creacion'].strftime('%d/%m/%Y %H:%M:%S')}")
        lines.append(f"PROVEEDOR: {factura.get('persona_nombre','')}")
        lines.append(f"RNC: {factura.get('persona_doc','')}")
    else:
        lines.append("FACTURA DE VENTA")
        lines.append(f"FACTURA: {factura.get('ncf','')}")
        lines.append(f"FECHA: {factura['fecha_creacion'].strftime('%d/%m/%Y %H:%M:%S')}")
        lines.append(f"CLIENTE: {factura.get('persona_nombre','')}")
        lines.append(f"DOC: {factura.get('persona_doc','')}")

    lines.append("-" * 40)
    lines.append(f"{'PRODUCTO':<18} {'CANT':>4} {'ITBIS':>6}")
    lines.append("-" * 40)
    
    # Inicializar totales
    subtotal_total = 0
    itbis_total_calculado = 0
    
    for item in detalles:
        nombre = (item.get('nombre') or "").strip()
        cantidad = item.get('cantidad') or 0
        precio = float(item.get('precio') or 0.0)
        tasa_impuesto = float(item.get('impuesto') or 0.0)
        
        # Calcular el precio total de la línea
        precio_total_linea = precio * cantidad
        
        # Calcular el precio base (sin impuesto) y el ITBIS
        if tasa_impuesto > 0:
            precio_base = precio_total_linea / (1 + (tasa_impuesto / 100))
            itbis_linea = precio_base * (tasa_impuesto / 100)
        else:
            precio_base = precio_total_linea
            itbis_linea = 0.0
        
        # Acumular subtotal e ITBIS
        subtotal_total += precio_base
        itbis_total_calculado += itbis_linea
        
        # Limitar la longitud del nombre a 18 caracteres
        nombre = nombre[:18]
        
        # Formatear línea con solo nombre, cantidad e ITBIS
        lines.append(f"{nombre:<18} {cantidad:>4} {itbis_linea:>6.2f}")

    lines.append("-" * 40)
    lines.append(f"SUBTOTAL:{subtotal_total:>10.2f}")
    lines.append(f"ITBIS:{itbis_total_calculado:>13.2f}")
    total = subtotal_total + itbis_total_calculado
    lines.append(f"TOTAL:{total:>14.2f}")
    
    # Mostrar devuelta si el pago fue en efectivo
    if factura.get('metodo_pago', '').upper() == 'EFECTIVO' and factura.get('monto_recibido'):
        monto_recibido = float(factura.get('monto_recibido', 0))
        devuelta = monto_recibido - total
        lines.append(f"EFECTIVO:{monto_recibido:>13.2f}")
        lines.append(f"DEVUELTA:{devuelta:>13.2f}")
    
    lines.append("-" * 40)
    lines.append(f"FORMA DE PAGO: {str(factura.get('metodo_pago','')).upper()}")
    
    # Obtener el nombre del cajero desde la sesión
    cajero_nombre = session.get('nombre_completo', 'Sistema')
    lines.append(f"CAJERO: {cajero_nombre}")
    
    lines.append("-" * 40)

    if es_compra:
        lines.append("COMPRA REGISTRADA EXITOSAMENTE")
        lines.append("Stock actualizado")
    else:
        lines.append("GRACIAS POR SU COMPRA")
        lines.append(config_empresa.get('mensaje_legal', ''))

    lines.append("Generado: " + datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S"))

    return "\n".join(lines)

def insertar_ventas_desde_facturas(cursor, producto_id, cantidad, cliente_id, metodo_pago):
    """
    Inserta registros en la tabla 'ventas' basados en las facturas pagadas.
    Usa el precio_venta actual de la tabla productos.
    """
    cajero = session.get('nombre_completo')   # Usuario que realiza la venta
    estado = 'completada'

    try:
        query = """
            INSERT INTO ventas (
                producto_id, 
                cantidad, 
                precio_unitario, 
                fecha,
                usuario_id,
                cliente_id, 
                metodo_pago, 
                estado
            )
            SELECT 
                p.id,               -- producto_id
                %s,                 -- cantidad
                p.precio_venta,     -- precio_unitario desde productos
                NOW(),              -- fecha actual
                %s,                 -- usuario_id (cajero)
                %s,                 -- cliente_id
                %s,                 -- metodo_pago
                %s                  -- estado
            FROM productos p
            WHERE p.id = %s
        """

        valores = (cantidad, cajero, cliente_id, metodo_pago, estado, producto_id)
        cursor.execute(query, valores)
        return True
    except Exception as e:
        print(f"Error insertando ventas: {str(e)}")
        return False

def obtener_configuracion_empresa():
    """Obtiene la configuración de la empresa desde la base de datos"""
    conn = conectar()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM empresa LIMIT 1")
        empresa_data = cursor.fetchone()
        
        if empresa_data:
            return {
                'nombre': empresa_data['nombre'],
                'rnc': empresa_data['rnc'],
                'telefono': empresa_data['telefono'],
                'direccion': empresa_data['direccion'],
                'mensaje_legal': empresa_data['mensaje_legal'],
                'logo_path': empresa_data['logo_path'],
                'color_principal': empresa_data['color_principal']
            }
        else:
            return {
                'nombre': "MI EMPRESA SRL",
                'rnc': "1-23-45678-9",
                'telefono': "(809) 555-1212",
                'direccion': "Av. Principal #123, Santo Domingo",
                'mensaje_legal': "Art. 349: Conserve este ticket",
                'logo_path': 'static/img/logo.png',
                'color_principal': '#3498db'
            }
    except Exception as e:
        print(f"Error obteniendo configuración empresa: {str(e)}")
        return None
    finally:
        cursor.close()
        conn.close()

def obtener_impresora_ticket():
    """Obtiene la impresora activa desde la base de datos"""
    conn = conectar()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT nombre, tipo, modelo, ip, ubicacion, vendor_id, product_id
            FROM printers 
            WHERE estado = 'Conectado' AND activa = 1
            LIMIT 1
        """)
        impresora = cursor.fetchone()
        return impresora
    except Exception as e:
        print(f"Error al obtener impresora: {str(e)}")
        return None
    finally:
        cursor.close()
        conn.close()

def imprimir_ticket(factura_id):
    """Envía el ticket al agente local para impresión"""
    try:
        # Obtener datos de la factura
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT f.*, 
                   COALESCE(c.nombre, p.nombre) AS persona_nombre,
                   COALESCE(c.cedula, p.rnc_cedula) AS persona_doc,
                   f.tipo
            FROM facturas f
            LEFT JOIN clientes c ON f.cliente_id = c.id AND f.tipo = 'venta'
            LEFT JOIN proveedores p ON f.cliente_id = p.id AND f.tipo = 'compra'
            WHERE f.id = %s
        """, (factura_id,))
        factura = cursor.fetchone()
        
        if not factura:
            return {'success': False, 'error': 'Factura no encontrada'}
        
        cursor.execute("""
            SELECT p.nombre, df.cantidad, df.precio, df.itbis
            FROM detalle_factura df
            JOIN productos p ON df.producto_id = p.id
            WHERE df.factura_id = %s
        """, (factura_id,))
        detalles = cursor.fetchall()
        
    except Exception as e:
        return {'success': False, 'error': f"Error BD: {str(e)}"}
    finally:
        cursor.close()
        conn.close()

    config_empresa = obtener_configuracion_empresa()
    impresora = obtener_impresora_ticket()
    
    if not impresora:
        return {'success': False, 'error': 'No hay impresora activa configurada'}

    # Construir contenido del ticket
    ticket_lines = []
    ticket_lines.append(config_empresa['nombre'])
    ticket_lines.append(f"RNC: {config_empresa['rnc']}")
    ticket_lines.append(f"Tel: {config_empresa['telefono']}")
    ticket_lines.append(config_empresa['direccion'])
    ticket_lines.append("-" * 40)
    
    es_compra = factura['tipo'] == 'compra'
    
    if es_compra:
        ticket_lines.append("** COMPRA A PROVEEDOR **".center(40))
        ticket_lines.append(f"DOCUMENTO: {factura['ncf']}")
        ticket_lines.append(f"FECHA: {factura['fecha_creacion'].strftime('%d/%m/%Y %H:%M:%S')}")
        ticket_lines.append(f"PROVEEDOR: {factura['persona_nombre']}")
        ticket_lines.append(f"RNC: {factura['persona_doc']}")
    else:
        ticket_lines.append("** FACTURA DE VENTA **".center(40))
        ticket_lines.append(f"FACTURA: {factura['ncf']}")
        ticket_lines.append(f"FECHA: {factura['fecha_creacion'].strftime('%d/%m/%Y %H:%M:%S')}")
        ticket_lines.append(f"CLIENTE: {factura['persona_nombre']}")
        ticket_lines.append(f"DOC: {factura['persona_doc']}")
    
    ticket_lines.append("-" * 40)
    ticket_lines.append("PRODUCTO                CANT   PRECIO   TOTAL")
    ticket_lines.append("-" * 40)
    
    for item in detalles:
        nombre = item['nombre'][:22].ljust(22)
        cantidad = str(item['cantidad']).rjust(3)
        precio = f"{item['precio']:.2f}".rjust(8)
        total_item = item['cantidad'] * item['precio']
        total = f"{total_item:.2f}".rjust(8)
        ticket_lines.append(f"{nombre} {cantidad}   {precio} {total}")
        if item['itbis']:
            ticket_lines.append("  (ITBIS incluido)")
    
    ticket_lines.append("-" * 40)
    subtotal = factura['total'] - factura['itbis_total']
    ticket_lines.append(f"SUBTOTAL: {subtotal:.2f}".rjust(45))
    ticket_lines.append(f"ITBIS: {factura['itbis_total']:.2f}".rjust(40))
    ticket_lines.append(f"TOTAL: {factura['total']:.2f}".rjust(40))
    
    # Mostrar devuelta si el pago es en efectivo
    if factura['metodo_pago'].upper() == 'EFECTIVO' and factura.get('monto_recibido'):
        monto_recibido = float(factura.get('monto_recibido', 0))
        devuelta = monto_recibido - factura['total']
        ticket_lines.append(f"EFECTIVO: {monto_recibido:.2f}".rjust(40))
        ticket_lines.append(f"DEVUELTA: {devuelta:.2f}".rjust(40))
    
    ticket_lines.append("-" * 40)
    ticket_lines.append(f"FORMA DE PAGO: {factura['metodo_pago'].upper()}")
    ticket_lines.append("-" * 40)
    
    if es_compra:
        ticket_lines.append("¡COMPRA REGISTRADA EXITOSAMENTE!")
        ticket_lines.append("Stock actualizado")
    else:
        ticket_lines.append("¡GRACIAS POR SU COMPRA!")
        ticket_lines.append(config_empresa['mensaje_legal'])
        
    ticket_lines.append(datetime.datetime.now().strftime("Impreso: %d/%m/%Y %H:%M:%S"))
    
    ticket_text = "\n".join(ticket_lines)
    
    # Enviar al agente local
    headers = {'X-Api-Token': TOKEN_AGENTE}
    data = {
        'text': ticket_text,
        'printer': {
            'name': impresora['nombre'],
            'type': impresora['tipo'],
            'ip': impresora['ip']
        }
    }
    
    try:
        # Obtener la IP del agente (deberías tener esta información configurada)
        agente_ip = obtener_ip_agente()  # Necesitas implementar esta función
        
        if not agente_ip:
            return {'success': False, 'error': 'No hay agente de impresión configurado'}
        
        response = requests.post(f"http://{agente_ip}:5001/print", json=data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            resp_json = response.json()
            if resp_json.get('success'):
                return {'success': True}
            else:
                error = resp_json.get('error', 'Error desconocido en el agente')
                return {'success': False, 'error': f"Agente: {error}"}
        else:
            return {'success': False, 'error': f"Error HTTP {response.status_code}: {response.text}"}
    
    except requests.exceptions.RequestException as e:
        return {'success': False, 'error': f"Error de conexión con el agente: {str(e)}"}
    except Exception as e:
        return {'success': False, 'error': f"Error general: {str(e)}"}   

def cliente_tiene_rnc(cliente_id):
    """Verifica si un cliente tiene RNC válido registrado"""
    conn = conectar()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT rnc FROM clientes WHERE id = %s", (cliente_id,))
        cliente = cursor.fetchone()
        if cliente and cliente.get('rnc'):
            # Verificar que el RNC no esté vacío ni sea nulo
            rnc = cliente['rnc'].strip()
            return rnc != '' and rnc.lower() != 'null' and rnc != '0'
        return False
    except Exception as e:
        print(f"Error al verificar RNC: {str(e)}")
        return False
    finally:
        cursor.close()
        conn.close()

def generar_ncf(tipo_ncf="B02"):
    """Genera un NCF válido según normativa DGII con secuencia incremental diaria"""
    global ncf_current_date, ncf_sequence_counter
    
    fecha_actual = datetime.datetime.now().strftime("%y%m%d")
    
    with ncf_lock:
        # Reiniciar contador si es un nuevo día
        if ncf_current_date != fecha_actual:
            ncf_current_date = fecha_actual
            ncf_sequence_counter = 0
        
        # Incrementar contador y formatear a 10 dígitos (normativa actual)
        ncf_sequence_counter += 1
        if ncf_sequence_counter > 9999999999:
            raise OverflowError("Límite diario de comprobantes excedido (9,999,999,999)")
        
        secuencia = f"{ncf_sequence_counter:010d}"
    
    return f"{tipo_ncf}{fecha_actual}{secuencia}"

def procesar_pago_verifone(monto):
    """Procesa el pago a través del dispositivo Verifone"""
    try:
        puerto = serial.Serial('/dev/ttyUSB0', baudrate=9600, timeout=15)
        comando = f"PAGAR:{monto:.2f}\n"
        puerto.write(comando.encode())
        
        respuesta = puerto.readline().decode(errors='ignore').strip()
        puerto.close()

        aprobada = respuesta.upper() == "APROBADO"
        return {
            'success': aprobada,
            'mensaje': respuesta or "Sin respuesta del equipo",
            'codigo_autorizacion': ''.join(random.choices(string.digits, k=6)) if aprobada else ""
        }
    except Exception as e:
        return {'success': False, 'mensaje': f"Error de conexión: {e}"}

def registrar_movimiento_inventario(cursor, producto_id, cantidad, factura_id):
    """
    Registra un movimiento de entrada en inventario relacionado con una compra
    
    Args:
        cursor: Cursor de base de datos activo
        producto_id: ID del producto afectado
        cantidad: Cantidad ingresada al inventario
        factura_id: ID de la factura relacionada
    """
    try:
        motivo = f"Compra de mercancía - Factura #{factura_id}"
        cursor.execute("""
            INSERT INTO movimientos (
                tipo, producto_id, cantidad, responsable, motivo
            ) VALUES (%s, %s, %s, %s, %s)
        """, (
            'Entrada',  # Tipo de movimiento
            producto_id,
            cantidad,
            session.get('nombre_completo', 'Sistema'),
            motivo
        ))
        return True
    except Exception as e:
        print(f"Error registrando movimiento inventario: {str(e)}")
        return False

def obtener_turno_actual():
    """Obtiene el ID del turno de caja actualmente abierto"""
    conn = conectar()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id 
            FROM caja_estado 
            WHERE estado = 'abierta'
            ORDER BY fecha_apertura DESC 
            LIMIT 1
        """)
        turno = cursor.fetchone()
        return turno['id'] if turno else None
    except Exception as e:
        print(f"Error obteniendo turno actual: {str(e)}")
        return None
    finally:
        cursor.close()
        conn.close()

def generar_factura_pdf(factura_id):
    """Genera PDF para facturas (tanto compras como ventas)"""
    config_empresa = obtener_configuracion_empresa()
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        
        # Obtener datos generales de la factura
        cursor.execute("""
            SELECT f.*, 
                   COALESCE(c.nombre, p.nombre) AS persona_nombre,
                   COALESCE(c.cedula, p.rnc_cedula) AS persona_doc,
                   COALESCE(c.direccion, p.direccion) AS persona_direccion,
                   COALESCE(c.telefono, p.telefono) AS persona_telefono,
                   f.tipo,
                   f.metodo_pago,
                   f.fecha_vencimiento
            FROM facturas f
            LEFT JOIN clientes c ON f.cliente_id = c.id AND f.tipo = 'venta'
            LEFT JOIN proveedores p ON f.cliente_id = p.id AND f.tipo = 'compra'
            WHERE f.id = %s
        """, (factura_id,))
        factura = cursor.fetchone()
        
        if not factura:
            return None
        
        # Obtener detalles de los productos
        cursor.execute("""
            SELECT p.nombre, df.cantidad, df.precio, df.itbis
            FROM detalle_factura df
            JOIN productos p ON df.producto_id = p.id
            WHERE df.factura_id = %s
        """, (factura_id,))
        detalles = cursor.fetchall()
        
        # Cálculos financieros
        subtotal = float(factura['total']) - float(factura['itbis_total'])
        itbis_total = float(factura['itbis_total'])
        total = float(factura['total'])
        fecha_creacion = factura['fecha_creacion'].strftime('%d/%m/%Y %H:%M')
        
        # Determinar tipo de factura
        es_compra = factura['tipo'] == 'compra'
        es_credito = factura['metodo_pago'].lower() == 'credito'
        
        # Formatear fecha de vencimiento si existe
        fecha_vencimiento = ""
        if factura['fecha_vencimiento']:
            if isinstance(factura['fecha_vencimiento'], datetime.date):
                fecha_vencimiento = factura['fecha_vencimiento'].strftime('%d/%m/%Y')
            else:
                fecha_vencimiento = factura['fecha_vencimiento']
        
        # Construir sección de crédito si aplica
        credit_info = ""
        if es_credito:
            credit_info = f"""
            <div class="credit-info">
                <div class="section-title">INFORMACIÓN DE CRÉDITO</div>
                <div><strong>Fecha de Vencimiento:</strong> {fecha_vencimiento}</div>
                <div><strong>Estado:</strong> Pendiente de pago</div>
                <div><strong>Nota:</strong> Este documento representa una obligación financiera</div>
            </div>
            """
        
        # Construir HTML según el tipo de factura
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Factura #{factura_id}</title>
            <style>
                body {{
                    font-family: 'Helvetica Neue', Arial, sans-serif;
                    font-size: 14px;
                    color: #333;
                    line-height: 1.6;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 20px;
                }}
                .title {{
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #2c3e50;
                }}
                .company-info {{
                    margin-bottom: 5px;
                    color: #7f8c8d;
                }}
                .section {{
                    margin-bottom: 25px;
                }}
                .section-title {{
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    color: #2c3e50;
                    border-bottom: 1px solid #3498db;
                    padding-bottom: 5px;
                }}
                .invoice-info {{
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                }}
                .client-info {{
                    background-color: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }}
                .items-table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }}
                .items-table th {{
                    background-color: #2c3e50;
                    color: white;
                    text-align: left;
                    padding: 10px;
                    font-weight: bold;
                }}
                .items-table td {{
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                }}
                .text-right {{
                    text-align: right;
                }}
                .totals-container {{
                    margin-top: 30px;
                    text-align: right;
                    width: 100%;
                }}
                .totals-line {{
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #eee;
                }}
                .totals-total {{
                    font-weight: bold;
                    font-size: 18px;
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 2px solid #2c3e50;
                }}
                .credit-info {{
                    background-color: #fff8e1;
                    padding: 15px;
                    border-radius: 5px;
                    margin-top: 20px;
                    border-left: 4px solid #ffc107;
                }}
                .footer {{
                    margin-top: 40px;
                    text-align: center;
                    color: #7f8c8d;
                    font-size: 12px;
                    border-top: 1px solid #eee;
                    padding-top: 15px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">FACTURA {'DE COMPRA' if es_compra else 'DE VENTA'}</div>
                <div class="company-info">{config_empresa['nombre']}</div>
                <div class="company-info">{config_empresa['direccion']} | RNC: {config_empresa['rnc']}</div>
                <div class="company-info">Tel: {config_empresa['telefono']}</div>
            </div>
            
            <div class="invoice-info">
                <div>
                    <strong>N° Factura:</strong> #{factura_id}<br>
                    <strong>NCF:</strong> {factura['ncf']}
                </div>
                <div>
                    <strong>Fecha:</strong> {fecha_creacion}<br>
                    <strong>Método Pago:</strong> {factura['metodo_pago'].upper()}
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">INFORMACIÓN DEL {'PROVEEDOR' if es_compra else 'CLIENTE'}</div>
                <div class="client-info">
                    <div><strong>Nombre:</strong> {factura['persona_nombre']}</div>
                    <div><strong>{'RNC/Cédula' if es_compra else 'Cédula'}:</strong> {factura['persona_doc']}</div>
                    <div><strong>Dirección:</strong> {factura['persona_direccion']}</div>
                    <div><strong>Teléfono:</strong> {factura['persona_telefono']}</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">DETALLE DE {'COMPRA' if es_compra else 'VENTA'}</div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Producto/Servicio</th>
                            <th>Cant.</th>
                            <th class="text-right">Precio Unitario</th>
                            <th class="text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {"".join(
                            f"<tr>"
                            f"<td>{item['nombre']}</td>"
                            f"<td>{item['cantidad']}</td>"
                            f"<td class='text-right'>RD$ {float(item['precio']):,.2f}</td>"
                            f"<td class='text-right'>RD$ {float(item['precio']) * int(item['cantidad']):,.2f}</td>"
                            f"</tr>"
                            for item in detalles
                        )}
                    </tbody>
                </table>
            </div>
            
            <div class="totals-container">
                <div class="totals-line">
                    <span>Subtotal:</span>
                    <span>RD$ {subtotal:,.2f}</span>
                </div>
                <div class="totals-line">
                    <span>ITBIS (18%):</span>
                    <span>RD$ {itbis_total:,.2f}</span>
                </div>
                <div class="totals-total">
                    <span>TOTAL:</span>
                    <span>RD$ {total:,.2f}</span>
                </div>
            </div>
            
            {credit_info}
            
            <div class="footer">
                <div>{config_empresa['mensaje_legal']}</div>
                <div>Documento generado electrónicamente el {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}</div>
            </div>
        </body>
        </html>
        """
        
        # Configuración para generación de PDF
        try:
            # Intentar Linux
            config = pdfkit.configuration(wkhtmltopdf='/usr/bin/wkhtmltopdf')
        except OSError:
            # Si falla, usar Windows
            config = pdfkit.configuration(
                wkhtmltopdf=r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe"
            )
        options = {
            'page-size': 'A4',
            'margin-top': '0.5in',
            'margin-right': '0.5in',
            'margin-bottom': '0.5in',
            'margin-left': '0.5in',
            'encoding': "UTF-8",
            'enable-local-file-access': None,
            'dpi': 300
        }

        pdf_bytes = pdfkit.from_string(html_content, False, configuration=config, options=options)
        pdf_file = io.BytesIO(pdf_bytes)
        pdf_file.seek(0)
        return pdf_file
        
    except Exception as e:
        print(f"Error al generar PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        cursor.close()
        conn.close()

@bp.route('/')
@login_required
def facturacion():
    config_empresa = obtener_configuracion_empresa()
    rol = session.get('rol', 'empleado')  # si no existe, que sea empleado por defecto
    
    return render_template('facturacion.html', empresa=config_empresa, rol=rol)



@bp.route('/api/productos', methods=['GET'])
def buscar_productos():
    current_app.logger.info("=== INICIANDO BUSQUEDA DE PRODUCTOS ===")
    
    q = request.args.get('q', '').strip()
    current_app.logger.info(f"Término de búsqueda: '{q}'")
    
    termino = f"%{q}%"
    sql = """
      SELECT id, codigo, nombre, precio_venta AS precio, impuesto AS itbis, stock_actual
      FROM productos
      WHERE (codigo LIKE %s OR nombre LIKE %s)
        AND estado = 'activo'
      LIMIT 10
    """

    conn = None
    cursor = None
    try:
        current_app.logger.info("Conectando a la base de datos...")
        conn = conectar()
        
        if conn is None:
            current_app.logger.error("❌ CONEXIÓN A BD FALLÓ - conn es None")
            return jsonify({'error': 'Error de conexión a la base de datos'}), 500
            
        current_app.logger.info("✅ Conexión a BD exitosa")
        
        cursor = conn.cursor()
        current_app.logger.info(f"Ejecutando consulta: {sql}")
        current_app.logger.info(f"Parámetros: ({termino}, {termino})")
        
        cursor.execute(sql, (termino, termino))
        rows = cursor.fetchall()
        cols = [desc[0] for desc in cursor.description]
        
        current_app.logger.info(f"✅ Consulta exitosa. {len(rows)} productos encontrados")

        productos = []
        for row in rows:
            if isinstance(row, dict):
                p = row
            else:
                p = dict(zip(cols, row))

            # Conversión robusta de tipos
            def to_float(v):
                if v is None:
                    return 0.0
                if isinstance(v, Decimal):
                    return float(v)
                try:
                    return float(v)
                except (ValueError, TypeError):
                    return 0.0

            def to_int(v):
                if v is None:
                    return 0
                try:
                    return int(v)
                except (ValueError, TypeError):
                    return 0

            def to_bool(v):
                if v is None:
                    return False
                if isinstance(v, (int, float)):
                    return bool(v)
                if isinstance(v, str):
                    return v.lower() in ('true', '1', 'yes', 'sí', 'si')
                return bool(v)

            # Asegurar que el ID sea string
            product_id = p.get('id')
            if product_id is None:
                product_id = p.get('codigo', '')
            
            productos.append({
                'id': str(product_id),
                'codigo': p.get('codigo', ''),
                'name': p.get('nombre', ''),
                'price': to_float(p.get('precio')),
                'itbis': to_bool(p.get('itbis')),
                'stock': to_int(p.get('stock_actual'))
            })

        current_app.logger.info("✅ Transformación de datos exitosa")
        return jsonify(productos)

    except Exception as e:
        current_app.logger.error("❌ ERROR CRÍTICO en /api/productos:")
        current_app.logger.error(f"Tipo de error: {type(e).__name__}")
        current_app.logger.error(f"Mensaje: {str(e)}")
        current_app.logger.error("Traceback completo:")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Error interno al buscar productos'}), 500
        
    finally:
        try:
            if cursor:
                cursor.close()
                current_app.logger.info("✅ Cursor cerrado")
            if conn:
                conn.close()
                current_app.logger.info("✅ Conexión cerrada")
        except Exception as e:
            current_app.logger.error(f"Error cerrando recursos: {str(e)}")

@bp.route('/api/personas', methods=['GET'])
def api_get_personas():
    tipo = request.args.get('tipo')
    if tipo not in ['cliente', 'proveedor']:
        return jsonify({'success': False, 'message': 'Tipo inválido'}), 400

    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        
        if tipo == 'cliente':
            cursor.execute("""
                SELECT id, nombre AS name, cedula AS rnc, tipo AS type
                FROM clientes
                WHERE estado = 'activo'  -- Solo clientes activos
            """)
        else:
            cursor.execute("""
                SELECT id, nombre AS name, rnc_cedula AS rnc, 'Proveedor' AS type
                FROM proveedores
                WHERE estado = 'activo'  -- Solo proveedores activos
            """)
        
        personas = cursor.fetchall()
        return jsonify(personas)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error en el servidor'
        }), 500
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

@bp.route('/api/facturas/pendientes', methods=['GET'])
def api_obtener_facturas_pendientes():
    """Endpoint para que el agente obtenga facturas pendientes de impresión"""
    # Verificar autenticación
    token = request.headers.get('X-Api-Token')
    if token != TOKEN_AGENTE:
        return jsonify({'error': 'Token inválido'}), 401
    
    facturas = obtener_facturas_pendientes()
    return jsonify(facturas)

@bp.route('/api/facturas/pendientes/<int:id>/marcar-impresa', methods=['POST'])
def api_marcar_factura_impresa(id):
    """Endpoint para que el agente marque una factura como impresa"""
    # Verificar autenticación
    token = request.headers.get('X-Api-Token')
    if token != TOKEN_AGENTE:
        return jsonify({'error': 'Token inválido'}), 401
    
    data = request.get_json()
    exito = data.get('exito', True)
    error = data.get('error', None)
    
    if marcar_factura_impresa(id, exito, error):
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'No se pudo actualizar el estado'}), 500

from decimal import Decimal, ROUND_HALF_UP

@bp.route('/api/facturas', methods=['POST'])
def crear_factura():
    # Validación inicial del JSON
    data = request.get_json(silent=True)
    if not data:
        current_app.logger.warning("crear_factura: request.get_json devolvió None o body vacío")
        return jsonify({'success': False, 'error': 'Request body vacío o no es JSON. Asegure Content-Type: application/json'}), 400

    # Validación de campos requeridos
    required = ['cliente_id', 'total', 'itbis_total', 'metodo_pago', 'detalles']
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({'success': False, 'error': 'Datos incompletos', 'missing': missing}), 400

    # validar estructura detalles
    if not isinstance(data['detalles'], list) or len(data['detalles']) == 0:
        return jsonify({'success': False, 'error': 'No hay productos en la factura (detalles vacío o no es array)'}), 400

    # validacion credito -> fecha_vencimiento requerida
    metodo_pago = str(data.get('metodo_pago', '')).lower()
    if metodo_pago == 'credito' and not data.get('fecha_vencimiento'):
        return jsonify({'success': False, 'error': 'Se requiere fecha_vencimiento para crédito'}), 400

    # Validar turno/caja abierta
    turno_id = obtener_turno_actual()
    if not turno_id:
        return jsonify({'success': False, 'error': 'No se puede facturar porque no hay un turno de caja abierto'}), 400

    # Manejo cliente_id ('cf' o entero)
    es_proveedor = bool(data.get('es_proveedor', False))
    if data['cliente_id'] == 'cf' and not es_proveedor:
        cliente_id = None  # se resolverá en la transacción (tu lógica original crea/usa id 1)
        usar_consumidor_final = True
    else:
        usar_consumidor_final = False
        try:
            cliente_id = int(data['cliente_id'])
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'cliente_id debe ser un número entero o "cf" para consumidor final'}), 400

    # Convertir montos a Decimal (seguridad para dinero)
    def to_decimal(v, default=Decimal('0.00')):
        try:
            return Decimal(str(v)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        except Exception:
            return default

    total = to_decimal(data['total'])
    itbis_total = to_decimal(data['itbis_total'])
    monto_recibido = None
    if metodo_pago == 'efectivo' and 'monto_recibido' in data:
        monto_recibido = to_decimal(data.get('monto_recibido'))

    # Variables para la transacción
    conn = None
    cursor = None
    try:
        conn = conectar()
        if conn is None:
            current_app.logger.error("crear_factura: conectar() devolvió None")
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        cursor = conn.cursor()
        conn.autocommit = False

        # Si cliente 'cf' -> tu lógica para crear/usar consumidor final
        if usar_consumidor_final:
            # mantener tu flujo: intentar id=1, crear si no existe...
            cursor_temp = conn.cursor(dictionary=True)
            try:
                cursor_temp.execute("SELECT id FROM clientes WHERE id = 1")
                cliente_row = cursor_temp.fetchone()
                if cliente_row:
                    cliente_id = cliente_row['id']
                else:
                    cursor_temp.execute("""
                        INSERT INTO clientes (id, nombre, cedula, telefono, direccion, correo, tipo)
                        VALUES (1, 'CONSUMIDOR FINAL', '9999999999', '', '', '', 'Normal')
                    """)
                    conn.commit()
                    cliente_id = 1
            finally:
                cursor_temp.close()

        # DETERMINAR TIPO DE NCF
        if es_proveedor:
            tipo_ncf = "B01"
        else:
            tipo_ncf = "B02" if (data['cliente_id'] == 'cf' or not cliente_tiene_rnc(cliente_id)) else "B01"

        ncf = generar_ncf(tipo_ncf)
        fecha_venc = data.get('fecha_vencimiento') if metodo_pago == 'credito' else None

        # Insertar encabezado: note que pasamos strings para Decimal para compatibilidad con drivers
        cursor.execute("""
            INSERT INTO facturas (
                cliente_id, total, descuento, itbis_total, metodo_pago,
                fecha_vencimiento, ncf, fecha_creacion, estado, tipo, turno_id, monto_recibido
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s)
        """, (
            cliente_id,
            str(total),
            data.get('descuento', 0),
            str(itbis_total),
            data['metodo_pago'],
            fecha_venc,
            ncf,
            'PENDIENTE',
            'compra' if es_proveedor else 'venta',
            turno_id,
            (str(monto_recibido) if monto_recibido is not None else None)
        ))
        factura_id = cursor.lastrowid

        # Insertar detalles (validar en cada item)
        for item in data['detalles']:
            if 'producto_id' not in item or 'cantidad' not in item or 'precio' not in item:
                raise ValueError(f"Detalle inválido: {item}")

            # Determinar si item['producto_id'] es un id numérico o un código
            prod_identifier = item.get('producto_id')
            producto_id = None

            # Intentar buscar por ID si parece entero
            try:
                pid_int = int(prod_identifier)
                cursor.execute("SELECT id FROM productos WHERE id = %s", (pid_int,))
                row = cursor.fetchone()
                if row:
                    producto_id = row[0]
                else:
                    # si no resulta por id, intentar por código como fallback
                    cursor.execute("SELECT id FROM productos WHERE codigo = %s", (str(prod_identifier),))
                    row = cursor.fetchone()
                    if row:
                        producto_id = row[0]
            except (TypeError, ValueError):
                # no era entero -> buscar por código
                cursor.execute("SELECT id FROM productos WHERE codigo = %s", (str(prod_identifier),))
                row = cursor.fetchone()
                if row:
                    producto_id = row[0]

            if not producto_id:
                # log y error claro
                current_app.logger.warning("Detalle con producto no encontrado: %s", prod_identifier)
                raise ValueError(f"Producto no encontrado: {prod_identifier}")

            cursor.execute("""
                INSERT INTO detalle_factura (factura_id, producto_id, cantidad, precio, itbis)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                factura_id,
                producto_id,
                int(item['cantidad']),
                str(Decimal(str(item['precio'])).quantize(Decimal('0.01'))),
                int(bool(item.get('itbis', False)))
            ))

            if not es_proveedor:
                cursor.execute("UPDATE productos SET stock_actual = stock_actual - %s WHERE id = %s", (item['cantidad'], producto_id))
                insertar_ventas_desde_facturas(cursor, producto_id, item['cantidad'], cliente_id, data['metodo_pago'])
            else:
                cursor.execute("UPDATE productos SET stock_actual = stock_actual + %s WHERE id = %s", (item['cantidad'], producto_id))
                registrar_movimiento_inventario(cursor, producto_id, item['cantidad'], factura_id)

        # Procesar estado según método de pago (simplificado)
        if metodo_pago == 'tarjeta':
            resultado_pago = procesar_pago_verifone(float(total))
            if not resultado_pago.get('success'):
                cursor.execute("UPDATE facturas SET estado=%s WHERE id=%s", ('CANCELADA', factura_id))
                conn.commit()
                return jsonify({'success': False, 'error': 'Pago rechazado', 'mensaje': resultado_pago.get('mensaje')}), 402
            codigo_autorizacion = resultado_pago.get('codigo_autorizacion', '')
            cursor.execute("UPDATE facturas SET estado=%s, codigo_autorizacion=%s WHERE id=%s", ('PAGADA', codigo_autorizacion, factura_id))
        elif metodo_pago == 'credito':
            cursor.execute("UPDATE facturas SET estado=%s WHERE id=%s", ('PENDIENTE', factura_id))
            # insertar cuentas por cobrar/pagar (tu lógica)
        else:
            cursor.execute("UPDATE facturas SET estado=%s WHERE id=%s", ('PAGADA', factura_id))

        # Registrar movimiento en caja si aplica
        if metodo_pago != 'credito':
            tipo_mov = 'gasto' if es_proveedor else 'venta'
            descripcion = f"Factura #{factura_id} - {'Compra' if es_proveedor else 'Venta'}"
            cursor.execute("""
                INSERT INTO movimientos_caja (turno_id, factura_id, tipo, metodo_pago, descripcion, monto)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (turno_id, factura_id, tipo_mov, metodo_pago, descripcion, str(total)))

        conn.commit()

        # Guardar pendiente de impresión
        ticket_text = generar_contenido_ticket(factura_id)
        if ticket_text:
            guardar_factura_pendiente(factura_id, ticket_text)

        return jsonify({'success': True, 'factura_id': factura_id, 'ncf': ncf}), 201

    except Exception as ex:
        # rollback sólo si la conexión existe
        current_app.logger.error("Error crear_factura: %s", traceback.format_exc())
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return jsonify({'success': False, 'error': str(ex)}), 400

    finally:
        # Cerrar recursos si existen
        try:
            if cursor:
                cursor.close()
        except Exception:
            pass
        try:
            if conn:
                conn.autocommit = True
                conn.close()
        except Exception:
            pass


@bp.route('/api/facturas/<int:factura_id>/pdf', methods=['GET'])
def descargar_factura_pdf(factura_id):
    """Endpoint para descargar factura en PDF"""
    pdf_buffer = generar_factura_pdf(factura_id)
    if not pdf_buffer:
        return jsonify({'success': False, 'error': 'No se pudo generar el PDF'}), 400
    
    return send_file(
        pdf_buffer,
        as_attachment=True,
        download_name=f'factura_{factura_id}.pdf',
        mimetype='application/pdf'
    )