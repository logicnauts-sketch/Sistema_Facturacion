from flask import Blueprint, render_template, jsonify, request
from conexion import conectar
import math

bp = Blueprint('productos', __name__)

def calcular_estado_stock(stock_actual, stock_minimo):
    if stock_actual <= stock_minimo:
        return {'clase': 'status-danger', 'texto': 'Muy bajo'}
    elif stock_actual <= stock_minimo * 1.5:
        return {'clase': 'status-warning', 'texto': 'Bajo stock'}
    return {'clase': 'status-normal', 'texto': 'Normal'}

def validar_producto(data):
    errores = []
    campos_requeridos = ['code', 'name', 'category']
    campos_numericos = ['purchase_price', 'sale_price', 'initial_quantity', 
                        'min_stock', 'max_stock', 'tax_percentage']
    
    # Validar campos requeridos
    for campo in campos_requeridos:
        if not data.get(campo) or not str(data[campo]).strip():
            nombre_campo = {'code': 'código', 'name': 'nombre', 'category': 'categoría'}[campo]
            errores.append(f"El campo {nombre_campo} es obligatorio")
    
    # Validar campos numéricos
    for campo in campos_numericos:
        try:
            valor = float(data.get(campo, 0))
            if valor < 0:
                errores.append(f"El campo {campo} no puede ser negativo")
        except (TypeError, ValueError):
            errores.append(f"El campo {campo} debe ser un número válido")
    
    # Validar stock mínimo/máximo
    try:
        min_stock = int(data.get('min_stock', 0))
        max_stock = int(data.get('max_stock', 0))
        if min_stock > max_stock:
            errores.append("El stock mínimo no puede ser mayor que el stock máximo")
    except:
        pass
    
    return errores

