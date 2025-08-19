from flask import Blueprint, render_template, redirect, session,url_for, jsonify, request
from conexion import conectar
from datetime import datetime
import logging
from utils import login_required, solo_admin_required

bp = Blueprint('home', __name__)

@bp.route('/')
@login_required
@solo_admin_required
def inicio():
    # Verificar si el usuario ya está autenticado
    if 'user_id' in session:
        return redirect('/home')
    else:
        return redirect(url_for('login.login'))


@bp.route('/home')
@login_required
@solo_admin_required
def home():
    if 'user_id' not in session:
        return redirect('/login')

    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor()
        
        user_id = session['user_id']
        cursor.execute("SELECT nombre_completo, rol FROM usuarios WHERE id = %s", (user_id,))
        user_data = cursor.fetchone()

        if not user_data:
            return redirect('/login')

        # Generar iniciales
        nombres = user_data[0].split()
        iniciales = ''.join([name[0] for name in nombres[:2]]).upper()

        # Obtener datos para el panel
        # 1. Total de proveedores
        cursor.execute("SELECT COUNT(*) FROM proveedores")
        total_proveedores = cursor.fetchone()[0] or 0

        # 2. Total de ingresos (facturas de tipo 'venta')
        cursor.execute("SELECT SUM(total) FROM facturas WHERE tipo = 'venta'")
        total_ingresos = cursor.fetchone()[0] or 0

        # 3. Cuentas por pagar pendientes (todas)
        cursor.execute("SELECT COUNT(*) FROM cuentas_por_pagar WHERE estado = 'Pendiente'")
        cuentas_pendientes = cursor.fetchone()[0] or 0

        # 4. Cuentas por pagar vencidas (fecha_vencimiento < hoy)
        hoy = datetime.now().date()
        cursor.execute("SELECT COUNT(*) FROM cuentas_por_pagar WHERE estado = 'Pendiente' AND fecha_vencimiento < %s", (hoy,))
        cuentas_vencidas = cursor.fetchone()[0] or 0

        return render_template(
            "home.html",
            nombre_completo=user_data[0],
            rol=user_data[1],
            iniciales=iniciales,
            total_proveedores=total_proveedores,
            total_ingresos=total_ingresos,
            cuentas_pendientes=cuentas_pendientes,
            cuentas_vencidas=cuentas_vencidas
        )
        
    except Exception as e:
        logging.error(f"Error en /home: {str(e)}")
        return "Error interno del servidor", 500
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            try:
                conn.close()
            except:
                pass


@bp.route('/api/dashboard-data')
def dashboard_data():
    if 'user_id' not in session:
        return jsonify(error="No autenticado"), 401

    conn = None
    cursor = None
    try:
        conn = conectar()
        cursor = conn.cursor()
        
        # Obtener datos actualizados
        cursor.execute("SELECT COUNT(*) FROM proveedores")
        total_proveedores = cursor.fetchone()[0] or 0

        cursor.execute("SELECT SUM(total) FROM ventas WHERE estado = 'completada'")
        total_ingresos = cursor.fetchone()[0] or 0

        cursor.execute("SELECT COUNT(*) FROM cuentas_por_pagar WHERE estado = 'Pendiente'")
        cuentas_pendientes = cursor.fetchone()[0] or 0

        hoy = datetime.now().date()
        cursor.execute("SELECT COUNT(*) FROM cuentas_por_pagar WHERE estado = 'Pendiente' AND fecha_vencimiento < %s", (hoy,))
        cuentas_vencidas = cursor.fetchone()[0] or 0

        return jsonify({
            'total_proveedores': total_proveedores,
            'total_ingresos': total_ingresos,
            'cuentas_pendientes': cuentas_pendientes,
            'cuentas_vencidas': cuentas_vencidas
        })
        
    except Exception as e:
        logging.error(f"Error en /api/dashboard-data: {str(e)}")
        return jsonify(error="Error interno del servidor"), 500
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            try:
                conn.close()
            except:
                pass

@bp.route('/api/revenue-data')
def revenue_data():
    if 'user_id' not in session:
        return jsonify(error="No autenticado"), 401

    conn = None
    cursor = None
    try:
        # Obtener parámetro de rango (month, quarter, year)
        range_type = request.args.get('range', 'month')
        
        conn = conectar()
        cursor = conn.cursor()
        
        current_year = datetime.now().year
        data = []
        
        if range_type == 'month':
            # Consulta para datos mensuales
            query = """
            SELECT 
                MONTH(fecha) AS period,
                DATE_FORMAT(fecha, '%b') AS period_name,
                SUM(total) AS total
            FROM ventas
            WHERE estado = 'completada' AND YEAR(fecha) = %s
            GROUP BY period, period_name
            ORDER BY period;
            """
            cursor.execute(query, (current_year,))
            results = cursor.fetchall()
            
            # Mapeo de nombres de meses en español
            month_translation = {
                'Jan': 'Ene', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Abr',
                'May': 'May', 'Jun': 'Jun', 'Jul': 'Jul', 'Aug': 'Ago',
                'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dic'
            }
            
            # Crear estructura completa de 12 meses
            for month_num in range(1, 13):
                month_short = datetime(current_year, month_num, 1).strftime('%b')
                month_short_es = month_translation.get(month_short)
                
                # Buscar si existe en resultados
                found = next((row for row in results if int(row[0]) == month_num), None)
                data.append({
                    "period": month_short_es,
                    "amount": float(found[2]) if found else 0.0
                })
        
        elif range_type == 'quarter':
            # Consulta para datos trimestrales
            query = """
            SELECT 
                QUARTER(fecha) AS quarter,
                SUM(total) AS total
            FROM ventas
            WHERE estado = 'completada' AND YEAR(fecha) = %s
            GROUP BY quarter
            ORDER BY quarter;
            """
            cursor.execute(query, (current_year,))
            results = cursor.fetchall()
            
            # Crear estructura para 4 trimestres
            for quarter_num in range(1, 5):
                # Buscar si existe en resultados
                found = next((row for row in results if int(row[0]) == quarter_num), None)
                data.append({
                    "period": f"T{quarter_num}",
                    "amount": float(found[1]) if found else 0.0
                })
        
        elif range_type == 'year':
            # Consulta para datos anuales (últimos 5 años)
            start_year = current_year - 4
            query = """
            SELECT 
                YEAR(fecha) AS year,
                SUM(total) AS total
            FROM ventas
            WHERE estado = 'completada' AND YEAR(fecha) BETWEEN %s AND %s
            GROUP BY year
            ORDER BY year;
            """
            cursor.execute(query, (start_year, current_year))
            results = cursor.fetchall()
            
            # Crear estructura para los últimos 5 años
            for year in range(start_year, current_year + 1):
                # Buscar si existe en resultados
                found = next((row for row in results if int(row[0]) == year), None)
                data.append({
                    "period": str(year),
                    "amount": float(found[1]) if found else 0.0
                })
        
        return jsonify({
            'range': range_type,
            'data': data
        })
        
    except Exception as e:
        logging.error(f"Error en /api/revenue-data: {str(e)}")
        return jsonify(error="Error interno del servidor"), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            try:
                conn.close()
            except:
                pass