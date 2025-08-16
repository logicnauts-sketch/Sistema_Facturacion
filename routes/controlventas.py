from flask import Blueprint, render_template, jsonify, request
from datetime import datetime, timedelta, time
from conexion import conectar

bp = Blueprint('controlventas', __name__)

def ejecutar_consulta(query, params=None):
    try:
        conexion = conectar()
        cursor = conexion.cursor(dictionary=True)
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        resultados = cursor.fetchall()
        return resultados
    except Exception:
        return []
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conexion' in locals():
            conexion.close()

def obtener_ventas(period='hoy', start_date=None, end_date=None):
    try:
        hoy = datetime.now()
        if period == 'hoy':
            start_datetime = datetime.combine(hoy.date(), time.min)
            end_datetime = hoy
        elif period == 'semana':
            start_datetime = datetime.combine((hoy - timedelta(days=7)).date(), time.min)
            end_datetime = hoy
        elif period == 'mes':
            start_datetime = datetime.combine((hoy - timedelta(days=30)).date(), time.min)
            end_datetime = hoy
        elif period == 'año':
            start_datetime = datetime.combine((hoy - timedelta(days=365)).date(), time.min)
            end_datetime = hoy
        elif period == 'personalizado' and start_date and end_date:
            start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
            end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
            start_datetime = datetime.combine(start_datetime.date(), time.min)
            end_datetime = datetime.combine(end_datetime.date(), time.max)
        else:
            start_datetime = datetime.combine(hoy.date(), time.min)
            end_datetime = hoy

        query = """
            SELECT v.id, v.producto_id, p.nombre AS producto_nombre, 
                   c.nombre AS categoria, 
                   v.cantidad, v.precio_unitario, 
               (v.cantidad * v.precio_unitario) AS precio_total,
               v.fecha
            FROM ventas v
            JOIN productos p ON v.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            WHERE v.fecha BETWEEN %s AND %s
        """
        return ejecutar_consulta(query, (start_datetime, end_datetime))
    except Exception:
        return []

def obtener_ventas_periodo_anterior(period):
    try:
        hoy = datetime.now()
        if period == 'hoy':
            fecha = hoy - timedelta(days=1)
            return obtener_ventas('personalizado', 
                                 fecha.strftime('%Y-%m-%d'), 
                                 fecha.strftime('%Y-%m-%d'))
        elif period == 'semana':
            start_date = (hoy - timedelta(days=14)).strftime('%Y-%m-%d')
            end_date = (hoy - timedelta(days=8)).strftime('%Y-%m-%d')
            return obtener_ventas('personalizado', start_date, end_date)
        elif period == 'mes':
            start_date = (hoy - timedelta(days=60)).strftime('%Y-%m-%d')
            end_date = (hoy - timedelta(days=31)).strftime('%Y-%m-%d')
            return obtener_ventas('personalizado', start_date, end_date)
        elif period == 'año':
            start_date = (hoy - timedelta(days=730)).strftime('%Y-%m-%d')
            end_date = (hoy - timedelta(days=366)).strftime('%Y-%m-%d')
            return obtener_ventas('personalizado', start_date, end_date)
        return []
    except Exception:
        return []

def calcular_tendencias(ventas_actuales, ventas_anteriores):
    try:
        if not ventas_actuales or not ventas_anteriores:
            return 0, 0, 0
        
        ventas_actual = sum(v['precio_total'] for v in ventas_actuales)
        ventas_anterior = sum(v['precio_total'] for v in ventas_anteriores)
        
        avg_actual = ventas_actual / len(ventas_actuales)
        avg_anterior = ventas_anterior / len(ventas_anteriores)
        
        qty_actual = sum(v['cantidad'] for v in ventas_actuales)
        qty_anterior = sum(v['cantidad'] for v in ventas_anteriores)
        
        trend_sales = round(((ventas_actual - ventas_anterior) / ventas_anterior * 100), 1)
        trend_avg = round(((avg_actual - avg_anterior) / avg_anterior * 100), 1)
        trend_quantity = round(((qty_actual - qty_anterior) / qty_anterior * 100), 1)
        
        return trend_sales, trend_avg, trend_quantity
    except Exception:
        return 0, 0, 0

