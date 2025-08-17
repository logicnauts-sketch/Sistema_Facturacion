from flask import Blueprint, render_template, jsonify, request
from datetime import datetime
import time
from conexion import conectar
from utils import login_required, solo_admin_required

bp = Blueprint('inventario', __name__)

@bp.route('/inventario')
@login_required
@solo_admin_required
def inventario():
    return render_template("inventario.html")

@bp.route('/inventario/api/datos-inventario')
def datos_inventario():
    conn = conectar()
    if not conn:
        return jsonify({"error": "Error de conexión a la base de datos"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Obtener productos con todos los campos necesarios
        cursor.execute("""
            SELECT id, codigo, nombre, stock_actual AS stock, stock_minimo AS stock_min, precio_venta AS precio
            FROM productos
        """)
        productos = cursor.fetchall()
        
        # Obtener últimos 10 movimientos con fecha en formato ISO
        cursor.execute("""
            SELECT m.id, m.tipo, p.nombre, p.codigo, m.cantidad, 
                   DATE_FORMAT(m.fecha, '%Y-%m-%dT%H:%i:%s') AS fecha_iso, 
                   m.responsable, m.motivo 
            FROM movimientos m
            JOIN productos p ON m.producto_id = p.id
            ORDER BY m.fecha DESC
            LIMIT 10
        """)
        movimientos = cursor.fetchall()
        
        # Convertir fecha ISO a formato UI (DD/MM/YYYY HH:mm)
        for mov in movimientos:
            mov['producto'] = f"{mov['nombre']} ({mov['codigo']})"
            try:
                fecha_obj = datetime.strptime(mov['fecha_iso'], '%Y-%m-%dT%H:%M:%S')
                mov['fecha'] = fecha_obj.strftime('%d/%m/%Y %H:%M')
            except Exception as e:
                mov['fecha'] = "Fecha inválida"
                print(f"Error al convertir fecha: {e}")
        
        # Calcular estadísticas
        total_productos = len(productos)
        
        cursor.execute("""
            SELECT COUNT(*) AS movimientos_mes 
            FROM movimientos 
            WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """)
        movimientos_mes = cursor.fetchone()['movimientos_mes']
        
        cursor.execute("SELECT SUM(stock_actual * precio_venta) AS valor_inventario FROM productos")
        valor_inventario = cursor.fetchone()['valor_inventario'] or 0
        
        # Productos con bajo stock
        cursor.execute("""
            SELECT id, codigo, nombre, stock_actual AS stock, stock_minimo AS stock_min 
            FROM productos 
            WHERE stock_actual < stock_minimo
        """)
        bajo_stock = cursor.fetchall()
        
        return jsonify({
            "estadisticas": {
                "total_productos": total_productos,
                "movimientos_mes": movimientos_mes,
                "valor_inventario": float(valor_inventario)
            },
            "movimientos": movimientos,
            "bajo_stock": bajo_stock,
            "productos": productos,
            "timestamp": time.time()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@bp.route('/inventario/api/registrar-movimiento', methods=['POST'])
def registrar_movimiento():
    data = request.json
    producto_id = data['producto_id']
    tipo = data['tipo']
    cantidad = data['cantidad']
    motivo = data['motivo']
    
    conn = conectar()
    if not conn:
        return jsonify({"success": False, "error": "Error de conexión"}), 500
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Obtener producto actual
        cursor.execute("""
            SELECT id, codigo, nombre, stock_actual, stock_minimo AS stock_min 
            FROM productos 
            WHERE id = %s
        """, (producto_id,))
        producto = cursor.fetchone()
        
        if not producto:
            return jsonify({"success": False, "error": "Producto no encontrado"}), 404
        
        # Actualizar stock según movimiento
        nuevo_stock = producto['stock_actual']
        if tipo in ["Entrada", "Devolución"]:
            nuevo_stock += cantidad
        elif tipo in ["Salida", "Transferencia"]:
            nuevo_stock -= cantidad
        
        # Validar stock no negativo
        if nuevo_stock < 0:
            return jsonify({
                "success": False, 
                "error": f"No hay suficiente stock. Stock actual: {producto['stock_actual']}, requerido: {cantidad}"
            }), 400
        
        # Actualizar producto
        cursor.execute("UPDATE productos SET stock_actual = %s WHERE id = %s", 
                      (nuevo_stock, producto_id))
        
        # Insertar movimiento
        responsable = "Usuario Actual"  # En una app real, obtener de sesión
        cursor.execute("""
            INSERT INTO movimientos (tipo, producto_id, cantidad, responsable, motivo)
            VALUES (%s, %s, %s, %s, %s)
        """, (tipo, producto_id, cantidad, responsable, motivo))
        
        # Obtener movimiento insertado
        movimiento_id = cursor.lastrowid
        
        # Recuperar movimiento completo con formato de fecha
        cursor.execute("""
            SELECT m.id, m.tipo, p.nombre, p.codigo, m.cantidad, 
                   DATE_FORMAT(m.fecha, '%Y-%m-%dT%H:%i:%s') AS fecha_iso, 
                   m.responsable, m.motivo 
            FROM movimientos m
            JOIN productos p ON m.producto_id = p.id
            WHERE m.id = %s
        """, (movimiento_id,))
        nuevo_movimiento = cursor.fetchone()
        nuevo_movimiento['producto'] = f"{nuevo_movimiento['nombre']} ({nuevo_movimiento['codigo']})"
        
        # Convertir fecha ISO a formato UI
        try:
            fecha_obj = datetime.strptime(nuevo_movimiento['fecha_iso'], '%Y-%m-%dT%H:%M:%S')
            nuevo_movimiento['fecha'] = fecha_obj.strftime('%d/%m/%Y %H:%M')
        except Exception as e:
            nuevo_movimiento['fecha'] = "Fecha inválida"
            print(f"Error al convertir fecha: {e}")
        
        # Preparar datos actualizados para el frontend
        producto_actualizado = {
            "id": producto_id,
            "codigo": producto['codigo'],
            "nombre": producto['nombre'],
            "stock": nuevo_stock,
            "stock_min": producto['stock_min']
        }
        
        conn.commit()
        
        return jsonify({
            "success": True,
            "movimiento": nuevo_movimiento,
            "producto_actualizado": producto_actualizado
        })
        
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()