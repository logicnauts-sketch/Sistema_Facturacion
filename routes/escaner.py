from flask import Blueprint, render_template, request, jsonify, session
from datetime import datetime
from utils import login_required

bp = Blueprint('escaner', __name__)

# En una aplicación real, usarías una base de datos
# Por simplicidad, usamos un diccionario en memoria
codigos_almacenamiento = {}

def obtener_codigos_usuario():
    """Obtiene la lista de códigos del usuario actual"""
    user_id = session.get('user_id', 'default')
    if user_id not in codigos_almacenamiento:
        codigos_almacenamiento[user_id] = []
    return codigos_almacenamiento[user_id]

@bp.route('/escaner')
@login_required
def escaner():
    return render_template("escaner.html")

@bp.route('/escaner/procesar', methods=['POST'])
@login_required
def procesar_codigo():
    try:
        data = request.get_json()
        codigo = data.get('codigo', '').strip()
        
        if not codigo:
            return jsonify({'success': False, 'message': 'Código vacío'})
        
        # Simular búsqueda en base de datos de productos
        producto_info = simular_busqueda_producto(codigo)
        
        # Guardar el código escaneado
        nuevo_codigo = {
            'codigo': codigo,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'procesado': True,
            'producto': producto_info['nombre'],
            'precio': producto_info['precio'],
            'categoria': producto_info['categoria']
        }
        
        codigos_usuario = obtener_codigos_usuario()
        codigos_usuario.insert(0, nuevo_codigo)
        
        # Mantener solo los últimos 50 códigos
        if len(codigos_usuario) > 50:
            codigos_usuario.pop()
        
        return jsonify({
            'success': True, 
            'message': f'Código {codigo} procesado correctamente',
            'producto': nuevo_codigo['producto'],
            'precio': nuevo_codigo['precio'],
            'categoria': nuevo_codigo['categoria']
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

@bp.route('/escaner/codigos', methods=['GET'])
@login_required
def obtener_codigos():
    try:
        codigos_usuario = obtener_codigos_usuario()
        return jsonify({'success': True, 'codigos': codigos_usuario})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

@bp.route('/escaner/limpiar', methods=['POST'])
@login_required
def limpiar_codigos():
    try:
        user_id = session.get('user_id', 'default')
        if user_id in codigos_almacenamiento:
            codigos_almacenamiento[user_id] = []
        return jsonify({'success': True, 'message': 'Lista de códigos limpiada'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

def simular_busqueda_producto(codigo):
    """Simula la búsqueda de un producto en la base de datos"""
    # En una aplicación real, esto buscaría en tu base de datos
    productos_simulados = {
        '1234567890123': {'nombre': 'Laptop HP 15"', 'precio': 899.99, 'categoria': 'Electrónicos'},
        '2345678901234': {'nombre': 'Mouse Inalámbrico', 'precio': 25.50, 'categoria': 'Accesorios'},
        '3456789012345': {'nombre': 'Teclado Mecánico', 'precio': 89.99, 'categoria': 'Accesorios'},
        '4567890123456': {'nombre': 'Monitor 24" LED', 'precio': 199.99, 'categoria': 'Electrónicos'},
        '5678901234567': {'nombre': 'Impresora Laser', 'precio': 299.99, 'categoria': 'Oficina'},
        '6789012345678': {'nombre': 'Tablet Samsung', 'precio': 349.99, 'categoria': 'Electrónicos'},
        '7890123456789': {'nombre': 'Smartphone Android', 'precio': 499.99, 'categoria': 'Electrónicos'},
        '8901234567890': {'nombre': 'Auriculares Bluetooth', 'precio': 79.99, 'categoria': 'Audio'},
        '9012345678901': {'nombre': 'Cargador USB-C', 'precio': 19.99, 'categoria': 'Accesorios'},
        '0123456789012': {'nombre': 'Fundas para Laptop', 'precio': 29.99, 'categoria': 'Accesorios'},
    }
    
    # Si el código existe en nuestros productos simulados, devolverlo
    if codigo in productos_simulados:
        return productos_simulados[codigo]
    
    # Si no existe, generar un producto genérico basado en el código
    return {
        'nombre': f'Producto {codigo[-6:]}',
        'precio': float(f"{int(codigo[-4:]) % 1000}.{int(codigo[-2:]) % 99}"),
        'categoria': 'General'
    }