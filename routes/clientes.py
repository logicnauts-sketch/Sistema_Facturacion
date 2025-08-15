from flask import Blueprint, render_template, jsonify, request
from datetime import datetime, timedelta
import random
from utils import login_required
from utils import solo_admin_required

bp = Blueprint('clientes', __name__)

# Datos de ejemplo (simulando una base de datos)
mock_clients = []
for i in range(1, 21):
    client_type = ['Normal', 'Frecuente', 'Crédito'][i % 3]
    mock_clients.append({
        'id': i,
        'nombre': f'Cliente {i}',
        'cedula': f'00{i % 3}-{1234567 + i}-{i % 10}',
        'telefono': f'809-{(5550000 + i) // 1000}-{(5550000 + i) % 1000:03}',
        'direccion': f'Calle #{i}, Ciudad',
        'correo': f'cliente{i}@example.com',
        'tipo': client_type,
        'fechaRegistro': (datetime.now() - timedelta(days=random.randint(1, 365))).isoformat()
    })

# Historial de compras de ejemplo
def generate_purchase_history(client_id):
    history = []
    for i in range(1, 9):
        history.append({
            'id': i,
            'fecha': (datetime.now() - timedelta(days=random.randint(1, 30))).strftime('%d/%m/%Y'),
            'factura': f'FAC-00{i}',
            'productos': random.randint(1, 10),
            'monto': round(random.uniform(100, 1000), 2)
        })
    return history

@bp.route('/clientes')
@solo_admin_required
@login_required
def clientes():
    return render_template("clientes.html")

# API Endpoints
@bp.route('/api/clientes', methods=['GET'])
def api_get_clientes():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    search = request.args.get('search', '').lower()
    
    # Filtrar por búsqueda
    filtered_clients = mock_clients
    if search:
        filtered_clients = [c for c in mock_clients if search in c['nombre'].lower() or search in c['cedula'].lower()]
    
    # Paginación
    start = (page - 1) * per_page
    end = start + per_page
    paginated_clients = filtered_clients[start:end]
    
    return jsonify({
        'success': True,
        'clients': paginated_clients,
        'total': len(filtered_clients),
        'page': page,
        'per_page': per_page
    })

@bp.route('/api/clientes/<int:client_id>', methods=['GET'])
def api_get_client(client_id):
    client = next((c for c in mock_clients if c['id'] == client_id), None)
    if client:
        return jsonify({'success': True, 'client': client})
    return jsonify({'success': False, 'message': 'Cliente no encontrado'}), 404

@bp.route('/api/clientes', methods=['POST'])
def api_create_client():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'Datos no proporcionados'}), 400
    
    # Validar campos obligatorios
    required_fields = ['nombre', 'cedula', 'telefono', 'direccion', 'correo', 'tipo']
    if not all(field in data for field in required_fields):
        return jsonify({'success': False, 'message': 'Faltan campos obligatorios'}), 400
    
    # Crear nuevo cliente
    new_id = max(c['id'] for c in mock_clients) + 1
    new_client = {
        'id': new_id,
        'nombre': data['nombre'],
        'cedula': data['cedula'],
        'telefono': data['telefono'],
        'direccion': data['direccion'],
        'correo': data['correo'],
        'tipo': data['tipo'],
        'fechaRegistro': datetime.now().isoformat()
    }
    mock_clients.insert(0, new_client)
    
    return jsonify({'success': True, 'client': new_client}), 201

@bp.route('/api/clientes/<int:client_id>', methods=['PUT'])
def api_update_client(client_id):
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'Datos no proporcionados'}), 400
    
    client = next((c for c in mock_clients if c['id'] == client_id), None)
    if not client:
        return jsonify({'success': False, 'message': 'Cliente no encontrado'}), 404
    
    # Actualizar campos
    client.update(data)
    
    return jsonify({'success': True, 'client': client})

@bp.route('/api/clientes/<int:client_id>', methods=['DELETE'])
def api_delete_client(client_id):
    global mock_clients
    initial_length = len(mock_clients)
    mock_clients = [c for c in mock_clients if c['id'] != client_id]
    
    if len(mock_clients) < initial_length:
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Cliente no encontrado'}), 404

@bp.route('/api/clientes/<int:client_id>/historial', methods=['GET'])
def api_get_purchase_history(client_id):
    # Verificar si el cliente existe
    client = next((c for c in mock_clients if c['id'] == client_id), None)
    if not client:
        return jsonify({'success': False, 'message': 'Cliente no encontrado'}), 404
    
    history = generate_purchase_history(client_id)
    return jsonify({
        'success': True,
        'history': history,
        'client': client
    }), 200