@bp.route('/controlventas')
def controlventas():
    return render_template("controlventas.html")

@bp.route('/controlventas/dashboard')
def dashboard_data():
    try:
        period = request.args.get('period', 'hoy')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        ventas_actual = obtener_ventas(period, start_date, end_date)
        ventas_anterior = []
        if period != 'personalizado':
            ventas_anterior = obtener_ventas_periodo_anterior(period)
        
        ventas_totales = sum(v['precio_total'] for v in ventas_actual) if ventas_actual else 0
        promedio_venta = ventas_totales / len(ventas_actual) if ventas_actual else 0
        productos_vendidos = sum(v['cantidad'] for v in ventas_actual) if ventas_actual else 0
        
        trend_sales, trend_avg, trend_quantity = calcular_tendencias(ventas_actual, ventas_anterior)
        
        top_productos = []
        if ventas_actual:
            query_top = """
                SELECT p.nombre AS name, c.nombre AS category, 
                       AVG(v.precio_unitario) AS price,
                       SUM(v.cantidad * v.precio_unitario) AS sales,
                       SUM(v.cantidad) AS quantity
                FROM ventas v
                JOIN productos p ON v.producto_id = p.id
                JOIN categorias c ON p.categoria_id = c.id
                WHERE v.fecha BETWEEN %s AND %s
                GROUP BY p.nombre, c.nombre
                ORDER BY sales DESC
                LIMIT 5
            """
            fecha_inicio = min(v['fecha'] for v in ventas_actual)
            fecha_fin = max(v['fecha'] for v in ventas_actual)
            top_productos = ejecutar_consulta(query_top, (fecha_inicio, fecha_fin))
        
        return jsonify({
            'ventas_totales': ventas_totales,
            'promedio_venta': promedio_venta,
            'productos_vendidos': productos_vendidos,
            'trend_sales': trend_sales,
            'trend_avg': trend_avg,
            'trend_quantity': trend_quantity,
            'top_productos': top_productos
        })
    except Exception:
        return jsonify({'error': 'Error interno del servidor'}), 500

@bp.route('/api/ventas_por_producto')
def ventas_por_producto():
    try:
        period = request.args.get('period', 'hoy')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        ventas = obtener_ventas(period, start_date, end_date)
        if not ventas:
            return jsonify({
                "labels": [],
                "ventas": [],
                "cantidad": []
            })
        
        query_agrupado = """
            SELECT CONCAT(p.nombre, ' (', c.nombre, ')') AS producto,
                   SUM(v.cantidad * v.precio_unitario) AS ventas,
                   SUM(v.cantidad) AS cantidad
            FROM ventas v
            JOIN productos p ON v.producto_id = p.id
            JOIN categorias c ON p.categoria_id = c.id
            WHERE v.fecha BETWEEN %s AND %s
            GROUP BY p.nombre, c.nombre
            ORDER BY ventas DESC
            LIMIT 10
        """
        fecha_inicio = min(v['fecha'] for v in ventas)
        fecha_fin = max(v['fecha'] for v in ventas)
        resultados = ejecutar_consulta(query_agrupado, (fecha_inicio, fecha_fin))
        
        labels = [item['producto'] for item in resultados]
        ventas_data = [float(item['ventas']) for item in resultados]
        cantidad_data = [int(item['cantidad']) for item in resultados]
        
        return jsonify({
            "labels": labels,
            "ventas": ventas_data,
            "cantidad": cantidad_data
        })
    except Exception:
        return jsonify({
            "labels": [],
            "ventas": [],
            "cantidad": []
        })