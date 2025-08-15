from flask import Blueprint, render_template, jsonify
import random
from datetime import datetime, timedelta
from utils import login_required

bp = Blueprint('cuentascyp', __name__)

def calculate_status(due_date_str):
    """Calcula el estado basado en la fecha de vencimiento y la fecha actual."""
    today = datetime.now().date()
    due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
    if due_date < today:
        return "overdue"
    return "pending"

def generate_sample_accounts():
    accounts = []
    clientes = ["Cliente Ejemplo S.A.", "Proveedor Nacional", "Cliente Importante", 
                "Distribuidora Caribe", "Suplidora Industrial", "Comercializadora Global"]
    tipos = ["receivable", "payable"]
    
    for i in range(1, 31):  # 30 cuentas para pruebas
        tipo = random.choice(tipos)
        fecha_emision = (datetime.now() - timedelta(days=random.randint(0, 60))).strftime("%Y-%m-%d")
        fecha_vencimiento = (datetime.now() + timedelta(days=random.randint(-10, 30))).strftime("%Y-%m-%d")
        
        # Estado inicial: 30% de probabilidad de estar pagado, sino se calcula
        if random.random() < 0.3:
            estado = "paid"
        else:
            estado = calculate_status(fecha_vencimiento)
        
        account = {
            "id": i,
            "name": random.choice(clientes),
            "type": tipo,
            "document": f"Factura #{random.randint(1000, 9999)}-2023",
            "amount": random.randint(1000, 50000),
            "issueDate": fecha_emision,
            "dueDate": fecha_vencimiento,
            "status": estado,
            "contact": f"Contacto {i}",
            "email": f"contacto{i}@empresa.com",
            "phone": f"809-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
        }
        accounts.append(account)
    
    return accounts

@bp.route('/cuentascyp')
@login_required
def cuentascyp():
    return render_template("cuentascyp.html")

@bp.route('/api/cuentas')
def get_cuentas():
    cuentas = generate_sample_accounts()
    return jsonify(cuentas)