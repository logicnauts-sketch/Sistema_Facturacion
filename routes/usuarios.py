from flask import Blueprint, render_template, request, jsonify, session
from conexion import conectar
from werkzeug.security import generate_password_hash
import mariadb

bp = Blueprint('usuarios', __name__)

@bp.route('/usuarios')
def usuarios():
    return render_template("usuarios.html")

@bp.route('/usuarios/data')
def usuarios_data():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, nombre_completo, email, rol, 
               DATE_FORMAT(creado_en, '%d/%m/%Y') AS creado_en,
               CASE WHEN activo = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado
        FROM usuarios
    """)
    rows = cursor.fetchall()
    usuarios = [
        {
            "id": row[0],
            "nombre_completo": row[1],
            "email": row[2],
            "rol": row[3],
            "creado_en": row[4],
            "estado": row[5],
        }
        for row in rows
    ]
    cursor.close()
    conn.close()
    return jsonify(usuarios)

@bp.route('/usuarios', methods=['POST'])
def crear_usuario():
    data = request.get_json()
    print("Datos recibidos:", data)
    nombre = data['nombre']
    username = data['username']
    email = data['email']
    rol = data['rol']
    estado = 1 if data['estado'] == 'Activo' else 0
    password = data['password']
    
    # Cambia esto: usa generate_password_hash de Werkzeug
    hashed_password = generate_password_hash(password)
    
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO usuarios (nombre_completo, username, email, rol, activo, password) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (nombre, username, email, rol, estado, hashed_password)
        )
        conn.commit()
        return jsonify(success=True)
    except mariadb.Error as err:
        return jsonify(success=False, error=str(err)), 400
    finally:
        cursor.close()
        conn.close()

@bp.route('/usuarios/<int:user_id>', methods=['GET'])
def obtener_usuario(user_id):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, nombre_completo AS nombre, username, email, rol, 
               CASE WHEN activo = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado
        FROM usuarios WHERE id = ?
    """, (user_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if row:
        usuario = {
            "id": row[0],
            "nombre": row[1],
            "username": row[2],
            "email": row[3],
            "rol": row[4],
            "estado": row[5]
        }
        return jsonify(usuario)
    return jsonify(error="Usuario no encontrado"), 404

@bp.route('/usuarios/<int:user_id>', methods=['PUT'])
def actualizar_usuario(user_id):
    data = request.get_json()
    nombre = data['nombre']
    username = data['username']
    email = data['email']
    rol = data['rol']
    estado = 1 if data['estado'] == 'Activo' else 0
    
    # Comprueba si se proporcionó una nueva contraseña
    new_password = data.get('password')
    password_update = ""
    if new_password:
        hashed_password = generate_password_hash(new_password)
        password_update = ", password = ?"
    
    conn = conectar()
    cursor = conn.cursor()
    try:
        if password_update:
            cursor.execute(
                f"UPDATE usuarios SET nombre_completo = ?, username = ?, email = ?, "
                f"rol = ?, activo = ?{password_update} WHERE id = ?",
                (nombre, username, email, rol, estado, hashed_password, user_id)
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET nombre_completo = ?, username = ?, email = ?, "
                "rol = ?, activo = ? WHERE id = ?",
                (nombre, username, email, rol, estado, user_id)
            )
        conn.commit()
        return jsonify(success=True)
    except mariadb.Error as err:
        return jsonify(success=False, error=str(err)), 400
    finally:
        cursor.close()
        conn.close()

@bp.route('/usuarios/<int:user_id>', methods=['DELETE'])
def eliminar_usuario(user_id):
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM usuarios WHERE id = ?", (user_id,))
        conn.commit()
        return jsonify(success=True)
    except mariadb.Error as err:
        return jsonify(success=False, error=str(err)), 400
    finally:
        cursor.close()
        conn.close()
