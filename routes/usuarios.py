# routes/usuarios.py
from flask import Blueprint, render_template, request, jsonify
from conexion import conectar
from werkzeug.security import generate_password_hash
import re

bp = Blueprint('usuarios', __name__)

@bp.route('/usuarios')
def usuarios():
    return render_template("usuarios.html")

@bp.route('/usuarios/data')
def usuarios_data():
    estado_filter = request.args.get('estado')  # 'Activo' | 'Inactivo' | 'all' | None
    conn = conectar()
    cursor = conn.cursor()
    try:
        base_sql = """
            SELECT id, nombre_completo, email, rol,
                   DATE_FORMAT(creado_en, '%d/%m/%Y') AS creado_en,
                   CASE WHEN activo = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado
            FROM usuarios
        """
        params = ()
        if estado_filter and estado_filter.lower() != 'all':
            if estado_filter.lower() == 'activo':
                base_sql += " WHERE activo = %s"
                params = (1,)
            elif estado_filter.lower() == 'inactivo':
                base_sql += " WHERE activo = %s"
                params = (0,)

        cursor.execute(base_sql, params)
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
        return jsonify(usuarios)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@bp.route('/usuarios', methods=['POST'])
def crear_usuario():
    data = request.get_json() or {}
    # validaciones mínimas
    nombre = data.get('nombre', '').strip()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    rol = data.get('rol', 'empleado')
    estado = 1 if data.get('estado') == 'Activo' else 0
    password = data.get('password', '')

    if not nombre or not username or not email or not password:
        return jsonify(success=False, error="Faltan campos obligatorios"), 400
    if len(password) < 6:
        return jsonify(success=False, error="La contraseña debe tener al menos 6 caracteres"), 400

    hashed_password = generate_password_hash(password)

    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO usuarios (nombre_completo, username, email, rol, activo, password) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (nombre, username, email, rol, estado, hashed_password)
        )
        conn.commit()
        return jsonify(success=True, user_id=cursor.lastrowid), 201
    except Exception as err:
        # detectar duplicados (mensaje típico: Duplicate entry 'X' for key 'username')
        msg = str(err)
        if 'Duplicate' in msg or 'duplicate' in msg:
            return jsonify(success=False, error="El username o email ya existe"), 409
        return jsonify(success=False, error=msg), 400
    finally:
        cursor.close()
        conn.close()


@bp.route('/usuarios/<int:user_id>', methods=['GET'])
def obtener_usuario(user_id):
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, nombre_completo AS nombre, username, email, rol,
                   CASE WHEN activo = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado
            FROM usuarios WHERE id = %s
        """, (user_id,))
        row = cursor.fetchone()
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
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        cursor.close()
        conn.close()


@bp.route('/usuarios/<int:user_id>', methods=['PUT'])
def actualizar_usuario(user_id):
    data = request.get_json() or {}
    nombre = data.get('nombre', '').strip()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    rol = data.get('rol', 'empleado')
    estado = 1 if data.get('estado') == 'Activo' else 0

    if not nombre or not username or not email:
        return jsonify(success=False, error="Faltan campos obligatorios"), 400

    new_password = data.get('password')
    conn = conectar()
    cursor = conn.cursor()
    try:
        if new_password:
            if len(new_password) < 6:
                return jsonify(success=False, error="La contraseña debe tener al menos 6 caracteres"), 400
            hashed_password = generate_password_hash(new_password)
            cursor.execute(
                "UPDATE usuarios SET nombre_completo = %s, username = %s, email = %s, rol = %s, activo = %s, password = %s WHERE id = %s",
                (nombre, username, email, rol, estado, hashed_password, user_id)
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET nombre_completo = %s, username = %s, email = %s, rol = %s, activo = %s WHERE id = %s",
                (nombre, username, email, rol, estado, user_id)
            )
        conn.commit()
        return jsonify(success=True)
    except Exception as err:
        msg = str(err)
        if 'Duplicate' in msg or 'duplicate' in msg:
            return jsonify(success=False, error="El username o email ya existe"), 409
        return jsonify(success=False, error=msg), 400
    finally:
        cursor.close()
        conn.close()


@bp.route('/usuarios/<int:user_id>', methods=['DELETE'])
def eliminar_usuario(user_id):
    conn = conectar()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM usuarios WHERE id = %s", (user_id,))
        conn.commit()
        return jsonify(success=True)
    except Exception as err:
        return jsonify(success=False, error=str(err)), 400
    finally:
        cursor.close()
        conn.close()
