from flask import Blueprint, jsonify, request, render_template
from conexion import conectar
from utils import login_required, solo_admin_required

bp = Blueprint('impresoras', __name__, url_prefix='/impresoras')

@bp.route('/')
@login_required
@solo_admin_required
def impresora():
    """Renderiza la página principal de gestión de impresoras."""
    return render_template('impresoras.html')

# API: Listar todas las impresoras
@bp.route('/api', methods=['GET'])
def listar_impresoras():
    conn = conectar()
    cur = conn.cursor()
    cur.execute("SELECT * FROM printers")
    impresoras = cur.fetchall()
    cur.close()
    conn.close()
    
    # Convertir a lista de diccionarios
    result = []
    for imp in impresoras:
        result.append({
            "id": imp[0],
            "nombre": imp[1],
            "tipo": imp[2],
            "modelo": imp[3],
            "ip": imp[4],
            "ubicacion": imp[5],
            "estado": imp[6],
            "vendor_id": imp[7],
            "product_id": imp[8]
        })
    
    return jsonify(result)

# Obtener una impresora por ID
@bp.route('/api/<int:id>', methods=['GET'])
def obtener_impresora(id):
    conn = conectar()
    cur = conn.cursor()
    cur.execute("SELECT * FROM printers WHERE id = %s", (id,))
    impresora = cur.fetchone()
    cur.close()
    conn.close()
    
    if not impresora:
        return jsonify({"error": "Impresora no encontrada"}), 404
    
    return jsonify({
        "id": impresora[0],
        "nombre": impresora[1],
        "tipo": impresora[2],
        "modelo": impresora[3],
        "ip": impresora[4],
        "ubicacion": impresora[5],
        "estado": impresora[6],
        "vendor_id": impresora[7],
        "product_id": impresora[8]
    })

# Crear una nueva impresora
@bp.route('/api', methods=['POST'])
def crear_impresora():
    data = request.get_json()
    conn = conectar()
    cur = conn.cursor()
    
    try:
        cur.execute(
            "INSERT INTO printers (nombre, tipo, modelo, ip, ubicacion, estado, vendor_id, product_id) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (
                data.get('nombre'),
                data.get('tipo'),
                data.get('modelo'),
                data.get('ip'),
                data.get('ubicacion'),
                data.get('estado', 'Conectado'),
                data.get('vendor_id'),
                data.get('product_id')
            )
        )
        conn.commit()
        return jsonify({"success": True, "id": cur.lastrowid}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        cur.close()
        conn.close()

# Actualizar una impresora existente
@bp.route('/api/<int:id>', methods=['PUT'])
def actualizar_impresora(id):
    data = request.get_json()
    conn = conectar()
    cur = conn.cursor()
    
    try:
        cur.execute(
            "UPDATE printers SET "
            "nombre = %s, tipo = %s, modelo = %s, ip = %s, "
            "ubicacion = %s, estado = %s, vendor_id = %s, product_id = %s "
            "WHERE id = %s",
            (
                data.get('nombre'),
                data.get('tipo'),
                data.get('modelo'),
                data.get('ip'),
                data.get('ubicacion'),
                data.get('estado', 'Conectado'),
                data.get('vendor_id'),
                data.get('product_id'),
                id
            )
        )
        conn.commit()
        return jsonify({"success": True}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        cur.close()
        conn.close()

# Eliminar una impresora
@bp.route('/api/<int:id>', methods=['DELETE'])
def eliminar_impresora(id):
    conn = conectar()
    cur = conn.cursor()
    
    try:
        cur.execute("DELETE FROM printers WHERE id = %s", (id,))
        conn.commit()
        return jsonify({"success": True}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        cur.close()
        conn.close()

@bp.route('/api/<int:id>/toggle-active', methods=['POST'])
def toggle_active_printer(id):
    conn = conectar()
    cur = conn.cursor()
    
    try:
        # Primero desactivar todas las impresoras
        cur.execute("UPDATE printers SET activa = FALSE")
        
        # Luego activar la impresora seleccionada
        cur.execute("UPDATE printers SET activa = TRUE WHERE id = %s", (id,))
        conn.commit()
        
        return jsonify({"success": True}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 400
    finally:
        cur.close()
        conn.close()