def obtener_productos(conn, categoria_filtro, buscar_filtro):
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
               p.precio_compra, p.precio_venta, p.stock_actual, 
               p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
        FROM productos p
        JOIN categorias c ON p.categoria_id = c.id
    """
    condiciones, parametros = [], []
    
    if categoria_filtro and categoria_filtro != 'Todos':
        condiciones.append("c.nombre = %s")
        parametros.append(categoria_filtro)
    
    if buscar_filtro:
        condiciones.append("(p.nombre LIKE %s OR p.codigo LIKE %s OR c.nombre LIKE %s OR p.descripcion LIKE %s)")
        parametros.extend([f"%{buscar_filtro}%"] * 4)
    
    if condiciones:
        query += " WHERE " + " AND ".join(condiciones)
    
    cursor.execute(query, parametros)
    productos = cursor.fetchall()
    
    for producto in productos:
        estado = calcular_estado_stock(producto['stock_actual'], producto['stock_minimo'])
        producto['estado_clase'] = estado['clase']
        producto['estado_texto'] = estado['texto']
        producto['stock_porcentaje'] = min(100, (producto['stock_actual'] / producto['stock_maximo'] * 100) if producto['stock_maximo'] > 0 else 0)

    cursor.close()
    return productos

def manejar_db(operacion, *args, **kwargs):
    conn = conectar()
    if not conn:
        return None, "Error de conexión a la base de datos"
    
    try:
        return operacion(conn, *args, **kwargs), None
    except Exception as e:
        return None, str(e)
    finally:
        conn.close()

@bp.route('/productos')
def productos_page():
    categoria_filtro = request.args.get('categoria', 'Todos')
    buscar_filtro = request.args.get('buscar', '').strip()
    
    def operacion(conn):
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, nombre FROM categorias")
        categorias = cursor.fetchall()
        
        # Obtener contadores de productos por categoría
        cursor.execute("""
            SELECT c.nombre AS categoria, COUNT(p.id) AS total
            FROM categorias c
            LEFT JOIN productos p ON c.id = p.categoria_id
            GROUP BY c.nombre
        """)
        contadores = cursor.fetchall()
        contador_dict = {item['categoria']: item['total'] for item in contadores}
        
        # Contador para "Todos"
        cursor.execute("SELECT COUNT(*) AS total FROM productos")
        total_todos = cursor.fetchone()['total']
        contador_dict['Todos'] = total_todos
        
        cursor.close()
        
        productos = obtener_productos(conn, categoria_filtro, buscar_filtro)
        return {
            "categorias": categorias,
            "productos": productos,
            "categoria_activa": categoria_filtro,
            "termino_busqueda": buscar_filtro,
            "sin_productos": len(productos) == 0,
            "contadores": contador_dict
        }
    
    resultado, error = manejar_db(operacion)
    if error:
        return render_template("error.html", error=f"Error al cargar productos: {error}")
    return render_template("productos.html", **resultado)

@bp.route('/api/productos', methods=['GET', 'POST'])
def handle_productos():
    if request.method == 'GET':
        def operacion(conn):
            cursor = conn.cursor(dictionary=True)
            category = request.args.get('category')
            
            if category and category != 'Todos':
                cursor.execute("""
                    SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
                           p.precio_compra, p.precio_venta, p.stock_actual, 
                           p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
                    FROM productos p
                    JOIN categorias c ON p.categoria_id = c.id
                    WHERE c.nombre = %s
                """, (category,))
            else:
                cursor.execute("""
                    SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
                           p.precio_compra, p.precio_venta, p.stock_actual, 
                           p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
                    FROM productos p
                    JOIN categorias c ON p.categoria_id = c.id
                """)
            
            productos = cursor.fetchall()
            for p in productos:
                p['codigo'] = p['codigo'] or f"PRD-{str(p['id']).zfill(3)}"
                p['nombre'] = p['nombre'] or 'Producto sin nombre'
                p['categoria'] = p['categoria'] or 'Sin categoría'
                p['descripcion'] = p['descripcion'] or ''
            
            cursor.close()
            return {"table": "productos", "rows": productos}
        
        resultado, error = manejar_db(operacion)
        return jsonify(resultado) if resultado else jsonify({'error': error}), 500
    
    elif request.method == 'POST':
        data = request.get_json()
        errores = validar_producto(data)
        if errores:
            return jsonify({'error': 'Errores de validación', 'detalles': errores}), 400
        
        try:
            valores = (
                data['code'],
                data['name'],
                float(data['purchase_price']),
                float(data['sale_price']),
                int(data['initial_quantity']),
                int(data['min_stock']),
                int(data['max_stock']),
                data.get('description', ''),
                float(data['tax_percentage'])
            )
        except (TypeError, ValueError) as e:
            return jsonify({'error': f'Tipos de datos inválidos: {str(e)}'}), 400
        
        if valores[5] > valores[6]:
            return jsonify({'error': 'El stock mínimo no puede ser mayor que el stock máximo'}), 400
        
        def operacion(conn):
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id FROM categorias WHERE nombre = %s", (data['category'],))
            categoria = cursor.fetchone()
            if not categoria:
                return None, 'Categoría no válida'
            
            cursor.execute("""
                INSERT INTO productos (
                    codigo, nombre, categoria_id, precio_compra, precio_venta,
                    stock_actual, stock_minimo, stock_maximo, descripcion, impuesto
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (*valores[:2], categoria['id'], *valores[2:]))
            conn.commit()
            
            new_id = cursor.lastrowid
            cursor.execute("""
                SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
                       p.precio_compra, p.precio_venta, p.stock_actual, 
                       p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = %s
            """, (new_id,))
            nuevo_producto = cursor.fetchone()
            
            nuevo_producto['codigo'] = nuevo_producto['codigo'] or f"PRD-{str(new_id).zfill(3)}"
            nuevo_producto['nombre'] = nuevo_producto['nombre'] or 'Producto sin nombre'
            nuevo_producto['categoria'] = nuevo_producto['categoria'] or 'Sin categoría'
            nuevo_producto['descripcion'] = nuevo_producto['descripcion'] or ''
            
            cursor.close()
            return {"message": "Producto creado exitosamente", "product": nuevo_producto}
        
        resultado, error = manejar_db(operacion)
        if resultado:
            return jsonify(resultado), 201
        else:
            return jsonify({'error': error}), 500

