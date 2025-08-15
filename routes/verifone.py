from flask import Blueprint, render_template, jsonify, request
import serial
import serial.tools.list_ports

bp = Blueprint('verifone', __name__, url_prefix='/verifone')

@bp.route('/')
def verifone():
    return render_template('verifone.html')

@bp.route('/detectar')
def detectar_verifone():
    dispositivos = []
    try:
        puertos = serial.tools.list_ports.comports()
        for puerto in puertos:
            descripcion = puerto.description.lower()
            fabricante = (puerto.manufacturer or '').lower()
            if "verifone" in descripcion or "verifone" in fabricante:
                dispositivos.append({
                    "port": puerto.device,
                    "description": puerto.description
                })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(dispositivos)

@bp.route('/probar', methods=['POST'])
def probar_dispositivo():
    data = request.get_json()
    port = data.get('port')

    if not port:
        return jsonify({"success": False, "error": "Puerto no especificado"}), 400

    try:
        # Configuración típica, puede variar según el modelo
        with serial.Serial(port, baudrate=9600, timeout=2) as ser:
            # Comando de prueba. Esto debe ser adaptado a tu modelo Verifone
            mensaje = b'TEST\n'
            ser.write(mensaje)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
