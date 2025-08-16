# impresoras.py
from flask import Blueprint, render_template, jsonify, request
import platform
import subprocess
import json
import usb.core
import usb.util
from conexion import conectar  # tu módulo de conexión a MariaDB
import re

bp = Blueprint('impresoras', __name__, url_prefix='/impresoras')

RE_VID_PID = re.compile(r'VID_?([0-9A-Fa-f]{4}).*PID_?([0-9A-Fa-f]{4})', re.IGNORECASE)

# —— Rutas principales ——

@bp.route('/')
def impresora():
    """Renderiza la página principal de gestión de impresoras."""
    return render_template('impresoras.html')


@bp.route('/scan', methods=['GET'])
def buscar_impresoras():
    """Escanea el sistema operativo en busca de impresoras y devuelve un JSON."""
    sistema = platform.system()
    impresoras = []

    if sistema == 'Windows':
        impresoras = obtener_impresoras_windows()
    elif sistema == 'Linux':
        impresoras = obtener_impresoras_linux()
    elif sistema == 'Darwin':  # macOS
        impresoras = obtener_impresoras_macos()

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
        INSERT INTO printers (nombre, tipo, modelo, ip, ubicacion, estado, vendor_id, product_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            data.get('nombre', ''),
            data.get('tipo', ''),
            data.get('modelo', ''),
            data.get('ip', ''),
            data.get('ubicacion', ''),
            data.get('estado', ''),
            data.get('vendor_id', None),
            data.get('product_id', None)
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
    cur.execute("SELECT id, nombre, tipo, modelo, ip, ubicacion, estado, vendor_id, product_id FROM printers LIMIT 1")
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
        "vendor_id": row[7],
        "product_id": row[8],
    }
    return jsonify(impresora)

# —— Helpers de detección por plataforma —— #

def obtener_impresoras_windows():
    impresoras = []
    try:
        cmd = [
            'powershell', '-NoProfile', '-Command',
            "Get-WmiObject Win32_PnPEntity | Where-Object { $_.PNPDeviceID -match '^USB' } | "
            "Select-Object Name, PNPDeviceID | ConvertTo-Json"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        items = json.loads(result.stdout)
        if isinstance(items, dict):
            items = [items]

        for item in items:
            name = item.get('Name', '')
            pnp = item.get('PNPDeviceID', '')
            vid = pid = None
            m = RE_VID_PID.search(pnp)
            if m:
                vid, pid = m.group(1).lower(), m.group(2).lower()
            impresoras.append({
                'nombre': name,
                'tipo': 'USB' if 'USB' in pnp.upper() else 'Desconocido',
                'modelo': '',
                'ip': '',
                'ubicacion': 'Local',
                'estado': 'Conectado',
                'vendor_id': vid,
                'product_id': pid
            })
    except Exception as e:
        print("Error Windows scan:", e)
    return impresoras


def obtener_impresoras_linux():
    impresoras = []
    try:
        # Escaneo USB con pyusb
        for d in usb.core.find(find_all=True):
            vid = f"{d.idVendor:04x}"
            pid = f"{d.idProduct:04x}"
            try:
                prod = usb.util.get_string(d, d.iProduct) or ''
            except:
                prod = ''
            impresoras.append({
                'nombre': prod or f'USB {vid}:{pid}',
                'tipo': 'USB',
                'modelo': prod,
                'ip': 'N/A',
                'ubicacion': 'Local',
                'estado': 'Conectado',
                'vendor_id': vid,
                'product_id': pid
            })
    except Exception as e:
        print("Error Linux scan:", e)
    return impresoras


def obtener_impresoras_macos():
    impresoras = []
    try:
        sp = subprocess.run(['system_profiler', 'SPUSBDataType', '-json'],
                             capture_output=True, text=True, check=True)
        j = json.loads(sp.stdout)
        usb_devices = j.get('SPUSBDataType', [])

        def walk_usb(dev):
            vid = dev.get('vendor_id') or dev.get('vendorID')
            pid = dev.get('product_id') or dev.get('productID')
            name = dev.get('_name') or dev.get('product') or ''
            if vid and isinstance(vid, int):
                vid = f"{vid:04x}"
            if pid and isinstance(pid, int):
                pid = f"{pid:04x}"
            if name or vid:
                impresoras.append({
                    'nombre': name or f'USB {vid}:{pid}',
                    'tipo': 'USB',
                    'modelo': name,
                    'ip': 'N/A',
                    'ubicacion': 'Local',
                    'estado': 'Conectado',
                    'vendor_id': vid,
                    'product_id': pid
                })
            # Revisar children
            for k, v in dev.items():
                if isinstance(v, list):
                    for child in v:
                        if isinstance(child, dict):
                            walk_usb(child)

        for dev in usb_devices:
            walk_usb(dev)
    except Exception as e:
        print("Error macOS scan:", e)
    return impresoras
