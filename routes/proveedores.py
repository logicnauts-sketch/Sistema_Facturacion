from flask import Blueprint, render_template, jsonify, request
from conexion import conectar

bp = Blueprint('proveedores', __name__)

@bp.route('/proveedores')
def proveedores():
    return render_template("proveedores.html")

# CRUD Proveedores
@bp.route('/api/proveedores', methods=['GET'])
def obtener_proveedores():
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, nombre, rnc_cedula, telefono, email, estado FROM proveedores")
        proveedores = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(proveedores)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/api/proveedores', methods=['POST'])
def crear_proveedor():
    try:
        data = request.get_json()
        conn = conectar()
        cursor = conn.cursor()
        
        sql = """
        INSERT INTO proveedores 
        (nombre, rnc_cedula, telefono, email, estado, direccion) 
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        valores = (
            data['nombre'],
            data['rnc_cedula'],
            data.get('telefono', ''),
            data['email'],
            data.get('estado', 'Activo'),
            data.get('direccion', '')
        )
        
        cursor.execute(sql, valores)
        conn.commit()
        nuevo_id = cursor.lastrowid
        cursor.close()
        conn.close()
        
        return jsonify({"success": True, "id": nuevo_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/api/proveedores/<int:id>', methods=['PUT'])
def actualizar_proveedor(id):
    try:
        data = request.get_json()
        conn = conectar()
        cursor = conn.cursor()
        
        sql = """
        UPDATE proveedores SET
        nombre = %s,
        rnc_cedula = %s,
        telefono = %s,
        email = %s,
        estado = %s,
        direccion = %s
        WHERE id = %s
        """
        valores = (
            data['nombre'],
            data['rnc_cedula'],
            data.get('telefono', ''),
            data['email'],
            data.get('estado', 'Activo'),
            data.get('direccion', ''),
            id
        )
        
        cursor.execute(sql, valores)
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/api/proveedores/<int:id>', methods=['DELETE'])
def eliminar_proveedor(id):
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM proveedores WHERE id = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# CRUD Cuentas por Pagar
@bp.route('/api/cuentas_por_pagar', methods=['GET'])
def obtener_cuentas_por_pagar():
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                c.id, 
                p.nombre AS proveedor, 
                c.numero_factura, 
                c.fecha_vencimiento, 
                c.monto, 
                c.estado
            FROM cuentas_por_pagar c
            JOIN proveedores p ON c.proveedor_id = p.id
            WHERE c.estado = 'Pendiente'  -- Solo facturas pendientes
        """)
        cuentas = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(cuentas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/api/cuentas_por_pagar', methods=['POST'])
def crear_cuenta_por_pagar():
    try:
        data = request.get_json()
        conn = conectar()
        cursor = conn.cursor()
        
        sql = """
        INSERT INTO cuentas_por_pagar 
        (proveedor_id, numero_factura, fecha_emision, fecha_vencimiento, monto, estado, descripcion) 
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        valores = (
            data['proveedor_id'],
            data['numero_factura'],
            data['fecha_emision'],
            data['fecha_vencimiento'],
            data['monto'],
            data.get('estado', 'Pendiente'),
            data.get('descripcion', '')
        )
        
        cursor.execute(sql, valores)
        conn.commit()
        nuevo_id = cursor.lastrowid
        cursor.close()
        conn.close()
        
        return jsonify({"success": True, "id": nuevo_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/api/cuentas_por_pagar/<int:id>', methods=['PUT'])
def actualizar_cuenta_por_pagar(id):
    try:
        data = request.get_json()
        conn = conectar()
        cursor = conn.cursor()
        
        sql = """
        UPDATE cuentas_por_pagar SET
        proveedor_id = %s,
        numero_factura = %s,
        fecha_emision = %s,
        fecha_vencimiento = %s,
        monto = %s,
        estado = %s,
        descripcion = %s
        WHERE id = %s
        """
        valores = (
            data['proveedor_id'],
            data['numero_factura'],
            data['fecha_emision'],
            data['fecha_vencimiento'],
            data['monto'],
            data.get('estado', 'Pendiente'),
            data.get('descripcion', ''),
            id
        )
        
        cursor.execute(sql, valores)
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/api/cuentas_por_pagar/<int:id>', methods=['DELETE'])
def eliminar_cuenta_por_pagar(id):
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cuentas_por_pagar WHERE id = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/api/cuentas_por_pagar/pagar/<int:id>', methods=['POST'])
def marcar_como_pagada(id):
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("UPDATE cuentas_por_pagar SET estado = 'Pagado' WHERE id = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Obtener un proveedor por ID
@bp.route('/api/proveedores/<int:id>', methods=['GET'])
def obtener_proveedor(id):
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM proveedores WHERE id = %s", (id,))
        proveedor = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify(proveedor)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Obtener cuentas por pagar de un proveedor
@bp.route('/api/proveedores/<int:id>/cuentas', methods=['GET'])
def obtener_cuentas_proveedor(id):
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, numero_factura, fecha_emision, fecha_vencimiento, monto, estado
            FROM cuentas_por_pagar
            WHERE proveedor_id = %s
        """, (id,))
        cuentas = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(cuentas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Nueva ruta para estadísticas de proveedores
@bp.route('/api/proveedores/stats')
def obtener_estadisticas_proveedores():
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        
        # Total de proveedores activos
        cursor.execute("SELECT COUNT(*) AS total FROM proveedores WHERE estado = 'Activo'")
        total_proveedores = cursor.fetchone()['total']
        
        # Total de facturas pendientes
        cursor.execute("SELECT COUNT(*) AS total FROM cuentas_por_pagar WHERE estado = 'Pendiente'")
        total_facturas_pendientes = cursor.fetchone()['total']
        
        # Suma de montos pendientes
        cursor.execute("SELECT SUM(monto) AS total FROM cuentas_por_pagar WHERE estado = 'Pendiente'")
        total_monto_pendiente = cursor.fetchone()['total'] or 0
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "proveedores_activos": total_proveedores,
            "facturas_pendientes": total_facturas_pendientes,
            "total_por_pagar": total_monto_pendiente
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500