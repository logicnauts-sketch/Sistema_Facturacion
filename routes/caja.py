from flask import Blueprint, render_template, jsonify, request, session
import datetime
from conexion import conectar
from utils import login_required, solo_admin_required

bp = Blueprint('caja', __name__)

def obtener_estadisticas_facturacion_turno(turno_id):
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                COUNT(id) AS total_facturas,
                COALESCE(SUM(total), 0) AS total_facturado,
                MAX(id) AS ultima_factura_id
            FROM facturas
            WHERE turno_id = %s
                AND LOWER(tipo) = 'venta'    -- sólo ventas, ignora compras
                AND LOWER(estado) = 'pagada'
        """, (turno_id,))
        
        result = cursor.fetchone()
        return {
            'total_facturas': result['total_facturas'] if result else 0,
            'total_facturado': float(result['total_facturado']) if result else 0.0,
            'ultima_factura_id': result['ultima_factura_id'] if result else None
        }
    except Exception as e:
        print(f"Error obteniendo estadísticas: {e}")
        return {
            'total_facturas': 0,
            'total_facturado': 0.0,
            'ultima_factura_id': None
        }
    finally:
        try:
            if cursor: cursor.close()
        except:
            pass
        try:
            if conn: conn.close()
        except:
            pass

@bp.route('/caja')
@login_required
def caja():
    """Renderiza la vista de caja sin precargar datos"""
    return render_template("caja.html")

@bp.route('/api/caja/estado-actual', methods=['GET'])
def estado_actual():
    """Devuelve el estado actual de la caja"""
    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)

        # Obtener turno abierto
        cursor.execute("""
            SELECT id, estado, fecha_apertura, fecha_cierre, cajero, monto_inicial
            FROM caja_estado
            WHERE estado = 'abierta'
            ORDER BY fecha_apertura DESC
            LIMIT 1
        """)
        turno = cursor.fetchone()

        movimientos = []
        estadisticas = {
            'total_facturas': 0,
            'total_facturado': 0.0,
            'ultima_factura_id': None
        }

        if turno:
            turno_id = turno['id']

            # Obtener movimientos del turno excluyendo los asociados a facturas de tipo 'compra'
            cursor.execute("""
                SELECT m.id, m.turno_id, m.factura_id, m.tipo, m.metodo_pago, 
                       m.descripcion, m.monto, m.fecha
                FROM movimientos_caja m
                LEFT JOIN facturas f ON m.factura_id = f.id
                WHERE m.turno_id = %s
                  AND (f.id IS NULL OR LOWER(f.tipo) != 'compra')
                ORDER BY m.fecha DESC
            """, (turno_id,))
            movimientos = cursor.fetchall() or []
            
            # Convertir Decimal a float para serialización
            for m in movimientos:
                try:
                    m['monto'] = float(m['monto']) if m.get('monto') is not None else 0.0
                except (TypeError, ValueError):
                    m['monto'] = 0.0

            # Obtener estadísticas de facturación del turno
            estadisticas = obtener_estadisticas_facturacion_turno(turno_id)

        # Preparar respuesta
        return jsonify({
            'success': True,
            'data': {
                'open': turno is not None and turno['estado'] == 'abierta',
                'start': turno['fecha_apertura'].isoformat() if turno and turno['fecha_apertura'] else None,
                'end': turno['fecha_cierre'].isoformat() if turno and turno['fecha_cierre'] else None,
                'cashier': turno['cajero'] if turno else session.get('nombre_completo', 'admin@tienda'),
                'initialCash': float(turno['monto_inicial']) if turno and turno.get('monto_inicial') is not None else 0,
                'movements': movimientos,  # Array ya convertido
                'facturas': estadisticas['total_facturas'],
                'totalFacturado': float(estadisticas['total_facturado']),
                'ultimaFactura': estadisticas['ultima_factura_id']
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        try:
            if cursor: cursor.close()
        except:
            pass
        try:
            if conn: conn.close()
        except:
            pass


@bp.route('/api/caja/movimientos', methods=['GET'])
def obtener_movimientos():
    """Obtiene los movimientos del turno actual"""
    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        
        # Obtener turno abierto
        cursor.execute("""
            SELECT id 
            FROM caja_estado 
            WHERE estado = 'abierta'
            ORDER BY fecha_apertura DESC 
            LIMIT 1
        """)
        turno = cursor.fetchone()
        
        if not turno:
            return jsonify({'success': True, 'movimientos': []})
            
        turno_id = turno['id']
        
        cursor.execute("""
            SELECT m.id, m.turno_id, m.factura_id, m.tipo, m.metodo_pago, m.descripcion, m.monto, m.fecha
            FROM movimientos_caja m
            LEFT JOIN facturas f ON m.factura_id = f.id
            WHERE m.turno_id = %s
              AND (f.id IS NULL OR LOWER(f.tipo) != 'compra')
            ORDER BY m.fecha DESC
        """, (turno_id,))
        movimientos = cursor.fetchall() or []
        
        # Convertir decimales a float
        for m in movimientos:
            if 'monto' in m:
                try:
                    m['monto'] = float(m['monto']) if m['monto'] is not None else 0.0
                except (TypeError, ValueError):
                    m['monto'] = 0.0
                
        return jsonify({
            'success': True,
            'movimientos': movimientos
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        try:
            if cursor: cursor.close()
        except:
            pass
        try:
            if conn: conn.close()
        except:
            pass


@bp.route('/api/caja/estadisticas-facturacion', methods=['GET'])
def obtener_estadisticas_facturacion():
    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        
        # Obtener turno abierto
        cursor.execute("SELECT id FROM caja_estado WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1")
        turno_abierto = cursor.fetchone()

        if not turno_abierto:
            return jsonify({
                'success': True,
                'data': {
                    'total_facturas': 0,
                    'total_facturado': 0.0,
                    'ultima_factura_id': None
                }
            })

        turno_id = turno_abierto['id']
        
        # Consulta consistente con lower()
        cursor.execute("""
            SELECT 
                COUNT(id) AS total_facturas,
                COALESCE(SUM(total), 0) AS total_facturado,
                MAX(id) AS ultima_factura_id
            FROM facturas
            WHERE turno_id = %s
                AND LOWER(tipo) = 'venta'
                AND LOWER(estado) = 'pagada'
        """, (turno_id,))
        
        result = cursor.fetchone() or {
            'total_facturas': 0,
            'total_facturado': 0.0,
            'ultima_factura_id': None
        }
        
        # Asegurar tipos correctos
        if 'total_facturado' in result:
            result['total_facturado'] = float(result['total_facturado'])
        
        return jsonify({'success': True, 'data': result})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        try:
            if cursor: cursor.close()
        except:
            pass
        try:
            if conn: conn.close()
        except:
            pass

@bp.route('/api/caja/abrir', methods=['POST'])
def abrir_turno():
    data = request.get_json() or {}
    try:
        monto_inicial = float(data.get('monto_inicial', 0))
    except (TypeError, ValueError):
        monto_inicial = 0.0
    cajero = session.get('nombre_completo', 'admin@tienda')

    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        
        # Verificar si ya hay un turno abierto
        cursor.execute("SELECT id FROM caja_estado WHERE estado = 'abierta'")
        if cursor.fetchone():
            return jsonify({
                'success': False, 
                'error': 'Ya hay un turno abierto. Cierre el turno actual primero.'
            }), 400

        # Insertar nuevo turno
        cursor.execute("""
            INSERT INTO caja_estado (estado, fecha_apertura, monto_inicial, cajero)
            VALUES ('abierta', NOW(), %s, %s)
        """, (monto_inicial, cajero))
        
        new_id = cursor.lastrowid
        conn.commit()

        # Obtener datos del nuevo turno
        cursor.execute("""
            SELECT id, estado, fecha_apertura, fecha_cierre, monto_inicial, cajero 
            FROM caja_estado 
            WHERE id = %s
        """, (new_id,))
        nuevo_turno = cursor.fetchone()
        
        # Convertir fechas a formato ISO
        if nuevo_turno:
            if 'fecha_apertura' in nuevo_turno and nuevo_turno['fecha_apertura']:
                nuevo_turno['fecha_apertura'] = nuevo_turno['fecha_apertura'].isoformat()
            if 'fecha_cierre' in nuevo_turno and nuevo_turno['fecha_cierre']:
                nuevo_turno['fecha_cierre'] = nuevo_turno['fecha_cierre'].isoformat()
        
            # Convertir decimal a float
            if 'monto_inicial' in nuevo_turno:
                try:
                    nuevo_turno['monto_inicial'] = float(nuevo_turno['monto_inicial'])
                except (TypeError, ValueError):
                    nuevo_turno['monto_inicial'] = 0.0
            
        return jsonify({'success': True, 'turno': nuevo_turno})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        try:
            if cursor: cursor.close()
        except:
            pass
        try:
            if conn: conn.close()
        except:
            pass

@bp.route('/api/caja/cerrar', methods=['POST'])
def cerrar_turno():
    data = request.get_json() or {}
    observaciones = data.get('observaciones', '')
    try:
        monto_efectivo = float(data.get('monto_efectivo', 0))
    except (TypeError, ValueError):
        monto_efectivo = 0.0
    try:
        monto_tarjeta = float(data.get('monto_tarjeta', 0))
    except (TypeError, ValueError):
        monto_tarjeta = 0.0
    try:
        monto_total = float(data.get('monto_total', 0))
    except (TypeError, ValueError):
        monto_total = 0.0

    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id 
            FROM caja_estado 
            WHERE estado = 'abierta'
            ORDER BY fecha_apertura DESC 
            LIMIT 1
        """)
        turno = cursor.fetchone()

        if not turno:
            return jsonify({'success': False, 'error': 'No hay turno abierto para cerrar'}), 400

        turno_id = turno['id']

        # OBTENER ESTADÍSTICAS ANTES DE CERRAR EL TURNO
        estadisticas = obtener_estadisticas_facturacion_turno(turno_id)
        
        cursor.execute("""
            UPDATE caja_estado 
            SET estado = 'cerrada',
                fecha_cierre = NOW(),
                observaciones = %s,
                monto_final_efectivo = %s,
                monto_final_tarjeta = %s,
                monto_final_total = %s
            WHERE id = %s
        """, (observaciones, monto_efectivo, monto_tarjeta, monto_total, turno_id))
        conn.commit()
        
        # DEVOLVER LAS ESTADÍSTICAS EN LA RESPUESTA
        return jsonify({
            'success': True,
            'estadisticas': {
                'total_facturas': estadisticas['total_facturas'],
                'total_facturado': float(estadisticas['total_facturado']),
                'ultima_factura_id': estadisticas['ultima_factura_id']
            }
        })

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'success': False, 'error': f"Error al cerrar turno: {e}"}), 500
    finally:
        try:
            if cursor: cursor.close()
        except:
            pass
        try:
            if conn: conn.close()
        except:
            pass

