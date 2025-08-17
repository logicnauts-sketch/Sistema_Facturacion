from flask import Blueprint, render_template, jsonify, request
import serial
import serial.tools.list_ports
from conexion import conectar  # Importar tu función de conexión
from utils import login_required, solo_admin_required

bp = Blueprint('verifone', __name__, url_prefix='/verifone')

@bp.route('/')
@login_required
@solo_admin_required
def verifone():
    return render_template('verifone.html')

@bp.route('/detectar')
def detectar_verifone():
    try:
        puertos = serial.tools.list_ports.comports()
        dispositivos = []
        
        for puerto in puertos:
            descripcion = (puerto.description or '').lower()
            fabricante = (puerto.manufacturer or '').lower()
            
            if "verifone" in descripcion or "verifone" in fabricante:
                dispositivos.append({
                    "port": puerto.device,
                    "description": puerto.description,
                    "manufacturer": puerto.manufacturer
                })
                
        return jsonify(dispositivos)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/probar', methods=['POST'])
def probar_dispositivo():
    data = request.get_json()
    port = data.get('port')
    baudrate = data.get('baudrate', 9600)

    if not port:
        return jsonify({"success": False, "error": "Puerto no especificado"}), 400

    try:
        with serial.Serial(port, baudrate=baudrate, timeout=2) as ser:
            # Comando de prueba para Verifone
            ser.write(b'\x1B\x61\x31')  # Ejemplo de comando ESC/POS
            response = ser.read(2)  # Leer respuesta
            
            if response:
                return jsonify({"success": True})
            else:
                return jsonify({"success": False, "error": "Sin respuesta del dispositivo"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Endpoints para gestión de impresoras con base de datos
@bp.route('/impresoras', methods=['GET'])
def listar_impresoras():
    try:
        conn = conectar()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, nombre, vendor, product, port, baudrate FROM impresoras")
        impresoras = cursor.fetchall()
        
        cursor.close()
        conn.close()
        return jsonify(impresoras)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/impresoras', methods=['POST'])
def agregar_impresora():
    data = request.get_json()
    if not data or 'nombre' not in data or 'vendor' not in data or 'product' not in data:
        return jsonify({"error": "Datos incompletos"}), 400
    
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO impresoras (nombre, vendor, product, port, baudrate) VALUES (%s, %s, %s, %s, %s)",
            (data['nombre'], data['vendor'], data['product'], data.get('port'), data.get('baudrate', 9600))
        )
        conn.commit()
        nueva_id = cursor.lastrowid
        cursor.close()
        conn.close()
        
        return jsonify({
            "id": nueva_id,
            "nombre": data['nombre'],
            "vendor": data['vendor'],
            "product": data['product'],
            "port": data.get('port'),
            "baudrate": data.get('baudrate', 9600)
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/impresoras/<int:id>', methods=['PUT'])
def actualizar_impresora(id):
    data = request.get_json()
    try:
        conn = conectar()
        cursor = conn.cursor()
        
        cursor.execute(
            "UPDATE impresoras SET nombre = %s, vendor = %s, product = %s, port = %s, baudrate = %s WHERE id = %s",
            (data.get('nombre'), data.get('vendor'), data.get('product'), 
             data.get('port'), data.get('baudrate'), id)
        )
        
        if cursor.rowcount == 0:
            return jsonify({"error": "Impresora no encontrada"}), 404
            
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/impresoras/<int:id>', methods=['DELETE'])
def eliminar_impresora(id):
    try:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM impresoras WHERE id = %s", (id,))
        
        if cursor.rowcount == 0:
            return jsonify({"error": "Impresora no encontrada"}), 404
            
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500