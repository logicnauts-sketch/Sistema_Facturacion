from flask import Blueprint, render_template, jsonify, request, current_app
from werkzeug.utils import secure_filename
import os
import uuid
import logging
from conexion import conectar
from utils import login_required, solo_admin_required

bp = Blueprint('empresa', __name__, url_prefix='/empresa')

# Configuración corregida
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
UPLOAD_FOLDER = 'static/img/logos'  # Asegúrate que esta carpeta existe

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@bp.route('/datos', methods=['GET'])
def obtener_datos_empresa():
    conn = None
    try:
        conn = conectar()
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute("""
                SELECT id, nombre, rnc, telefono, direccion, mensaje_legal, 
                       logo_path, email, website, actividad_comercial, 
                       color_principal, terminos 
                FROM empresa 
                LIMIT 1
            """)
            empresa_data = cursor.fetchone()
            
            if not empresa_data:
                # Crear registro vacío si no existe
                empresa_data = {
                    'id': None,
                    'nombre': '',
                    'rnc': '',
                    'telefono': '',
                    'direccion': '',
                    'mensaje_legal': '',
                    'logo_path': None,
                    'email': '',
                    'website': '',
                    'actividad_comercial': '',
                    'color_principal': '#3498db',
                    'terminos': ''
                }
            
            # Construir ruta completa del logo
            if empresa_data.get('logo_path'):
                # Asegurar que la ruta comience con static/
                logo_path = empresa_data['logo_path']
                if not logo_path.startswith('static/'):
                    logo_path = f"static/{logo_path}"
                empresa_data['logo_path'] = f"/{logo_path}"
            
            return jsonify(empresa_data)
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener datos de empresa: {str(e)}", exc_info=True)
        return jsonify({
            'error': f'Error interno del servidor: {str(e)}'  # Más detalle para depuración
        }), 500
    finally:
        if conn:
            conn.close()


@bp.route('/', methods=['GET'])
@login_required
@solo_admin_required
def obtener_empresa():
    """Renderiza la página de configuración de empresa"""
    conn = None
    try:
        conn = conectar()
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute("SELECT * FROM empresa LIMIT 1")
            empresa_data = cursor.fetchone()
            
            if not empresa_data:
                # Crear registro inicial si no existe
                cursor.execute("""
                    INSERT INTO empresa (
                        nombre, rnc, telefono, direccion, mensaje_legal,
                        actividad_comercial, email, website, color_principal, terminos
                    ) VALUES (
                        'Mi Empresa', '1-01-12345-6', '(809) 555-0000', 
                        'Calle Principal #100', 'Conserve este ticket',
                        'Venta de productos', 'info@miempresa.com', 
                        'https://www.miempresa.com', '#3a86ff', 'Términos y condiciones'
                    )
                """)
                conn.commit()
                cursor.execute("SELECT * FROM empresa LIMIT 1")
                empresa_data = cursor.fetchone()
            
            # Construir ruta completa del logo para la plantilla
            if empresa_data.get('logo_path'):
                empresa_data['logo_path'] = f"/{empresa_data['logo_path']}"
            
            return render_template("empresa.html", empresa=empresa_data)
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener datos de empresa: {str(e)}", exc_info=True)
        return render_template("empresa.html", error="Error al cargar datos")
    finally:
        if conn:
            conn.close()