@bp.route('/api/productos/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def handle_producto(id):
    if request.method == 'GET':
        def operacion(conn):
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
                       p.precio_compra, p.precio_venta, p.stock_actual, 
                       p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = %s
            """, (id,))
            producto = cursor.fetchone()
            cursor.close()
            
            if not producto:
                return None, 'Producto no encontrado'
            
            producto['codigo'] = producto['codigo'] or 'SIN CÓDIGO'
            producto['nombre'] = producto['nombre'] or 'SIN NOMBRE'
            producto['categoria'] = producto['categoria'] or 'SIN CATEGORÍA'
            producto['descripcion'] = producto['descripcion'] or ''
            return producto
        
        resultado, error = manejar_db(operacion)
        if resultado:
            return jsonify(resultado)
        else:
            return jsonify({'error': error}), 404 if error == 'Producto no encontrado' else 500
    
    elif request.method == 'PUT':
        data = request.get_json()
        errores = validar_producto(data)
        if errores:
            return jsonify({'error': 'Errores de validación', 'detalles': errores}), 400
        
        try:
            valores = (
                data['code'],
                data['name'],
                float(data['purchase_price']),
                float(data['sale_price']),
                int(data['initial_quantity']),
                int(data['min_stock']),
                int(data['max_stock']),
                data.get('description', ''),
                float(data['tax_percentage']),
                id
            )
        except (TypeError, ValueError) as e:
            return jsonify({'error': f'Tipos de datos inválidos: {str(e)}'}), 400
        
        if valores[5] > valores[6]:
            return jsonify({'error': 'El stock mínimo no puede ser mayor que el stock máximo'}), 400
        
        def operacion(conn):
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id FROM categorias WHERE nombre = %s", (data['category'],))
            categoria = cursor.fetchone()
            if not categoria:
                return None, 'Categoría no válida'
            
            cursor.execute("""
                UPDATE productos SET
                    codigo = %s,
                    nombre = %s,
                    categoria_id = %s,
                    precio_compra = %s,
                    precio_venta = %s,
                    stock_actual = %s,
                    stock_minimo = %s,
                    stock_maximo = %s,
                    descripcion = %s,
                    impuesto = %s
                WHERE id = %s
            """, (*valores[:2], categoria['id'], *valores[2:]))
            conn.commit()
            
            cursor.execute("""
                SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
                       p.precio_compra, p.precio_venta, p.stock_actual, 
                       p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = %s
            """, (id,))
            producto = cursor.fetchone()
            cursor.close()
            
            if not producto:
                return None, 'Producto no encontrado después de actualizar'
            
            producto['codigo'] = producto['codigo'] or 'SIN CÓDIGO'
            producto['nombre'] = producto['nombre'] or 'SIN NOMBRE'
            producto['categoria'] = producto['categoria'] or 'SIN CATEGORÍA'
            producto['descripcion'] = producto['descripcion'] or ''
            return producto
        
        resultado, error = manejar_db(operacion)
        if resultado:
            return jsonify(resultado)
        else:
            return jsonify({'error': error}), 500
    
    elif request.method == 'DELETE':
        def operacion(conn):
            cursor = conn.cursor()
            
            # Verificar si el producto existe
            cursor.execute("SELECT id FROM productos WHERE id = %s", (id,))
            if not cursor.fetchone():
                return None, "Producto no encontrado"
            
            # Eliminar movimientos y producto
            cursor.execute("DELETE FROM movimientos_inventario WHERE producto_id = %s", (id,))
            cursor.execute("DELETE FROM productos WHERE id = %s", (id,))
            conn.commit()
            cursor.close()
            return {'message': 'Producto eliminado exitosamente'}
        
        resultado, error = manejar_db(operacion)
        if resultado:
            return jsonify(resultado)
        else:
            status = 404 if "no encontrado" in error else 500
            return jsonify({'error': error}), status

@bp.route('/api/productos/proximo-codigo')
def get_proximo_codigo():
    def operacion(conn):
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(codigo) FROM productos WHERE codigo LIKE 'PRD-%'")
        max_codigo = cursor.fetchone()[0]
        
        if max_codigo:
            try:
                num = int(max_codigo.split('-')[1]) + 1
            except (IndexError, ValueError):
                num = 1
        else:
            num = 1
            
        cursor.close()
        return {'proximo_codigo': f'PRD-{num:03d}'}
    
    resultado, error = manejar_db(operacion)
    if resultado:
        return jsonify(resultado)
    else:
        return jsonify({'error': error}), 500

# Rutas para categorías
@bp.route('/api/categorias', methods=['GET'])
def listar_categorias():
    def operacion(conn):
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, nombre FROM categorias ORDER BY nombre")
        categorias = [{"id": r["id"], "nombre": r["nombre"]} for r in cursor.fetchall()]
        cursor.close()
        return categorias
    
    resultado, error = manejar_db(operacion)
    if resultado:
        return jsonify(resultado)
    else:
        return jsonify({"error": error}), 500

@bp.route('/api/categorias', methods=['POST'])
def crear_categoria():
    data = request.get_json() or {}
    nombre = (data.get('nombre') or '').strip()
    
    if not nombre:
        return jsonify({"error": "El nombre es requerido"}), 400
    
    def operacion(conn):
        cursor = conn.cursor()
        try:
            # Verificar si ya existe
            cursor.execute("SELECT id FROM categorias WHERE nombre = %s", (nombre,))
            if cursor.fetchone():
                return None, "Ya existe una categoría con ese nombre"
            
            cursor.execute("INSERT INTO categorias (nombre) VALUES (%s)", (nombre,))
            conn.commit()
            new_id = cursor.lastrowid
            return {"id": new_id, "nombre": nombre, "message": "Categoría creada exitosamente"}
        except Exception as e:
            conn.rollback()
            return None, f"Error de base de datos: {str(e)}"
        finally:
            cursor.close()
    
    resultado, error = manejar_db(operacion)
    if resultado:
        return jsonify(resultado), 201
    else:
        status = 409 if "Ya existe" in error else 500
        return jsonify({"error": error}), status

@bp.route('/api/categorias/<int:cat_id>', methods=['PUT'])
def actualizar_categoria(cat_id):
    data = request.get_json() or {}
    nombre = (data.get('nombre') or '').strip()
    if not nombre:
        return jsonify({"error": "El nombre es requerido"}), 400
    
    def operacion(conn):
        cursor = conn.cursor()
        try:
            # Verificar si la categoría existe
            cursor.execute("SELECT id FROM categorias WHERE id = %s", (cat_id,))
            if not cursor.fetchone():
                return None, "Categoría no encontrada"
            
            # Verificar si el nuevo nombre ya existe
            cursor.execute("SELECT id FROM categorias WHERE nombre = %s AND id != %s", (nombre, cat_id))
            if cursor.fetchone():
                return None, "Ya existe una categoría con ese nombre"
            
            cursor.execute("UPDATE categorias SET nombre = %s WHERE id = %s", (nombre, cat_id))
            conn.commit()
            return {"message": "Categoría actualizada exitosamente"}
        except Exception as e:
            conn.rollback()
            return None, f"Error de base de datos: {str(e)}"
        finally:
            cursor.close()
    
    resultado, error = manejar_db(operacion)
    if resultado:
        return jsonify(resultado)
    else:
        status = 404 if "no encontrada" in error else 409 if "Ya existe" in error else 500
        return jsonify({"error": error}), status

@bp.route('/api/categorias/<int:cat_id>', methods=['DELETE'])
def eliminar_categoria(cat_id):
    def operacion(conn):
        cursor = conn.cursor()
        try:
            # Verificar si la categoría existe
            cursor.execute("SELECT id FROM categorias WHERE id = %s", (cat_id,))
            if not cursor.fetchone():
                return None, "Categoría no encontrada"
            
            # Verificar si hay productos asociados
            cursor.execute("SELECT COUNT(*) FROM productos WHERE categoria_id = %s", (cat_id,))
            count = cursor.fetchone()[0]
            if count > 0:
                return None, "No se puede eliminar: la categoría tiene productos asociados"
            
            cursor.execute("DELETE FROM categorias WHERE id = %s", (cat_id,))
            conn.commit()
            return {"message": "Categoría eliminada exitosamente"}
        except Exception as e:
            conn.rollback()
            return None, f"Error de base de datos: {str(e)}"
        finally:
            cursor.close()
    
    resultado, error = manejar_db(operacion)
    if resultado:
        return jsonify(resultado)
    else:
        status = 404 if "no encontrada" in error else 409 if "No se puede eliminar" in error else 500
        return jsonify({"error": error}), status