from flask import Blueprint, render_template, jsonify, request
from utils import login_required
from conexion import conectar
from datetime import datetime, timedelta

bp = Blueprint('balanceeyi', __name__)

@bp.route('/balanceeyi')
@login_required
def balanceeyi():
    return render_template("balanceeyi.html")

@bp.route('/api/financial-summary')
@login_required
def financial_summary():
    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)  # Usar cursor diccionario
        
        # Obtener ingresos totales (ventas + servicios)
        cursor.execute("""
            SELECT COALESCE(SUM(total), 0) as total_ingresos 
            FROM facturas 
            WHERE tipo = 'venta' AND Estado = 'PAGADA'
        """)
        result = cursor.fetchone()
        total_income = result['total_ingresos'] if result else 0
        
        # Obtener gastos totales (compras + gastos de caja + cuentas por pagar)
        cursor.execute("""
            SELECT COALESCE(SUM(total), 0) as total_gastos 
            FROM facturas 
            WHERE tipo = 'compra'
        """)
        result = cursor.fetchone()
        gastos_facturas = result['total_gastos'] if result else 0
        
        cursor.execute("""
            SELECT COALESCE(SUM(monto), 0) as total_gastos 
            FROM movimientos_caja 
            WHERE tipo = 'gasto'
        """)
        result = cursor.fetchone()
        gastos_movimientos = result['total_gastos'] if result else 0
        
        cursor.execute("""
            SELECT COALESCE(SUM(monto), 0) as total_gastos 
            FROM cuentas_por_pagar 
            WHERE estado = 'Pagado'
        """)
        result = cursor.fetchone()
        gastos_cxp = result['total_gastos'] if result else 0
        
        total_expenses = gastos_facturas + gastos_movimientos + gastos_cxp
        net_profit = total_income - total_expenses
        
        return jsonify({
            'total_income': float(total_income),
            'total_expenses': float(total_expenses),
            'net_profit': float(net_profit)
        })
        
    except Exception as e:
        print(f"Error obteniendo resumen financiero: {e}")
        return jsonify({
            'total_income': 0,
            'total_expenses': 0,
            'net_profit': 0
        }), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@bp.route('/api/financial-charts')
@login_required
def financial_charts():
    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)  # Usar cursor diccionario
        
        # Datos para gráfico de ingresos
        cursor.execute("""
            SELECT 
                CASE 
                    WHEN f.descripcion LIKE '%producto%' OR f.descripcion LIKE '%venta%' THEN 'Ventas de Productos'
                    WHEN f.descripcion LIKE '%servicio%' THEN 'Servicios'
                    ELSE 'Otros Ingresos'
                END as categoria,
                SUM(f.total) as monto
            FROM facturas f
            WHERE f.tipo = 'venta' AND f.Estado = 'PAGADA'
            GROUP BY categoria
        """)
        
        ingresos_data = cursor.fetchall()
        total_ingresos = sum([float(row['monto']) for row in ingresos_data])
        
        income_labels = []
        income_values = []
        income_colors = ['#10b981', '#3b82f6', '#8b5cf6']
        
        for row in ingresos_data:
            income_labels.append(row['categoria'])
            percentage = (float(row['monto']) / total_ingresos) * 100 if total_ingresos > 0 else 0
            income_values.append(round(percentage, 2))
        
        # Datos para gráfico de gastos
        cursor.execute("""
            (SELECT 'Inventario' as categoria, SUM(total) as monto FROM facturas WHERE tipo = 'compra')
            UNION
            (SELECT 'Servicios' as categoria, SUM(monto) as monto FROM movimientos_caja WHERE tipo = 'gasto' AND descripcion LIKE '%servicio%')
            UNION
            (SELECT 'Nómina' as categoria, SUM(monto) as monto FROM movimientos_caja WHERE tipo = 'gasto' AND descripcion LIKE '%nomina%' OR descripcion LIKE '%salario%')
            UNION
            (SELECT 'Mantenimiento' as categoria, SUM(monto) as monto FROM movimientos_caja WHERE tipo = 'gasto' AND descripcion LIKE '%mantenimiento%')
            UNION
            (SELECT 'Impuestos' as categoria, SUM(monto) as monto FROM movimientos_caja WHERE tipo = 'gasto' AND descripcion LIKE '%impuesto%')
        """)
        
        gastos_data = cursor.fetchall()
        total_gastos = sum([float(row['monto']) for row in gastos_data])
        
        expenses_labels = []
        expenses_values = []
        expenses_colors = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#10b981']
        
        for row in gastos_data:
            if float(row['monto']) > 0:
                expenses_labels.append(row['categoria'])
                percentage = (float(row['monto']) / total_gastos) * 100 if total_gastos > 0 else 0
                expenses_values.append(round(percentage, 2))
        
        return jsonify({
            'income': {
                'labels': income_labels,
                'datasets': [{
                    'data': income_values,
                    'backgroundColor': income_colors[:len(income_labels)],
                    'borderWidth': 0
                }]
            },
            'expenses': {
                'labels': expenses_labels,
                'datasets': [{
                    'data': expenses_values,
                    'backgroundColor': expenses_colors[:len(expenses_labels)],
                    'borderWidth': 0
                }]
            }
        })
        
    except Exception as e:
        print(f"Error obteniendo datos para gráficos: {e}")
        # Devolver datos de ejemplo en caso de error
        return jsonify({
            'income': {
                'labels': ['Ventas de Productos', 'Servicios', 'Otros Ingresos'],
                'datasets': [{
                    'data': [76, 20, 4],
                    'backgroundColor': ['#10b981', '#3b82f6', '#8b5cf6'],
                    'borderWidth': 0
                }]
            },
            'expenses': {
                'labels': ['Inventario', 'Servicios', 'Nómina', 'Mantenimiento', 'Impuestos'],
                'datasets': [{
                    'data': [35, 23, 21, 13, 8],
                    'backgroundColor': ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#10b981'],
                    'borderWidth': 0
                }]
            }
        }), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@bp.route('/api/transactions')
