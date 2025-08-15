
// Referencias a elementos DOM
const openModalBtn = document.getElementById('openModal');
const closeModalBtn = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelChanges');
const saveBtn = document.getElementById('saveChanges');
const modal = document.getElementById('configModal');
const tabBtns = document.querySelectorAll('.tab-btn');
const logoInput = document.getElementById('logo');
const logoPreview = document.getElementById('logoPreview');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const companyName = document.getElementById('companyName');
const companyLogo = document.getElementById('companyLogo');
const logoIcon = document.getElementById('logoIcon');
const companyLogoImg = document.getElementById('companyLogoImg');
const colorPrincipalInput = document.getElementById('color_principal');
const empresaForm = document.getElementById('empresaForm');

// Función para cargar datos de la empresa desde el backend
async function cargarDatosEmpresa() {
    try {
        const response = await fetch('/empresa/datos');
        if (!response.ok) {
            throw new Error('Error al cargar datos de la empresa');
        }
        
        const empresaData = await response.json();
        
        // Actualizar encabezado
        companyName.textContent = empresaData.nombre;
        companyLogo.style.background = empresaData.color_principal || '#3498db';
        
        // Actualizar logo si está disponible
        if (empresaData.logo_path) {
            companyLogoImg.src = empresaData.logo_path;
            companyLogoImg.style.display = 'block';
            logoIcon.style.display = 'none';
        } else {
            companyLogoImg.style.display = 'none';
            logoIcon.style.display = 'flex';
        }
        
        // Actualizar datos en la página principal
        document.getElementById('legalData').textContent = 
            `${empresaData.nombre} - RNC: ${empresaData.rnc || 'No disponible'}`;
            
        document.getElementById('contactData').textContent = 
            `${empresaData.direccion || 'Dirección no especificada'} | Tel: ${empresaData.telefono || 'N/A'}`;
            
        document.getElementById('messagesData').textContent = 
            empresaData.mensaje_legal || 'No se ha configurado un mensaje legal';
        
        // Actualizar formulario con datos de la empresa
        document.getElementById('nombre').value = empresaData.nombre || '';
        document.getElementById('rnc').value = empresaData.rnc || '';
        document.getElementById('actividad_comercial').value = empresaData.actividad_comercial || '';
        document.getElementById('telefono').value = empresaData.telefono || '';
        document.getElementById('email').value = empresaData.email || '';
        document.getElementById('direccion').value = empresaData.direccion || '';
        document.getElementById('website').value = empresaData.website || '';
        document.getElementById('mensaje_legal').value = empresaData.mensaje_legal || '';
        document.getElementById('terminos').value = empresaData.terminos || '';
        document.getElementById('color_principal').value = empresaData.color_principal || '#3498db';
        
        // Actualizar vista previa del logo en el modal
        if (empresaData.logo_path) {
            logoPreview.src = empresaData.logo_path;
        } else {
            logoPreview.src = '';
        }
        
        return empresaData;
    } catch (error) {
        console.error('Error cargando datos:', error);
        showToast('Error al cargar datos de la empresa', 'error');
        return null;
    }
}

// Abrir modal
openModalBtn.addEventListener('click', async () => {
    await cargarDatosEmpresa();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
});

// Cerrar modal
function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

// Cerrar al hacer clic fuera del modal
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// Guardar cambios
saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Validar formulario
    if (!empresaForm.checkValidity()) {
        empresaForm.reportValidity();
        return;
    }
    
    // Recoger datos del formulario
    const formData = new FormData(empresaForm);
    
    // Feedback visual: mostrar cargando
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    saveBtn.disabled = true;
    
    try {
        // Enviar datos al backend
        const response = await fetch('/empresa/guardar', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al guardar los cambios');
        }
        
        // Recargar datos después de guardar
        await cargarDatosEmpresa();
        
        // Mostrar notificación
        showToast('¡Configuración guardada correctamente!', 'success');
        
        // Cerrar modal después de guardar
        setTimeout(() => {
            closeModal();
        }, 1500);
    } catch (error) {
        console.error('Error guardando datos:', error);
        showToast('Error: ' + error.message, 'error');
    } finally {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
        saveBtn.disabled = false;
    }
});

// Manejar cambio de logo
logoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Validar tamaño del archivo (máximo 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('El archivo es demasiado grande (máximo 2MB)', 'error');
            logoInput.value = ''; // Limpiar input
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            // Actualizar vista previa
            logoPreview.src = event.target.result;
            
            // Feedback visual
            logoPreview.parentElement.style.borderColor = '#27ae60';
            logoPreview.parentElement.style.boxShadow = '0 0 0 3px rgba(39, 174, 96, 0.3)';
            
            setTimeout(() => {
                logoPreview.parentElement.style.borderColor = '';
                logoPreview.parentElement.style.boxShadow = '';
            }, 2000);
        };
        reader.readAsDataURL(file);
    }
});

// Funcionalidad de pestañas
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remover clase active de todos los botones
        tabBtns.forEach(b => b.classList.remove('active'));
        
        // Ocultar todos los contenidos
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Activar la pestaña clickeada
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Cerrar con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
    }
});

// Cambio de color principal
colorPrincipalInput.addEventListener('change', (e) => {
    document.documentElement.style.setProperty('--color-primary', e.target.value);
});

// Mostrar notificación
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Inicializar datos al cargar
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar datos iniciales
    await cargarDatosEmpresa();
});
