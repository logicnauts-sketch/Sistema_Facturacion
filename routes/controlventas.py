# controlventas.py
from flask import Blueprint, render_template, jsonify
import random
from datetime import datetime, timedelta

bp = Blueprint('controlventas', __name__)

# Datos de prueba para productos
productos = [
    {"id": 1, "nombre": "Laptop HP EliteBook", "categoria": "Tecnología", "precio": 1200, "stock": 15},
    {"id": 2, "nombre": "Smartphone Samsung Galaxy", "categoria": "Tecnología", "precio": 850, "stock": 30},
    {"id": 3, "nombre": "Mesa de Oficina", "categoria": "Muebles", "precio": 450, "stock": 8},
    {"id": 4, "nombre": "Silla Ergonómica", "categoria": "Muebles", "precio": 350, "stock": 12},
    {"id": 5, "nombre": "Impresora Laser", "categoria": "Tecnología", "precio": 300, "stock": 5},
    {"id": 6, "nombre": "Monitor 24\"", "categoria": "Tecnología", "precio": 220, "stock": 18},
]

# Generar ventas de prueba
def generar_ventas():
    ventas = []
    categorias = set(p["categoria"] for p in productos)
    
    for i in range(50):
        producto = random.choice(productos)
        cantidad = random.randint(1, 5)
        precio_total = producto["precio"] * cantidad
        fecha = datetime.now() - timedelta(days=random.randint(0, 30))
        
        ventas.append({
            "id": i + 1,
            "producto_id": producto["id"],
            "producto_nombre": producto["nombre"],
            "categoria": producto["categoria"],
            "cantidad": cantidad,
            "precio_unitario": producto["precio"],
            "precio_total": precio_total,
            "fecha": fecha.strftime("%Y-%m-%d")
        })
    
    return ventas

@bp.route('/controlventas')
def controlventas():
    ventas = generar_ventas()
    
    # Calcular métricas
    ventas_totales = sum(v["precio_total"] for v in ventas)
    promedio_venta = ventas_totales / len(ventas) if ventas else 0
    productos_vendidos = sum(v["cantidad"] for v in ventas)
    
    # Agrupar por categoría
    ventas_por_categoria = {}
    for v in ventas:
        if v["categoria"] not in ventas_por_categoria:
            ventas_por_categoria[v["categoria"]] = 0
        ventas_por_categoria[v["categoria"]] += v["precio_total"]
    
    # Top productos
    productos_ventas = {}
    for v in ventas:
        if v["producto_nombre"] not in productos_ventas:
            productos_ventas[v["producto_nombre"]] = 0
        productos_ventas[v["producto_nombre"]] += v["precio_total"]
    
    top_productos = sorted(productos_ventas.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return render_template("controlventas.html", 
                          ventas_totales=ventas_totales,
                          promedio_venta=promedio_venta,
                          productos_vendidos=productos_vendidos,
                          ventas_por_categoria=ventas_por_categoria,
                          top_productos=top_productos,
                          productos=productos)

@bp.route('/api/ventas_por_producto')
def ventas_por_producto():
    ventas = generar_ventas()
    
    # Agrupar ventas por producto
    ventas_producto = {}
    for v in ventas:
        key = f"{v['producto_nombre']} ({v['categoria']})"
        if key not in ventas_producto:
            ventas_producto[key] = {"ventas": 0, "cantidad": 0}
        ventas_producto[key]["ventas"] += v["precio_total"]
        ventas_producto[key]["cantidad"] += v["cantidad"]
    
    # Formatear para el gráfico
    labels = []
    ventas_data = []
    cantidad_data = []
    
    for producto, datos in ventas_producto.items():
        labels.append(producto)
        ventas_data.append(datos["ventas"])
        cantidad_data.append(datos["cantidad"])
    
    return jsonify({
        "labels": labels,
        "ventas": ventas_data,
        "cantidad": cantidad_data
    })