@login_required
def get_transactions():
    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)  # Usar cursor diccionario
        
        # Obtener transacciones de diferentes fuentes
        cursor.execute("""
            (SELECT 
                DATE_FORMAT(f.fecha_creacion, '%d/%m/%Y') as fecha,
                'Ingreso' as tipo,
                CASE 
                    WHEN f.descripcion LIKE '%producto%' THEN 'Ventas'
                    WHEN f.descripcion LIKE '%servicio%' THEN 'Servicios'
                    ELSE 'Otros Ingresos'
                END as categoria,
                COALESCE(f.descripcion, CONCAT('Factura ', f.ncf)) as concepto,
                f.total as monto,
                COALESCE(c.cajero, 'Sistema') as responsable
            FROM facturas f
            LEFT JOIN caja_estado c ON f.turno_id = c.id
            WHERE f.tipo = 'venta' AND f.Estado = 'PAGADA')
            
            UNION ALL
            
            (SELECT 
                DATE_FORMAT(m.fecha, '%d/%m/%Y') as fecha,
                'Egreso' as tipo,
                CASE 
                    WHEN m.descripcion LIKE '%servicio%' THEN 'Servicios'
                    WHEN m.descripcion LIKE '%nomina%' OR m.descripcion LIKE '%salario%' THEN 'Nómina'
                    WHEN m.descripcion LIKE '%mantenimiento%' THEN 'Mantenimiento'
                    WHEN m.descripcion LIKE '%inventario%' THEN 'Inventario'
                    WHEN m.descripcion LIKE '%impuesto%' THEN 'Impuestos'
                    ELSE 'Gastos Generales'
                END as categoria,
                m.descripcion as concepto,
                m.monto as monto,
                COALESCE(c.cajero, 'Sistema') as responsable
            FROM movimientos_caja m
            LEFT JOIN caja_estado c ON m.turno_id = c.id
            WHERE m.tipo = 'gasto')
            
            UNION ALL
            
            (SELECT 
                DATE_FORMAT(fecha_pago, '%d/%m/%Y') as fecha,
                'Egreso' as tipo,
                'Cuentas por Pagar' as categoria,
                CONCAT('Pago: ', descripcion) as concepto,
                monto as monto,
                'Sistema' as responsable
            FROM cuentas_por_pagar 
            WHERE estado = 'Pagado' AND fecha_pago IS NOT NULL)
            
            ORDER BY fecha DESC
            LIMIT 100
        """)
        
        transactions = cursor.fetchall()
        
        # Convertir a formato JSON
        result = []
        for row in transactions:
            # Ajustar el monto para egresos (debe ser negativo)
            amount = float(row['monto'])
            if row['tipo'] == 'Egreso':
                amount = -amount
                
            result.append({
                'date': row['fecha'],
                'type': row['tipo'],
                'category': row['categoria'],
                'concept': row['concepto'],
                'amount': amount,
                'responsible': row['responsable']
            })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error obteniendo transacciones: {e}")
        return jsonify([]), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@bp.route('/api/categories')
