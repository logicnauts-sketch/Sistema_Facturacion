from flask import Blueprint, render_template, jsonify, request
from conexion import conectar
import mariadb

bp = Blueprint('productos', __name__)

def calcular_estado_stock(stock_actual, stock_minimo):
    """Calcula el estado del stock para un producto"""
    if stock_actual <= stock_minimo:
        return {'clase': 'status-danger', 'texto': 'Muy bajo'}
    elif stock_actual <= stock_minimo * 1.5:
        return {'clase': 'status-warning', 'texto': 'Bajo stock'}
    return {'clase': 'status-normal', 'texto': 'Normal'}

def validar_producto(data):
    """Valida los datos de un producto antes de insertar/actualizar"""
    errores = []
    
    # Validar campos requeridos
    campos_requeridos = ['code', 'name', 'category']
    for campo in campos_requeridos:
        if not data.get(campo) or not str(data[campo]).strip():
            errores.append(f"El campo {'código' if campo=='code' else 'nombre' if campo=='name' else 'categoría'} es obligatorio")
    
    # Validar campos numéricos
    campos_numericos = ['purchase_price', 'sale_price', 'initial_quantity', 
                        'min_stock', 'max_stock', 'tax_percentage']
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


@bp.route('/productos')
def productos_page():
    """Renderiza la página de productos con datos iniciales"""
    conn = conectar()
    if not conn:
        return render_template("error.html", error="Error de conexión a la base de datos")
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Obtener parámetros de filtro
        categoria_filtro = request.args.get('categoria', 'Todos')
        buscar_filtro = request.args.get('buscar', '').strip()

        # Obtener categorías para los filtros y formulario
        cursor.execute("SELECT id, nombre FROM categorias")
        categorias = cursor.fetchall()

        # Construir la consulta base
        query = """
            SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
                   p.precio_compra, p.precio_venta, p.stock_actual, 
                   p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
            FROM productos p
            JOIN categorias c ON p.categoria_id = c.id
        """
        condiciones = []
        parametros = []

        # Aplicar filtro de categoría si no es 'Todos'
        if categoria_filtro and categoria_filtro != 'Todos':
            condiciones.append("c.nombre = %s")
            parametros.append(categoria_filtro)

        # Aplicar filtro de búsqueda si existe
        if buscar_filtro:
            condiciones.append("(p.nombre LIKE %s OR p.codigo LIKE %s OR c.nombre LIKE %s OR p.descripcion LIKE %s)")
            parametros.extend([f"%{buscar_filtro}%"] * 4)

        # Combinar condiciones
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)

        # Ejecutar consulta
        cursor.execute(query, parametros)
        productos = cursor.fetchall()
        
        # Calcular estado de stock para cada producto
        for producto in productos:
            estado = calcular_estado_stock(
                producto['stock_actual'], 
                producto['stock_minimo']
            )
            producto['estado_clase'] = estado['clase']
            producto['estado_texto'] = estado['texto']
            
            # Calcular porcentaje para la barra de stock
            if producto['stock_maximo'] > 0:
                stock_porcentaje = (producto['stock_actual'] / producto['stock_maximo']) * 100
            else:
                stock_porcentaje = 0
            producto['stock_porcentaje'] = min(100, stock_porcentaje)
        
        return render_template(
            "productos.html",
            categorias=categorias,
            productos=productos,
            categoria_activa=categoria_filtro,  # Para activar el tab correspondiente
            termino_busqueda=buscar_filtro,      # Para mantener el término de búsqueda en el input
            sin_productos=len(productos) == 0    # Indicador de que no hay productos
        )
    
    except mariadb.Error as e:
        return render_template("error.html", error=f"Error de base de datos: {str(e)}")
    except Exception as e:
        return render_template("error.html", error=f"Error al cargar productos: {str(e)}")
    finally:
        cursor.close()
        conn.close()
