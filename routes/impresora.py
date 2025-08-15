# impresoras.py

from flask import Blueprint, render_template, jsonify, request
import platform
import subprocess
import json
from conexion import conectar  # tu módulo de conexión a MariaDB

bp = Blueprint('impresoras', __name__, url_prefix='/impresoras')

@bp.route('/')
def impresora():
    """Renderiza la página principal de gestión de impresoras."""
    return render_template('impresoras.html')

@bp.route('/scan', methods=['GET'])
def buscar_impresoras():
    """
    Escanea el sistema operativo en busca de impresoras,
    y devuelve un JSON con todos los resultados.
    """
    sistema = platform.system()
    impresoras = []

    if sistema == 'Windows':
        impresoras = obtener_impresoras_windows()
    elif sistema == 'Linux':
        impresoras = obtener_impresoras_linux()
    elif sistema == 'Darwin':  # macOS
        impresoras = obtener_impresoras_macos()

    # Ahora devolvemos todas las impresoras detectadas
    return jsonify(impresoras)

@bp.route('/guardar', methods=['POST'])
def guardar_impresora():
    data = request.get_json()
    conn = conectar()
    cur = conn.cursor()

    # Borrar cualquier registro previo
    cur.execute("DELETE FROM printers")

    # Insertar la nueva impresora
    cur.execute(
        """
        INSERT INTO printers (nombre, tipo, modelo, ip, ubicacion, estado)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            data.get('nombre', ''),
            data.get('tipo', ''),
            data.get('modelo', ''),
            data.get('ip', ''),
            data.get('ubicacion', ''),
            data.get('estado', '')
        )
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True, "message": "Impresora guardada correctamente"})

@bp.route('/guardada', methods=['GET'])
def obtener_impresora_guardada():
    conn = conectar()
    cur = conn.cursor()
    cur.execute("SELECT id, nombre, tipo, modelo, ip, ubicacion, estado FROM printers LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify(None), 204

    impresora = {
        "id":        row[0],
        "nombre":    row[1],
        "tipo":      row[2],
        "modelo":    row[3],
        "ip":        row[4],
        "ubicacion": row[5],
        "estado":    row[6],
    }
    return jsonify(impresora)

# —— Helpers de detección por plataforma ——

def obtener_impresoras_windows():
    impresoras = []
    try:
        cmd = [
            'powershell',
            '-Command',
            'Get-Printer | Select-Object Name, PrinterStatus, PortName | ConvertTo-Json'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        printers = json.loads(result.stdout)
        for p in printers:
            impresoras.append({
                'nombre':    p.get('Name', ''),
                'tipo':      'Desconocido',
                'modelo':    'Desconocido',
                'ip':        p.get('PortName', ''),
                'ubicacion': 'Oficina',
                'estado':    str(p.get('PrinterStatus', ''))
            })
    except Exception as e:
        print(f"Error Windows scan: {e}")
    return impresoras

def obtener_impresoras_linux():
    impresoras = []
    try:
        result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True, check=True)
        for line in result.stdout.splitlines():
            if line.startswith('printer '):
                parts = line.split()
                name = parts[1]
                status = 'Conectado' if 'enabled' in line else 'Desconectado'
                uri = subprocess.run(['lpstat', '-v', name], capture_output=True, text=True)
                uri_txt = uri.stdout.lower()
                tipo = ('USB' if 'usb' in uri_txt 
                        else 'Red' if 'socket' in uri_txt 
                        else 'Bluetooth' if 'bluetooth' in uri_txt 
                        else 'Desconocido')
                impresoras.append({
                    'nombre':    name,
                    'tipo':      tipo,
                    'modelo':    'Desconocido',
                    'ip':        'N/A',
                    'ubicacion': 'Oficina',
                    'estado':    status
                })
    except Exception as e:
        print(f"Error Linux scan: {e}")
    return impresoras

def obtener_impresoras_macos():
    impresoras = []
    try:
        result = subprocess.run(['system_profiler', 'SPUSBDataType', '-json'],
                                capture_output=True, text=True, check=True)
        usb = json.loads(result.stdout).get('SPUSBDataType', [])
        for device in usb:
            name = device.get('_name', '')
            impresoras.append({
                'nombre':    name,
                'tipo':      'USB',
                'modelo':    device.get('product_id', 'Desconocido'),
                'ip':        'N/A',
                'ubicacion': 'Oficina',
                'estado':    'Conectado'
            })
        lp = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
        for line in lp.stdout.splitlines():
            if line.startswith('printer '):
                parts = line.split()
                name = parts[1]
                status = 'Activa' if 'enabled' in line else 'Inactiva'
                impresoras.append({
                    'nombre':    name,
                    'tipo':      'Red',
                    'modelo':    'Desconocido',
                    'ip':        'N/A',
                    'ubicacion': 'Oficina',
                    'estado':    status
                })
    except Exception as e:
        print(f"Error macOS scan: {e}")
    return impresoras
