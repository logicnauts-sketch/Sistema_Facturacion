from flask import Blueprint, render_template, jsonify, request, send_file, session
import random
import string
import serial
from conexion import conectar
import datetime
import pdfkit
import io
import os
import requests  # Para comunicación con el agente local
from utils import login_required, solo_admin_required


bp = Blueprint('facturacion', __name__)

# Configuración del agente de impresión
AGENTE_IMPRESION_URL = "http://localhost:5001/print"
TOKEN_AGENTE = "november" 

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
    """Obtiene el nombre de la impresora activa desde la base de datos"""
    conn = conectar()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT nombre, estado
            FROM printers
        """)
        filas = cursor.fetchall()

        for fila in filas:
            if fila['estado'] == '1':
                return fila['nombre']

        return None

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
    nombre_impresora = obtener_impresora_ticket()
    if not nombre_impresora:
        return {'success': False, 'error': 'No hay impresora activa'}

    try:
        # Construir contenido del ticket (igual que antes)
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
            'printer': nombre_impresora
        }
        
        response = requests.post(AGENTE_IMPRESION_URL, json=data, headers=headers, timeout=10)
        
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

def generar_ncf():
    """Genera un NCF válido según normativa DGII"""
    prefijo = "B01"  # Bienes normalizados
    fecha = datetime.datetime.now().strftime("%y%m%d")
    secuencia = ''.join(random.choices(string.digits, k=5))
    return f"{prefijo}{fecha}{secuencia}"

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

@bp.route('/facturacion')
@login_required
def facturacion():
    config_empresa = obtener_configuracion_empresa()
    return render_template('facturacion.html', empresa=config_empresa)

@bp.route('/api/productos', methods=['GET'])
def buscar_productos():
    termino = f"%{request.args.get('q', '')}%"
    sql = """
      SELECT id, codigo, nombre, precio_venta AS precio, impuesto AS itbis, stock_actual
      FROM productos
      WHERE (codigo LIKE %s OR nombre LIKE %s)
        AND estado = 'activo'  -- Solo productos activos
      LIMIT 10
    """
    conn = conectar()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(sql, (termino, termino))
        productos = cursor.fetchall()
        return jsonify([{
            'id':    p['codigo'],
            'name':  p['nombre'],
            'price': float(p['precio']),
            'itbis': bool(p['itbis'])
        } for p in productos])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

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

@bp.route('/api/facturas', methods=['POST'])
def crear_factura():
    data = request.get_json()

    # Validación para créditos
    if data['metodo_pago'].lower() == 'credito' and not data.get('fecha_vencimiento'):
        return jsonify({
            'success': False,
            'error': 'Se requiere fecha de vencimiento para créditos'
        }), 400

    responsable = session.get('nombre_completo', 'Sistema')
    
    # Validar que hay un turno de caja abierto
    turno_id = obtener_turno_actual()
    if not turno_id:
        return jsonify({
            'success': False,
            'error': 'No se puede facturar porque no hay un turno de caja abierto'
        }), 400
    
    # Validación de datos
    required = ['cliente_id', 'total', 'itbis_total', 'metodo_pago', 'detalles']
    if not all(key in data for key in required):
        return jsonify({
            'success': False,
            'error': 'Datos incompletos'
        }), 400
    
    # Validar detalles
    if not data['detalles'] or len(data['detalles']) == 0:
        return jsonify({
            'success': False,
            'error': 'No hay productos en la factura'
        }), 400

    # Determinar tipo de factura basado en el cliente
    es_proveedor = data.get('es_proveedor', False)
    tipo_factura = 'compra' if es_proveedor else 'venta'

    # Manejo especial para cliente consumidor final (solo ventas)
    if data['cliente_id'] == 'cf' and not es_proveedor:
        conn_temp = conectar()
        cursor_temp = conn_temp.cursor(dictionary=True)
        try:
            # Intentar obtener el cliente con id 1
            cursor_temp.execute("SELECT id FROM clientes WHERE id = 1")
            cliente = cursor_temp.fetchone()
            
            if cliente:
                cliente_id = cliente['id']
            else:
                # Crear cliente consumidor final con id 1
                cursor_temp.execute("""
                    INSERT INTO clientes (id, nombre, cedula, telefono, direccion, correo, tipo)
                    VALUES (1, 'CONSUMIDOR FINAL', '9999999999', '', '', '', 'Normal')
                """)
                conn_temp.commit()
                cliente_id = 1
        except Exception as e:
            # Si falla, intentar obtener por cédula
            cursor_temp.execute("SELECT id FROM clientes WHERE cedula = '9999999999'")
            cliente = cursor_temp.fetchone()
            if cliente:
                cliente_id = cliente['id']
            else:
                # Crear sin especificar ID
                cursor_temp.execute("""
                    INSERT INTO clientes (nombre, cedula, telefono, direccion, correo, tipo)
                    VALUES ('CONSUMIDOR FINAL', '9999999999', '', '', '', 'Normal')
                """)
                conn_temp.commit()
                cliente_id = cursor_temp.lastrowid
        finally:
            cursor_temp.close()
            conn_temp.close()
    else:
        try:
            # Convertir cliente_id a entero
            cliente_id = int(data['cliente_id'])
        except (TypeError, ValueError):
            return jsonify({
                'success': False,
                'error': 'cliente_id debe ser un número entero o "cf" para consumidor final'
            }), 400

    # Inicializar variables para el pago
    codigo_autorizacion = ''

    conn = conectar()
    cursor = conn.cursor()
    try:
        # Desactivar autocommit para manejar transacción manualmente
        conn.autocommit = False

        # 1. Insertar encabezado de factura en estado PENDIENTE y reservar NCF
        ncf = generar_ncf()
        
        # PREPARAR FECHA DE VENCIMIENTO (solo para créditos)
        fecha_vencimiento = data.get('fecha_vencimiento') if data['metodo_pago'].lower() == 'credito' else None
        
        cursor.execute("""
            INSERT INTO facturas (
                cliente_id, total, descuento, itbis_total, 
                metodo_pago, fecha_vencimiento, ncf, fecha_creacion, estado, tipo, turno_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), %s, %s, %s)
        """, (
            cliente_id,
            data['total'],
            data.get('descuento', 0),
            data['itbis_total'],
            data['metodo_pago'],
            fecha_vencimiento,  # Nuevo campo
            ncf,
            'PENDIENTE',
            tipo_factura,
            turno_id  # Referencia al turno actual
        ))
        factura_id = cursor.lastrowid

        # 2. Insertar detalles y actualizar stock
        for item in data['detalles']:
            # Buscar ID real del producto
            cursor.execute("SELECT id FROM productos WHERE codigo = %s", (item['producto_id'],))
            producto = cursor.fetchone()
            
            if not producto:
                raise ValueError(f"Producto no encontrado: {item['producto_id']}")
            
            producto_id = producto[0]
            
            cursor.execute("""
                INSERT INTO detalle_factura (
                    factura_id, producto_id, cantidad, precio, itbis
                ) VALUES (%s, %s, %s, %s, %s)
            """, (
                factura_id,
                producto_id,
                item['cantidad'],
                item['precio'],
                int(item['itbis'])
            ))

            # ACTUALIZAR STOCK SEGÚN TIPO DE FACTURA
            if tipo_factura == 'venta':
                # Restar stock para ventas
                cursor.execute("""
                    UPDATE productos 
                    SET stock_actual = stock_actual - %s 
                    WHERE id = %s
                """, (item['cantidad'], producto_id))

                insertar_ventas_desde_facturas(
                    cursor,
                    producto_id,
                    item['cantidad'],
                    cliente_id,
                    data['metodo_pago'],
                )
            elif tipo_factura == 'compra':
                # Sumar stock para compras
                cursor.execute("""
                    UPDATE productos 
                    SET stock_actual = stock_actual + %s 
                    WHERE id = %s
                """, (item['cantidad'], producto_id))

                # REGISTRAR MOVIMIENTO EN LA TABLA "movimientos"
                registrar_movimiento_inventario(
                    cursor,
                    producto_id,
                    item['cantidad'],
                    factura_id,
                )

        # 3. Procesar pago según método
        if data['metodo_pago'].lower() == 'tarjeta':
            resultado_pago = procesar_pago_verifone(data['total'])
            if not resultado_pago.get('success'):
                cursor.execute("UPDATE facturas SET estado=%s WHERE id=%s", ('CANCELADA', factura_id))
                conn.commit()
                return jsonify({
                    'success': False,
                    'error': 'Pago rechazado, Revise la conexion del equipo',
                    'mensaje': resultado_pago.get('mensaje', 'Transacción no aprobada')
                }), 402

            # Si el pago fue exitoso
            codigo_autorizacion = resultado_pago.get('codigo_autorizacion', '')
            cursor.execute("""
                UPDATE facturas 
                SET estado=%s, codigo_autorizacion=%s 
                WHERE id=%s
            """, ('PAGADA', codigo_autorizacion, factura_id))

        elif data['metodo_pago'].lower() == 'credito':
            # Actualizar estado a PENDIENTE
            cursor.execute("UPDATE facturas SET estado=%s WHERE id=%s", ('PENDIENTE', factura_id))
            
            # Insertar en cuentas por pagar/cobrar
            if tipo_factura == 'compra':
                # Cuentas por pagar (compras a crédito)
                cursor.execute("""
                    INSERT INTO cuentas_por_pagar (
                        proveedor_id, numero_factura, fecha_emision, 
                        fecha_vencimiento, monto, estado, descripcion
                    ) VALUES (%s, %s, CURDATE(), %s, %s, 'Pendiente', %s)
                """, (
                    cliente_id,
                    ncf,
                    fecha_vencimiento,  # Usar la misma fecha de vencimiento
                    data['total'],
                    f"Factura de compra #{factura_id}"
                ))
            else:
                # Cuentas por cobrar (ventas a crédito)
                cursor.execute("""
                    INSERT INTO cuentas_por_cobrar (
                        cliente_id, factura_id, monto_total, 
                        fecha_emision, fecha_vencimiento, estado
                    ) VALUES (%s, %s, %s, CURDATE(), %s, 'pendiente')
                """, (
                    cliente_id,
                    factura_id,
                    data['total'],
                    fecha_vencimiento  # Usar la misma fecha de vencimiento
                ))

        else:  # Efectivo, transferencia, etc.
            cursor.execute("UPDATE facturas SET estado=%s WHERE id=%s", ('PAGADA', factura_id))

        # 4. REGISTRAR MOVIMIENTO EN CAJA (SOLO PARA MÉTODOS NO CRÉDITO)
        if data['metodo_pago'].lower() != 'credito':
            tipo_movimiento = 'gasto' if tipo_factura == 'compra' else 'venta'
            descripcion = f"Factura #{factura_id} - {'Compra' if tipo_factura == 'compra' else 'Venta'}"
            
            cursor.execute("""
                INSERT INTO movimientos_caja (
                    turno_id, factura_id, tipo, metodo_pago, descripcion, monto
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                turno_id,
                factura_id,
                tipo_movimiento,
                data['metodo_pago'].lower(),
                descripcion,
                data['total']
            ))

        # Confirmar toda la transacción
        conn.commit()

        # 5. Intentar imprimir ticket (fuera de la transacción)
        resultado_impresion = imprimir_ticket(factura_id)
        
        # 6. Preparar respuesta
        response = {
            'success': True,
            'factura_id': factura_id,
            'ncf': ncf,
            'codigo_autorizacion': codigo_autorizacion
        }
        
        if not resultado_impresion.get('success', True):
            response['warning'] = f"Factura creada pero error al imprimir: {resultado_impresion.get('error', '')}"
        
        return jsonify(response), 201

    except Exception as e:
        # Revertir transacción en caso de error
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 400
    finally:
        # Restaurar modo autocommit y cerrar conexión
        conn.autocommit = True
        cursor.close()
        conn.close()
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