@login_required
def get_categories():
    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)  # Usar cursor diccionario
        
        # Obtener categorías de ingresos
        cursor.execute("""
            SELECT DISTINCT 
                CASE 
                    WHEN f.descripcion LIKE '%producto%' THEN 'Ventas'
                    WHEN f.descripcion LIKE '%servicio%' THEN 'Servicios'
                    ELSE 'Otros Ingresos'
                END as categoria
            FROM facturas f
            WHERE f.tipo = 'venta' AND f.Estado = 'PAGADA'
            UNION
            SELECT 'Inversiones' as categoria
            UNION
            SELECT 'Préstamos' as categoria
        """)
        
        income_categories = [row['categoria'] for row in cursor.fetchall() if row['categoria']]
        
        # Obtener categorías de egresos
        cursor.execute("""
            SELECT DISTINCT
                CASE 
                    WHEN m.descripcion LIKE '%servicio%' THEN 'Servicios'
                    WHEN m.descripcion LIKE '%nomina%' OR m.descripcion LIKE '%salario%' THEN 'Nómina'
                    WHEN m.descripcion LIKE '%mantenimiento%' THEN 'Mantenimiento'
                    WHEN m.descripcion LIKE '%inventario%' THEN 'Inventario'
                    WHEN m.descripcion LIKE '%impuesto%' THEN 'Impuestos'
                    WHEN m.descripcion LIKE '%marketing%' OR m.descripcion LIKE '%publicidad%' THEN 'Marketing'
                    ELSE 'Gastos Generales'
                END as categoria
            FROM movimientos_caja m
            WHERE m.tipo = 'gasto'
            UNION
            SELECT 'Cuentas por Pagar' as categoria
        """)
        
        expense_categories = [row['categoria'] for row in cursor.fetchall() if row['categoria']]
        
        return jsonify({
            'Ingreso': income_categories,
            'Egreso': expense_categories
        })
        
    except Exception as e:
        print(f"Error obteniendo categorías: {e}")
        # Devolver categorías por defecto en caso de error
        return jsonify({
            'Ingreso': ['Ventas', 'Servicios', 'Inversiones', 'Préstamos', 'Otros Ingresos'],
            'Egreso': ['Servicios', 'Nómina', 'Mantenimiento', 'Inventario', 'Impuestos', 'Marketing', 'Gastos Generales']
        }), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@bp.route('/api/add-transaction', methods=['POST'])
@login_required
def add_transaction():
    conn = None
    cursor = None
    try:
        data = request.get_json()
        
        if not data or not all(key in data for key in ['date', 'type', 'category', 'concept', 'amount', 'responsible']):
            return jsonify({'error': 'Datos incompletos'}), 400
        
        conn = conectar()
        cursor = conn.cursor(dictionary=True)  # Usar cursor diccionario
        
        # Insertar la transacción en la tabla correspondiente según el tipo
        if data['type'] == 'Ingreso':
            # Insertar en facturas como venta
            cursor.execute("""
                INSERT INTO facturas (fecha_creacion, tipo, descripcion, total, Estado, turno_id)
                VALUES (%s, 'venta', %s, %s, 'PAGADA', 
                    (SELECT id FROM caja_estado WHERE cajero = %s ORDER BY fecha_apertura DESC LIMIT 1))
            """, (data['date'], data['concept'], data['amount'], data['responsible']))
        else:
            # Insertar en movimientos_caja como gasto
            cursor.execute("""
                INSERT INTO movimientos_caja (fecha, tipo, descripcion, monto, turno_id)
                VALUES (%s, 'gasto', %s, %s, 
                    (SELECT id FROM caja_estado WHERE cajero = %s ORDER BY fecha_apertura DESC LIMIT 1))
            """, (data['date'], data['concept'], data['amount'], data['responsible']))
        
        conn.commit()
        
        return jsonify({'success': True, 'message': 'Transacción agregada correctamente'})
        
    except Exception as e:
        print(f"Error agregando transacción: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()