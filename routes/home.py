from flask import Blueprint, render_template, redirect, session,url_for, jsonify
from conexion import conectar
from datetime import datetime
import logging

bp = Blueprint('home', __name__)

@bp.route('/')
def inicio():
    # Verificar si el usuario ya está autenticado
    if 'user_id' in session:
        return redirect('/home')
    else:
        return redirect(url_for('login.login'))


@bp.route('/home')
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

        cursor.execute("SELECT SUM(total) FROM facturas WHERE tipo = 'venta'")
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