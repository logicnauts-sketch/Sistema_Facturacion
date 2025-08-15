from flask import Blueprint, render_template, jsonify, send_file
from version_utils import obtener_releases,  descargar_y_extraer_zip, leer_detalles_version
import os, shutil, requests
from datetime import datetime


# Definir UPLOAD_FOLDER dentro de este archivo
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "archivos")     # Carpeta para guardar archivos
DESTINATION_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Crear la carpeta si no existe
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

bp = Blueprint('versiones', __name__)


@bp.route('/versiones')
def versiones():
    try:
        # Leer los detalles de la versión actual desde el archivo
        datos = leer_detalles_version()

        # Renderizar la plantilla con los detalles
        return render_template(
            "versiones.html",
            datos=datos # Detalles de la nueva versión, si existe
        )

    except Exception as e:
        # Si ocurre un error, solo renderizamos la plantilla sin los detalles
        print(f"Error en la ruta '/versiones': {e}")  # Para depuración
        return render_template("versiones.html")



# Ruta para comprobar si hay una nueva versión
@bp.route('/check_for_update', methods=['POST'])
def check_for_update():
    # Llamamos a la función que obtiene las versiones desde GitHub
    versions, new_version_available, _ = obtener_releases()

    # Retornar si hay una nueva versión disponible
    return jsonify({"new_version_available": new_version_available})


# Define la variable DESTINATION_FOLDER antes de usarla


@bp.route('/download_latest_version', methods=['GET'])
def download_latest_version():
    try:
        # Obtener la última versión y los datos
        versions, new_version_available, latest_release = obtener_releases()
        version_details_path = os.path.join(DESTINATION_FOLDER, "Version_details.txt")
        fecha_formateada = datetime.strptime(latest_release['published_at'], "%Y-%m-%dT%H:%M:%SZ").strftime("%d/%m/%Y")

        if latest_release and latest_release["assets"]:
            downloaded_files = []  # Lista para registrar archivos descargados

            # Descargar y extraer el archivo ZIP
            for asset in latest_release["assets"]:
                asset_url = asset["browser_download_url"]
                file_name = asset["name"]

                # Descargar y extraer el archivo ZIP en la carpeta `archivos/versiones`
                success, message = descargar_y_extraer_zip(asset_url, file_name, UPLOAD_FOLDER)

                if success:
                    downloaded_files.append(file_name)
                else:
                    return jsonify({"error": message}), 400

            # Mover los archivos extraídos de "archivos/versiones" al destino
            versiones_folder = os.path.join(UPLOAD_FOLDER, 'versiones')
            if os.path.exists(versiones_folder):
                # Recorrer la carpeta 'versiones' y mover los archivos con su estructura de directorios
                for root, dirs, files in os.walk(versiones_folder):
                    for file in files:
                        # Ruta completa del archivo en 'versiones'
                        source_path = os.path.join(root, file)
                        # Mantenemos la estructura de directorios en el destino
                        relative_path = os.path.relpath(source_path, versiones_folder)
                        destination_path = os.path.join(DESTINATION_FOLDER, relative_path)

                        # Crear el directorio destino si no existe
                        os.makedirs(os.path.dirname(destination_path), exist_ok=True)

                        # Si el archivo ya existe, eliminarlo
                        if os.path.exists(destination_path):
                            os.remove(destination_path)

                        # Mover el archivo
                        shutil.move(source_path, destination_path)

                # Eliminar la carpeta 'versiones' si está vacía
                if os.listdir(versiones_folder):
                    shutil.rmtree(versiones_folder)
                    shutil.rmtree(UPLOAD_FOLDER)

            # Verificar si el archivo 'Version_details.txt' existe y leer las versiones existentes
            if os.path.exists(version_details_path):
                versiones_existentes = leer_detalles_version()

                # Verificar si la versión nueva ya está en el archivo
                version_nueva = latest_release['name']
                for version in versiones_existentes:
                    if version['nombre'] == version_nueva:
                        print(f"La versión {version_nueva} ya existe, no se agregará.")
                        return jsonify({"message": "La versión ya existe en el archivo."}), 200

                # Preparar los detalles de la nueva versión
                nueva_version = (
                    f"Nombre de la versión: {latest_release['name']}\n"
                    f"Descripción: {latest_release.get('body', 'No disponible')}\n"
                    f"Fecha de creación: {fecha_formateada}\n\n"
                )

                # Leer el contenido actual del archivo
                with open(version_details_path, 'r', encoding='utf-8') as f:
                    contenido_existente = f.read()

                # Sobrescribir el archivo, agregando la nueva versión al inicio
                with open(version_details_path, 'w', encoding='utf-8') as f:
                    f.write(nueva_version)  # Escribir la nueva versión al principio
                    f.write(contenido_existente)  # Escribir el contenido existente después

                print(f"Versión {version_nueva} agregada correctamente.")
                return jsonify({"message": "Nueva versión agregada correctamente."}), 200

            else:
                # Crear el archivo 'Version_details.txt' con los detalles de la primera versión
                with open(version_details_path, 'w', encoding='utf-8') as f:
                    f.write(f"Nombre de la versión: {latest_release['name']}\n")
                    f.write(f"Descripción: {latest_release.get('body', 'No disponible')}\n")
                    f.write(f"Fecha de creación: {fecha_formateada}\n")
                    print(f"Archivo 'Version_details.txt' creado y versión {latest_release['name']} agregada.")


            return jsonify({"message": "Archivos descargados y extraídos correctamente", "files": downloaded_files}), 200

        return jsonify({"error": "No hay archivos disponibles para descargar en la última versión."}), 400

    except requests.RequestException as e:
        print(f"Error al descargar los archivos: {e}")
        return jsonify({"error": f"Error al descargar los archivos: {str(e)}"}), 500

    except Exception as e:
        print(f"Error inesperado: {e}")
        return jsonify({"error": f"Error inesperado: {str(e)}"}), 500