@bp.route('/guardar', methods=['POST'])
def guardar_empresa():
    """Actualiza los datos de la empresa incluyendo logo"""
    data = request.form
    logo_file = request.files.get('logo')
    app_root = current_app.root_path
    logger = current_app.logger
    
    # Configurar directorio de uploads con ruta absoluta
    upload_folder = os.path.join(app_root, UPLOAD_FOLDER)
    os.makedirs(upload_folder, exist_ok=True)
    
    logo_path = None
    old_logo_to_delete = None
    conn = None

    try:
        # Procesar logo si se subió
        if logo_file and logo_file.filename != '':
            if not allowed_file(logo_file.filename):
                return jsonify({
                    'success': False,
                    'error': 'Tipo de archivo no permitido. Use PNG, JPG o GIF'
                }), 400

            # Generar nombre único seguro
            ext = logo_file.filename.rsplit('.', 1)[1].lower()
            existing_logos = [f for f in os.listdir(upload_folder)
                              if f.startswith('logo') and f.endswith(f'.{ext}')]
            existing_numbers = []
            
            for logo in existing_logos:
                try:
                    # Extraer número del nombre (ej: "logo5.jpg" -> 5)
                    num = int(logo[4:-len(ext)-1])
                    existing_numbers.append(num)
                except ValueError:
                    continue  # Ignorar archivos que no coincidan con el patrón
            
            next_num = max(existing_numbers) + 1 if existing_numbers else 1
            unique_filename = f"logo{next_num}.{ext}"
            file_path = os.path.join(upload_folder, unique_filename)
            
            # Guardar archivo
            logo_file.save(file_path)
            logo_path = os.path.join(UPLOAD_FOLDER, unique_filename).replace('\\', '/')

        # Conectar a la base de datos
        conn = conectar()
        with conn.cursor(dictionary=True) as cursor:
            # Obtener datos actuales
            cursor.execute("SELECT id, logo_path FROM empresa LIMIT 1")
            empresa_existente = cursor.fetchone()
            
            if empresa_existente and logo_path:
                old_logo_to_delete = empresa_existente.get('logo_path')

            # Preparar datos para la consulta
            params = {
                'nombre': data.get('nombre'),
                'rnc': data.get('rnc'),
                'actividad_comercial': data.get('actividad_comercial'),
                'telefono': data.get('telefono'),
                'email': data.get('email'),
                'direccion': data.get('direccion'),
                'website': data.get('website'),
                'mensaje_legal': data.get('mensaje_legal'),
                'terminos': data.get('terminos'),
                'color_principal': data.get('color_principal'),
                'logo_path': logo_path
            }

            # Construir consulta dinámica
            if empresa_existente:
                # Actualizar registro existente
                update_fields = []
                update_values = []
                
                for key, value in params.items():
                    if value is not None:
                        update_fields.append(f"{key} = %s")
                        update_values.append(value)
                
                # Mantener logo anterior si no se sube uno nuevo
                if not logo_path:
                    # Si no hay nuevo logo, mantener el existente
                    update_fields = [f for f in update_fields if not f.startswith('logo_path')]
                    params.pop('logo_path', None)
                
                update_values.append(empresa_existente['id'])
                
                query = f"""
                    UPDATE empresa 
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                """
                cursor.execute(query, update_values)
            else:
                # Insertar nuevo registro
                keys = []
                values = []
                placeholders = []
                
                for key, value in params.items():
                    if value is not None:
                        keys.append(key)
                        values.append(value)
                        placeholders.append('%s')
                
                query = f"""
                    INSERT INTO empresa ({', '.join(keys)})
                    VALUES ({', '.join(placeholders)})
                """
                cursor.execute(query, values)
            
            conn.commit()
            
            # Obtener datos actualizados para devolver al frontend
            cursor.execute("SELECT * FROM empresa LIMIT 1")
            empresa_actualizada = cursor.fetchone()

            # Eliminar logo antiguo después de actualización exitosa
            if old_logo_to_delete and logo_path:
                try:
                    old_file_path = os.path.join(app_root, old_logo_to_delete)
                    if os.path.exists(old_file_path):
                        os.remove(old_file_path)
                        logger.info(f"Logo anterior eliminado: {old_file_path}")
                except Exception as e:
                    logger.error(f"Error eliminando logo anterior: {str(e)}")

            # Construir ruta completa del logo para la respuesta
            logo_path_response = None
            if empresa_actualizada.get('logo_path'):
                logo_path_response = f"/{empresa_actualizada['logo_path']}"

            return jsonify({
                'success': True, 
                'message': 'Configuración guardada correctamente',
                'empresa': {
                    'nombre': empresa_actualizada['nombre'],
                    'logo_path': logo_path_response,
                    'color_principal': empresa_actualizada['color_principal'],
                    'rnc': empresa_actualizada['rnc'],
                    'actividad_comercial': empresa_actualizada['actividad_comercial'],
                    'telefono': empresa_actualizada['telefono'],
                    'email': empresa_actualizada['email'],
                    'direccion': empresa_actualizada['direccion'],
                    'website': empresa_actualizada['website'],
                    'mensaje_legal': empresa_actualizada['mensaje_legal'],
                    'terminos': empresa_actualizada['terminos']
                }
            })

    except Exception as e:
        logger.error(f"ERROR en guardar_empresa: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Error en base de datos: {str(e)}'
        }), 500
    
    finally:
        if conn:
            conn.close()