@bp.route('/api/productos', methods=['GET', 'POST'])
def handle_productos():
    conn = conectar()
    if not conn:
        return jsonify({'error': 'Error de conexión a la base de datos'}), 500
        
    cursor = conn.cursor(dictionary=True)
    
    try:
        if request.method == 'GET':
            # Obtener parámetro de categoría
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
            
            # Asegurar que todos los campos tengan valores consistentes
            for producto in productos:
                # Generar código si está vacío
                if not producto['codigo']:
                    producto['codigo'] = f"PRD-{str(producto['id']).zfill(3)}"
                
                # Establecer valores por defecto si están vacíos
                producto['nombre'] = producto['nombre'] or 'Producto sin nombre'
                producto['categoria'] = producto['categoria'] or 'Sin categoría'
                producto['descripcion'] = producto['descripcion'] or ''
                
            # Mantener el formato específico que necesitas
            return jsonify({
                "table": "productos",
                "rows": productos
            })
        
        elif request.method == 'POST':
            data = request.get_json()
            
            # Validar datos del producto
            errores = validar_producto(data)
            if errores:
                return jsonify({
                    'error': 'Errores de validación', 
                    'detalles': errores
                }), 400
            
            # Validar tipos de datos
            try:
                purchase_price = float(data['purchase_price'])
                sale_price = float(data['sale_price'])
                initial_quantity = int(data['initial_quantity'])
                min_stock = int(data['min_stock'])
                max_stock = int(data['max_stock'])
                tax_percentage = float(data['tax_percentage'])
            except (TypeError, ValueError):
                return jsonify({'error': 'Tipos de datos inválidos'}), 400
            
            # Validar stock mínimo/máximo
            if min_stock > max_stock:
                return jsonify({
                    'error': 'El stock mínimo no puede ser mayor que el stock máximo'
                }), 400
            
            # Obtener ID de categoría
            cursor.execute("SELECT id FROM categorias WHERE nombre = %s", (data['category'],))
            categoria = cursor.fetchone()
            if not categoria:
                return jsonify({'error': 'Categoría no válida'}), 400
            
            # Insertar nuevo producto
            query = """
            INSERT INTO productos (
                codigo, nombre, categoria_id, precio_compra, precio_venta,
                stock_actual, stock_minimo, stock_maximo, descripcion, impuesto
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            valores = (
                data['code'],
                data['name'],
                categoria['id'],
                purchase_price,
                sale_price,
                initial_quantity,
                min_stock,
                max_stock,
                data.get('description', ''),
                tax_percentage
            )
            
            cursor.execute(query, valores)
            conn.commit()
            
            # Obtener el producto recién creado
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
            
            # Asegurar valores consistentes
            if not nuevo_producto['codigo']:
                nuevo_producto['codigo'] = f"PRD-{str(new_id).zfill(3)}"
            nuevo_producto['nombre'] = nuevo_producto['nombre'] or 'Producto sin nombre'
            nuevo_producto['categoria'] = nuevo_producto['categoria'] or 'Sin categoría'
            nuevo_producto['descripcion'] = nuevo_producto['descripcion'] or ''
            
            # Mantener el formato específico para POST
            return jsonify({
                "table": "productos",
                "rows": [nuevo_producto]
            }), 201
    
    except mariadb.Error as err:
        conn.rollback()
        return jsonify({
            'error': f"Error de base de datos: {err}",
            'code': 'DB_ERROR'
        }), 500
    except Exception as e:
        conn.rollback()
        return jsonify({
            'error': str(e),
            'code': 'SERVER_ERROR'
        }), 500
    finally:
        cursor.close()
        conn.close()

@bp.route('/api/productos/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def handle_producto(id):
    conn = conectar()
    if not conn:
        return jsonify({'error': 'Error de conexión a la base de datos'}), 500
        
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT id FROM productos WHERE id = %s", (id,))
        producto = cursor.fetchone()
        if not producto:
            return jsonify({'error': 'Producto no encontrado'}), 404

        if request.method == 'GET':
            cursor.execute("""
                SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
                       p.precio_compra, p.precio_venta, p.stock_actual, 
                       p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = %s
            """, (id,))
            producto = cursor.fetchone()
            
            # Limpiar datos para respuesta
            producto['codigo'] = producto['codigo'] or 'SIN CÓDIGO'
            producto['nombre'] = producto['nombre'] or 'SIN NOMBRE'
            producto['categoria'] = producto['categoria'] or 'SIN CATEGORÍA'
            producto['descripcion'] = producto['descripcion'] or ''
            
            return jsonify(producto)
        
        elif request.method == 'PUT':
            data = request.get_json()
            
            # Validar datos del producto
            errores = validar_producto(data)
            if errores:
                return jsonify({'error': 'Errores de validación', 'detalles': errores}), 400
            
            # Validar tipos de datos
            try:
                purchase_price = float(data['purchase_price'])
                sale_price = float(data['sale_price'])
                initial_quantity = int(data['initial_quantity'])
                min_stock = int(data['min_stock'])
                max_stock = int(data['max_stock'])
                tax_percentage = float(data['tax_percentage'])
            except (TypeError, ValueError):
                return jsonify({'error': 'Tipos de datos inválidos'}), 400
            
            cursor.execute("SELECT id FROM categorias WHERE nombre = %s", (data['category'],))
            categoria = cursor.fetchone()
            if not categoria:
                return jsonify({'error': 'Categoría no válida'}), 400
            
            query = """
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
            """
            valores = (
                data['code'],
                data['name'],
                categoria['id'],
                purchase_price,
                sale_price,
                initial_quantity,
                min_stock,
                max_stock,
                data.get('description', ''),
                tax_percentage,
                id
            )
            
            cursor.execute(query, valores)
            conn.commit()
            
            # Obtener producto actualizado
            cursor.execute("""
                SELECT p.id, p.codigo, p.nombre, c.nombre as categoria, 
                       p.precio_compra, p.precio_venta, p.stock_actual, 
                       p.stock_minimo, p.stock_maximo, p.descripcion, p.impuesto
                FROM productos p
                JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = %s
            """, (id,))
            producto = cursor.fetchone()
            
            # Limpiar datos para respuesta
            producto['codigo'] = producto['codigo'] or 'SIN CÓDIGO'
            producto['nombre'] = producto['nombre'] or 'SIN NOMBRE'
            producto['categoria'] = producto['categoria'] or 'SIN CATEGORÍA'
            producto['descripcion'] = producto['descripcion'] or ''
            
            return jsonify(producto)
        
        elif request.method == 'DELETE':
            # Eliminar movimientos de inventario primero (si existen)
            cursor.execute("DELETE FROM movimientos_inventario WHERE producto_id = %s", (id,))
            # Luego eliminar el producto
            cursor.execute("DELETE FROM productos WHERE id = %s", (id,))
            conn.commit()
            return jsonify({'message': 'Producto eliminado exitosamente'}), 200
    
    except mariadb.Error as err:
        conn.rollback()
        return jsonify({'error': f"Error de base de datos: {err}"}), 500
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@bp.route('/api/productos/proximo-codigo')
def get_proximo_codigo():
    """Obtiene el próximo código de producto disponible"""
    conn = conectar()
    if not conn:
        return jsonify({'error': 'Error de conexión a la base de datos'}), 500
        
    cursor = conn.cursor()
    
    try:
        # Obtener el máximo código actual
        cursor.execute("SELECT MAX(codigo) FROM productos WHERE codigo LIKE 'PRD-%'")
        max_codigo = cursor.fetchone()[0]
        
        if max_codigo:
            # Extraer el número y aumentar en 1
            try:
                num = int(max_codigo.split('-')[1]) + 1
            except (IndexError, ValueError):
                num = 1
        else:
            num = 1
            
        # Formatear el nuevo código
        proximo_codigo = f'PRD-{num:03d}'
        return jsonify({'proximo_codigo': proximo_codigo})
    
    except mariadb.Error as err:
        return jsonify({'error': f"Error de base de datos: {err}"}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()