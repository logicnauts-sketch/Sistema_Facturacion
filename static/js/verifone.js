// Estado de la aplicación
const appState = {
    printers: [],
    editingPrinterId: null
};

// Elementos del DOM
const elements = {
    addPrinterBtn: document.getElementById('addPrinterBtn'),
    printersContainer: document.getElementById('printersContainer'),
    printerModal: document.getElementById('printerModal'),
    modalTitle: document.getElementById('modalTitle'),
    printerForm: document.getElementById('printerForm'),
    printerId: document.getElementById('printerId'),
    nombreInput: document.getElementById('nombre'),
    vendorInput: document.getElementById('vendor'),
    productInput: document.getElementById('product'),
    portInput: document.getElementById('port'),
    baudrateInput: document.getElementById('baudrate'),
    closeModal: document.querySelector('.close'),
    cancelBtn: document.getElementById('cancelBtn')
};

// Funciones para cargar impresoras
async function loadPrinters() {
    try {
        const resp = await fetch('/verifone/impresoras');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        appState.printers = await resp.json();
        renderPrinters();
    } catch (err) {
        
    }
}

// Renderizar impresoras en tarjetas con Flexbox
function renderPrinters() {
    elements.printersContainer.innerHTML = '';
    
    if (appState.printers.length === 0) {
        elements.printersContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-print fa-3x"></i>
                <h3>No hay impresoras configuradas</h3>
                <p>Agrega tu primera impresora para comenzar</p>
            </div>
        `;
        
        document.getElementById('addFirstPrinter').addEventListener('click', openAddModal);
        return;
    }
    
    appState.printers.forEach(printer => {
        const card = document.createElement('div');
        card.className = 'printer-card';
        card.innerHTML = `
            <div class="printer-header">
                <h3 class="printer-name">
                    <i class="fas fa-print"></i> ${printer.nombre}
                </h3>
                <div class="printer-actions">
                    <button class="edit" data-id="${printer.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete" data-id="${printer.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="printer-detail">
                <span class="printer-label">
                    <i class="fas fa-id-card"></i> Vendor ID:
                </span>
                <span class="printer-value">${printer.vendor}</span>
            </div>
            <div class="printer-detail">
                <span class="printer-label">
                    <i class="fas fa-barcode"></i> Product ID:
                </span>
                <span class="printer-value">${printer.product}</span>
            </div>
            <div class="printer-detail">
                <span class="printer-label">
                    <i class="fas fa-plug"></i> Puerto:
                </span>
                <span class="printer-value">${printer.port || 'N/A'}</span>
            </div>
            <div class="printer-detail">
                <span class="printer-label">
                    <i class="fas fa-tachometer-alt"></i> Baud Rate:
                </span>
                <span class="printer-value">${printer.baudrate || 9600}</span>
            </div>
            <div class="printer-detail">
                <span class="printer-label">
                    <i class="fas fa-circle"></i> Estado:
                </span>
                <span class="printer-value">
                    <span class="status-indicator status-disconnected"></span>
                    <span class="printer-status" data-id="${printer.id}">Sin verificar</span>
                </span>
            </div>
            <div class="test-connection">
                <button class="btn btn-sm btn-primary test-btn" data-id="${printer.id}">
                    <i class="fas fa-plug"></i> Probar Conexión
                </button>
                <div class="test-result hidden" data-id="${printer.id}"></div>
            </div>
        `;
        elements.printersContainer.appendChild(card);
    });
    
    // Añadir event listeners
    document.querySelectorAll('.printer-actions .edit').forEach(btn => {
        btn.addEventListener('click', (e) => openEditModal(e.target.closest('button').dataset.id));
    });
    
    document.querySelectorAll('.printer-actions .delete').forEach(btn => {
        btn.addEventListener('click', (e) => deletePrinter(e.target.closest('button').dataset.id));
    });
    
    document.querySelectorAll('.test-btn').forEach(btn => {
        btn.addEventListener('click', (e) => testConnection(e.target.closest('button').dataset.id));
    });
}

// Abrir modal para editar
function openEditModal(printerId) {
    const printer = appState.printers.find(p => p.id == printerId);
    if (!printer) return;
    
    appState.editingPrinterId = printerId;
    elements.modalTitle.textContent = 'Editar Impresora';
    elements.printerId.value = printerId;
    elements.nombreInput.value = printer.nombre;
    elements.vendorInput.value = printer.vendor;
    elements.productInput.value = printer.product;
    elements.portInput.value = printer.port || '';
    elements.baudrateInput.value = printer.baudrate || 9600;
    elements.printerModal.classList.remove('hidden');
}

// Abrir modal para agregar
function openAddModal() {
    appState.editingPrinterId = null;
    elements.modalTitle.textContent = 'Agregar Nueva Impresora';
    elements.printerForm.reset();
    elements.printerModal.classList.remove('hidden');
}

// Cerrar modal
function closeModal() {
    elements.printerModal.classList.add('hidden');
}

// Enviar formulario (agregar o actualizar)
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const printerData = {
        nombre: elements.nombreInput.value,
        vendor: elements.vendorInput.value,
        product: elements.productInput.value,
        port: elements.portInput.value,
        baudrate: elements.baudrateInput.value
    };
    
    const url = appState.editingPrinterId 
        ? `/verifone/impresoras/${appState.editingPrinterId}`
        : '/verifone/impresoras';
    
    const method = appState.editingPrinterId ? 'PUT' : 'POST';
    
    try {
        const resp = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(printerData)
        });
        
        if (!resp.ok) {
            const errorData = await resp.json();
            throw new Error(errorData.error || 'Error desconocido');
        }
        
        closeModal();
        await loadPrinters();
        showNotification(
            `Impresora ${appState.editingPrinterId ? 'actualizada' : 'agregada'} con éxito`,
            'success'
        );
    } catch (err) {
        showNotification(`Error: ${err.message}`, 'error');
    }
}

// Eliminar impresora
async function deletePrinter(printerId) {
    if (!confirm('¿Estás seguro de eliminar esta impresora?')) return;
    
    try {
        const resp = await fetch(`/verifone/impresoras/${printerId}`, {
            method: 'DELETE'
        });
        
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        
        await loadPrinters();
        showNotification('Impresora eliminada con éxito', 'success');
    } catch (err) {
        showNotification('Error al eliminar impresora', 'error');
    }
}

// Probar conexión
async function testConnection(printerId) {
    const printer = appState.printers.find(p => p.id == printerId);
    if (!printer) return;
    
    const testBtn = document.querySelector(`.test-btn[data-id="${printerId}"]`);
    const testResult = document.querySelector(`.test-result[data-id="${printerId}"]`);
    const statusElement = document.querySelector(`.printer-status[data-id="${printerId}"]`);
    const statusIndicator = document.querySelector(`.status-indicator[data-id="${printerId}"]`);
    
    // Actualizar UI
    testBtn.disabled = true;
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Probando...';
    testResult.classList.add('hidden');
    
    try {
        const resp = await fetch('/verifone/probar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                port: printer.port,
                baudrate: printer.baudrate || 9600
            })
        });
        
        const result = await resp.json();
        
        if (result.success) {
            testResult.textContent = '¡Conexión exitosa!';
            testResult.className = 'test-result test-success';
            statusElement.textContent = 'Conectado';
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator status-connected';
            }
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (err) {
        testResult.textContent = `Error: ${err.message}`;
        testResult.className = 'test-result test-error';
        statusElement.textContent = 'Error de conexión';
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator status-error';
        }
    } finally {
        testResult.classList.remove('hidden');
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="fas fa-plug"></i> Probar Conexión';
    }
}

// Mostrar notificación
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Cargar impresoras al inicio
    loadPrinters();
    
    // Event listeners
    elements.addPrinterBtn.addEventListener('click', openAddModal);
    elements.closeModal.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.printerForm.addEventListener('submit', handleFormSubmit);
    
    // Cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', (e) => {
        if (e.target === elements.printerModal) {
            closeModal();
        }
    });
});