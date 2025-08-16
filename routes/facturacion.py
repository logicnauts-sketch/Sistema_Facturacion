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

bp = Blueprint('facturacion', __name__)

# Configuración del agente de impresión
AGENTE_IMPRESION_URL = "http://localhost:5001/print"
TOKEN_AGENTE = "november" 

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

def generar_factura_proveedor_pdf(factura_id):
    """Genera PDF para facturas de proveedor"""
    config_empresa = obtener_configuracion_empresa()
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT f.*, 
                   p.nombre AS proveedor_nombre,
                   p.rnc_cedula AS proveedor_rnc,
                   p.direccion AS proveedor_direccion,
                   p.telefono AS proveedor_telefono
            FROM facturas f
            JOIN proveedores p ON f.cliente_id = p.id
            WHERE f.id = %s
        """, (factura_id,))
        factura = cursor.fetchone()
        
        if not factura:
            return None
        
        cursor.execute("""
            SELECT p.nombre, df.cantidad, df.precio, df.itbis
            FROM detalle_factura df
            JOIN productos p ON df.producto_id = p.id
            WHERE df.factura_id = %s
        """, (factura_id,))
        detalles = cursor.fetchall()
        
        subtotal = float(factura['total']) - float(factura['itbis_total'])
        itbis_total = float(factura['itbis_total'])
        total = float(factura['total'])
        fecha_creacion = factura['fecha_creacion'].strftime('%d/%m/%Y %H:%M')

        # HTML para el PDF (igual que antes)
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Factura #{factura_id}</title>
            <style>
                /* Estilos CSS... */
            </style>
        </head>
        <body>
            <!-- Contenido HTML... -->
        </body>
        </html>
        """

        # Configuración para Linux
        config = pdfkit.configuration(wkhtmltopdf='/usr/bin/wkhtmltopdf')
        
        options = {
            'page-size': 'A4',
            'margin-top': '0.5in',
            'margin-right': '0.5in',
            'margin-bottom': '0.5in',
            'margin-left': '0.5in',
            'encoding': "UTF-8",
            'no-outline': None,
            'enable-local-file-access': None,
            'print-media-type': None,
            'dpi': 300,
            'zoom': 1.0
        }

        pdf_bytes = pdfkit.from_string(html_content, False, configuration=config, options=options)
        pdf_file = io.BytesIO(pdf_bytes)
        pdf_file.seek(0)
        return pdf_file
        
    except Exception as e:
        print(f"Error al generar PDF: {str(e)}")
        return None
    finally:
        cursor.close()
        conn.close()

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


@bp.route('/facturacion')
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
        # 1. Insertar encabezado de factura en estado PENDIENTE y reservar NCF
        ncf = generar_ncf()
        cursor.execute("""
            INSERT INTO facturas (
                cliente_id, total, descuento, itbis_total, 
                metodo_pago, ncf, fecha_creacion, estado, tipo, turno_id
            ) VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s, %s, %s)
        """, (
            cliente_id,
            data['total'],
            data.get('descuento', 0),
            data['itbis_total'],
            data['metodo_pago'],
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

        # Commit inicial: factura (PENDIENTE) y detalles creados
        conn.commit()

        # 3. Procesar pago si es tarjeta (ahora después de crear la factura)
        if data['metodo_pago'].lower() == 'tarjeta':
            resultado_pago = procesar_pago_verifone(data['total'])
            if not resultado_pago.get('success'):
                # marcar factura como CANCELADA si falla el pago
                try:
                    cursor.execute("UPDATE facturas SET estado=%s WHERE id=%s", ('CANCELADA', factura_id))
                    conn.commit()
                except Exception:
                    conn.rollback()
                return jsonify({
                    'success': False,
                    'error': 'Pago rechazado, Revise la conexion del equipo',
                    'mensaje': resultado_pago.get('mensaje', 'Transacción no aprobada')
                }), 402

            # Si el pago fue exitoso, actualizar factura como PAGADA y guardar código
            codigo_autorizacion = resultado_pago.get('codigo_autorizacion', '')
            cursor.execute("""
                UPDATE facturas 
                SET estado=%s, codigo_autorizacion=%s 
                WHERE id=%s
            """, ('PAGADA', codigo_autorizacion, factura_id))
            conn.commit()
        else:
            # Para otros métodos marcamos como PAGADA
            cursor.execute("UPDATE facturas SET estado=%s WHERE id=%s", ('PAGADA', factura_id))
            conn.commit()

        # 4. REGISTRAR MOVIMIENTO EN CAJA (NUEVO)
        # Determinar tipo de movimiento
        tipo_movimiento = 'gasto' if tipo_factura == 'compra' else 'venta'
        descripcion = f"Factura #{factura_id} - {'Compra' if tipo_factura == 'compra' else 'Venta'}"
        
        # Registrar en tabla movimientos_caja
        try:
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
            conn.commit()
        except Exception as e:
            print(f"Error registrando movimiento en caja: {str(e)}")
            # No romper el flujo por este error, solo registrar

        # 5. Intentar imprimir ticket
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
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 400
    finally:
        cursor.close()
        conn.close()


@bp.route('/api/facturas/<int:factura_id>/pdf', methods=['GET'])
def descargar_factura_pdf(factura_id):
    """Endpoint para descargar factura en PDF"""
    pdf_buffer = generar_factura_proveedor_pdf(factura_id)
    if not pdf_buffer:
        return jsonify({'success': False, 'error': 'No se pudo generar el PDF'}), 400
    
    return send_file(
        pdf_buffer,
        as_attachment=True,
        download_name=f'factura_compra_{factura_id}.pdf',
        mimetype='application/pdf'
    )

