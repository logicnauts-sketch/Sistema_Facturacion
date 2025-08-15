// Crear una instancia de Notyf
const notyf = new Notyf({
  duration: 3000,
  position: { x: 'right', y: 'top' },
});

// Función para manejar la verificación de actualizaciones
document.getElementById('checkUpdateBtn').addEventListener('click', function() {
  // Mostrar el modal de carga
  document.getElementById('loadingModal').style.display = 'flex';
  document.getElementById('checkUpdateBtn').disabled = true;

  // Simulamos un retraso de 3 segundos para la petición
  setTimeout(function() {
    fetch('/check_for_update', {
      method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
      // Ocultar el modal de carga
      document.getElementById('loadingModal').style.display = 'none';

      // Mostrar el modal con el resultado de la actualización
      document.getElementById('updateModal').style.display = 'flex';

      // Verificar si hay una nueva versión
      if (data.new_version_available) {
        document.getElementById('updateMessage').innerText = "¡Hay una nueva versión disponible! Haz clic en 'Actualizar' para actualizar.";
        document.getElementById('updateBtn').style.display = 'inline-block'; // Mostrar el botón de actualizar
        notyf.success('¡Nueva versión disponible! Puedes actualizar.');
      } else {
        document.getElementById('updateMessage').innerText = "Estás usando la última versión.";
        document.getElementById('updateBtn').style.display = 'none'; // Ocultar el botón de actualizar
        notyf.success('Estás usando la última versión.');
        closeModal(); // Cerrar el modal si no hay nueva versión
        setTimeout(() => location.reload(), 3000);
      }
    })
    .catch(error => {
      console.error('Error al comprobar la actualización:', error);
      document.getElementById('loadingModal').style.display = 'none';
      notyf.error('Hubo un error al comprobar la actualización.');
    });
  }, 3000); // Simulamos un retraso de 3 segundos
});

// Descargar e insertar archivos al hacer clic en el botón de actualizar
document.getElementById('updateBtn').addEventListener('click', function () {
  const updateModal = document.getElementById('updateModal');
  const updateBtn = document.getElementById('updateBtn'); // Obtener el botón de actualizar
  const modalContent = updateModal.querySelector('.modal-content'); // Obtener el contenido del modal

  // Ocultar el botón "Actualizar" cuando se haga clic en él
  updateBtn.style.display = 'none';

  // Cambiar el contenido del modal a un spinner
  modalContent.innerHTML = '<div class="spinner"></div>';

  // Inicia la descarga real
  fetch('/download_latest_version')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error en la descarga: ${response.status}`);
      }
      return response.blob(); // Descargar el archivo como un blob
    })
    .then(blob => {
      updateModal.classList.add('hidden'); // Ocultar el modal con el spinner
      setTimeout(showDownloadCompleteNotification, 3000); // Mostrar notificación después de 3 segundos
    })
    .catch(error => {
      console.error('Error al obtener la última versión:', error);
      notyf.error('Error al descargar la última versión.');
      closeModal(); // Cerrar el modal en caso de error
    });
});

// Función para cerrar el modal
function closeModal() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.style.display = 'none'; // Ocultar todos los modales
  });
}

// Función para mostrar la notificación de "Descarga completada!"
function showDownloadCompleteNotification() {
  notyf.success('Descarga completada!');

  // Recargar la página después de que la notificación desaparezca
  setTimeout(() => location.reload(), 3000);
}

// Función para cerrar el modal al hacer clic fuera de él
document.getElementById('updateModal').addEventListener('click', function (event) {
  if (event.target === event.currentTarget) {
    closeModal(); // Cierra el modal si se hace clic fuera
  }
});

// Función para alternar la visibilidad de los detalles de la versión
function toggleDetails(element) {
  const details = element.querySelector('.version-details');
  const allDetails = document.querySelectorAll('.version-details');

  // Cerrar otros detalles abiertos
  allDetails.forEach(detail => {
    if (detail !== details) {
      detail.style.display = 'none';
    }
  });

  // Alternar la visibilidad del detalle seleccionado
  details.style.display = details.style.display === 'block' ? 'none' : 'block';
}
