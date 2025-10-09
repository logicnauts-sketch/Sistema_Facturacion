from flask import Blueprint, render_template, request, jsonify, session
from conexion import conectar, obtener_ip_agente, guardar_ip_agente
from utils import login_required, solo_admin_required

bp = Blueprint('configuracion', __name__)

@bp.route('/configuracion/agente', methods=['GET', 'POST'])
@login_required
@solo_admin_required
def configurar_agente():
    if request.method == 'POST':
        ip_agente = request.form.get('ip_agente')
        if ip_agente:
            if guardar_ip_agente(ip_agente):
                return jsonify({'success': True, 'message': 'IP del agente guardada correctamente'})
            else:
                return jsonify({'success': False, 'message': 'Error al guardar la IP del agente'})
        return jsonify({'success': False, 'message': 'Debe proporcionar una IP válida'})
    
    # GET - Mostrar página de configuración
    ip_actual = obtener_ip_agente()
    return render_template('configuracion_agente.html', ip_agente=ip_actual)

@bp.route('/api/configuracion/agente', methods=['GET'])
@login_required
def obtener_configuracion_agente():
    ip_agente = obtener_ip_agente()
    return jsonify({'ip_agente': ip_agente})