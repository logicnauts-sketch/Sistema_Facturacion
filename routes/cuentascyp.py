from flask import Blueprint, render_template, jsonify
from datetime import datetime, date
from utils import login_required
from conexion import conectar
import traceback

bp = Blueprint('cuentascyp', __name__)

def safe_date_format(val):
    """Devuelve 'YYYY-MM-DD' o None de forma segura si val es None/string/date/datetime."""
    if not val:
        return None
    # Si ya es date/datetime
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    # Si es string intento parsear iso o formato común
    try:
        # datetime.fromisoformat acepta 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM:SS'
        dt = datetime.fromisoformat(val)
        return dt.date().strftime("%Y-%m-%d")
    except Exception:
        try:
            dt = datetime.strptime(val, "%Y-%m-%d")
            return dt.date().strftime("%Y-%m-%d")
        except Exception:
            return None

def normalize_amount(val):
    """Convierte a float seguro (siempre devuelve float)."""
    try:
        if val is None:
            return 0.0
        return float(val)
    except Exception:
        try:
            # por si viene Decimal u otro
            return float(str(val).replace(',', ''))
        except Exception:
            return 0.0

def calculate_status(due_date_str, estado_db, monto_pagado, monto_total):
    """Calcula el estado basado en la fecha de vencimiento y el estado de la base de datos."""
    today = datetime.now().date()
    due_date = None
    if due_date_str:
        try:
            due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
        except Exception:
            # si no pudo parsear, mantener due_date = None
            due_date = None

    est = (estado_db or "").strip().lower()
    if est in ['pagado', 'pagada', 'paid']:
        return "paid"
    if est in ['parcial', 'partial']:
        return "partial"
    # Si hay montos y monto_pagado >= monto_total -> paid
    try:
        if monto_total is not None and monto_pagado is not None:
            if float(monto_pagado) >= float(monto_total) and float(monto_total) > 0:
                return "paid"
    except Exception:
        pass
    # Vencido si due_date existe y es menor a hoy
    if due_date and due_date < today:
        return "overdue"
    return "pending"


@bp.route('/cuentascyp')
@login_required
def cuentascyp():
    return render_template("cuentascyp.html")


@bp.route('/api/cuentas', methods=['GET'])
@login_required
def get_cuentas():
    try:
        connection = conectar()
        cursor = connection.cursor(dictionary=True)

        # Cuentas por pagar
        cursor.execute("""
            SELECT cpp.*, p.nombre as proveedor_nombre, p.email, p.telefono
            FROM cuentas_por_pagar cpp
            JOIN proveedores p ON cpp.proveedor_id = p.id
        """)
        cuentas_pagar = cursor.fetchall() or []

        # Cuentas por cobrar
        cursor.execute("""
            SELECT cpc.*, cl.nombre as cliente_nombre, cl.correo, cl.telefono
            FROM cuentas_por_cobrar cpc
            JOIN clientes cl ON cpc.cliente_id = cl.id
        """)
        cuentas_cobrar = cursor.fetchall() or []

        cuentas = []

        # Procesar cuentas por pagar
        for c in cuentas_pagar:
            due = safe_date_format(c.get('fecha_vencimiento'))
            issue = safe_date_format(c.get('fecha_emision'))
            monto = normalize_amount(c.get('monto'))
            estado = c.get('estado') or ''
            cuentas.append({
                "id": f"p{c.get('id')}",
                "name": c.get('proveedor_nombre') or '---',
                "type": "payable",
                "document": c.get('numero_factura') or '',
                "amount": monto,
                "issueDate": issue,
                "dueDate": due,
                "status": calculate_status(due, estado, 0, monto),
                "contact": c.get('contacto') or '',
                "email": c.get('email') or '',
                "phone": c.get('telefono') or ''
            })

        # Procesar cuentas por cobrar
        for c in cuentas_cobrar:
            due = safe_date_format(c.get('fecha_vencimiento'))
            issue = safe_date_format(c.get('fecha_emision'))
            monto_total = normalize_amount(c.get('monto_total'))
            monto_pagado = normalize_amount(c.get('monto_pagado'))
            estado = c.get('estado') or ''
            factura_id = c.get('factura_id') or c.get('id') or ''
            cuentas.append({
                "id": f"c{c.get('id')}",
                "name": c.get('cliente_nombre') or '---',
                "type": "receivable",
                "document": f"Factura #{factura_id}",
                "amount": monto_total,
                "issueDate": issue,
                "dueDate": due,
                "status": calculate_status(due, estado, monto_pagado, monto_total),
                "contact": c.get('contacto') or '',
                "email": c.get('email') or '',
                "phone": c.get('telefono') or ''
            })

        cursor.close()
        connection.close()

        # Devuelvo como array (tu JS ya soporta array)
        return jsonify(cuentas)

    except Exception as e:
        # Imprime traceback completo en la consola del servidor para ver la causa exacta
        print("Error al obtener cuentas:", str(e))
        traceback.print_exc()
        # Devolvemos un mensaje útil al cliente (y status 500)
        return jsonify({"error": "No se pudieron obtener las cuentas. Revisa el log del servidor."}), 500