@bp.route('/api/caja/movimientos', methods=['POST'])
def registrar_movimiento():
    data = request.get_json() or {}
    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        
        # Verificar turno abierto
        cursor.execute("SELECT id FROM caja_estado WHERE estado = 'abierta' LIMIT 1")
        turno = cursor.fetchone()
        
        if not turno:
            return jsonify({
                'success': False, 
                'error': 'No hay turno abierto'
            }), 400

        turno_id = turno['id']
        factura_id = data.get('factura_id')

        # Si se envió factura_id: verificar que no sea una factura de compra
        if factura_id is not None:
            cursor.execute("SELECT LOWER(tipo) AS tipo FROM facturas WHERE id = %s", (factura_id,))
            f = cursor.fetchone()
            if f and f.get('tipo') == 'compra':
                return jsonify({'success': False, 'error': 'No se permiten movimientos para facturas de compra.'}), 400

            # Verificar si el movimiento ya existe (solo si factura_id fue provisto)
            cursor.execute("""
                SELECT id 
                FROM movimientos_caja 
                WHERE turno_id = %s 
                  AND factura_id = %s
            """, (turno_id, factura_id))
            if cursor.fetchone():
                return jsonify({
                    'success': False, 
                    'error': 'El movimiento ya está registrado'
                }), 400

        # Validar monto
        try:
            monto = float(data.get('monto', 0))
        except (TypeError, ValueError):
            monto = 0.0

        # Registrar movimiento
        cursor.execute("""
            INSERT INTO movimientos_caja (
                turno_id, factura_id, tipo, metodo_pago, descripcion, monto, fecha
            ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (
            turno_id,
            factura_id,
            data.get('tipo'),
            data.get('metodo_pago'),
            data.get('descripcion'),
            monto
        ))
        
        conn.commit()
        return jsonify({'success': True, 'id': cursor.lastrowid})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        try:
            if cursor: cursor.close()
        except:
            pass
        try:
            if conn: conn.close()
        except:
            pass
