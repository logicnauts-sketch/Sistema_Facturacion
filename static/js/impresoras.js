document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const addPrinterBtn = document.getElementById('addPrinterBtn');
    const printersContainer = document.getElementById('printersContainer');
    const printerModal = document.getElementById('printerModal');
    const detailsModal = document.getElementById('detailsModal');
    const closeModal = document.getElementById('closeModal');
    const closeDetailsModal = document.getElementById('closeDetailsModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const printerForm = document.getElementById('printerForm');
    const detailsContent = document.getElementById('detailsContent');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const modalTitle = document.getElementById('modalTitle');
    
    // Variables globales
    let currentPrinterId = null;

    // Event Listeners
    addPrinterBtn.addEventListener('click', () => openModal('add'));
    closeModal.addEventListener('click', closePrinterModal);
    closeDetailsModal.addEventListener('click', closeDetails);
    cancelBtn.addEventListener('click', closePrinterModal);
    printerForm.addEventListener('submit', savePrinter);
    
    // Cargar impresoras al iniciar
    loadPrinters();
    
    // Función para abrir modal en modo agregar o editar
    function openModal(mode, printer = null) {
        if (mode === 'add') {
            modalTitle.innerHTML = '<i class="fas fa-plus"></i> Agregar Impresora';
            printerForm.reset();
            currentPrinterId = null;
        } else if (mode === 'edit' && printer) {
            modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Impresora';
            currentPrinterId = printer.id;
            fillForm(printer);
        }
        
        printerModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    // Llenar formulario con datos de impresora
    function fillForm(printer) {
        document.getElementById('printerId').value = printer.id;
        document.getElementById('vendor').value = printer.vendor_id || '';
        document.getElementById('product').value = printer.product_id || '';
        document.getElementById('name').value = printer.nombre || '';
        document.getElementById('type').value = printer.tipo || 'USB';
        document.getElementById('model').value = printer.modelo || '';
        document.getElementById('ip').value = printer.ip || '';
        document.getElementById('location').value = printer.ubicacion || '';
    }
    
    // Cerrar modal de impresora
    function closePrinterModal() {
        printerModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    // Cerrar modal de detalles
    function closeDetails() {
        detailsModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    // Guardar impresora (nueva o existente)
    function savePrinter(e) {
        e.preventDefault();
        
        const printerData = {
            vendor_id: document.getElementById('vendor').value,
            product_id: document.getElementById('product').value,
            nombre: document.getElementById('name').value,
            tipo: document.getElementById('type').value,
            modelo: document.getElementById('model').value,
            ip: document.getElementById('ip').value,
            ubicacion: document.getElementById('location').value,
            estado: 'Conectado'
        };
        
        // Solo incluye el ID si estamos editando
        if (currentPrinterId) {
            printerData.id = currentPrinterId;
        }
        
        const url = currentPrinterId 
            ? `/impresoras/api/${currentPrinterId}`
            : '/impresoras/api';
            
        const method = currentPrinterId ? 'PUT' : 'POST';
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(printerData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showConfirmation();
                closePrinterModal();
                loadPrinters();
            } else {
                alert('Error al guardar la impresora: ' + (data.message || ''));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocurrió un error al guardar la impresora');
        });
    }
    
    // Cargar todas las impresoras
    function loadPrinters() {
        fetch('/impresoras/api')
        .then(response => response.json())
        .then(printers => {
            renderPrinters(printers);
        })
        .catch(error => {
            console.error('Error cargando impresoras:', error);
            printersContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar las impresoras</p>
                </div>
            `;
        });
    }
    
    // Renderizar impresoras en cards
    function renderPrinters(printers) {
        if (printers.length === 0) {
            printersContainer.innerHTML = `
                <div class="no-printers">
                    <i class="fas fa-print"></i>
                    <h3>No hay impresoras registradas</h3>
                    <p>Agregue una impresora para comenzar</p>
                </div>
            `;
            return;
        }
        
        printersContainer.innerHTML = '';
        
        printers.forEach(printer => {
            const card = document.createElement('div');
            card.className = 'printer-card';
            card.innerHTML = `
                <div class="printer-header">
                    <div class="printer-name">${printer.nombre}</div>
                    <div class="printer-type">${printer.tipo}</div>
                </div>
                
                <div class="printer-details">
                    <div class="detail-row">
                        <div class="detail-label">Modelo:</div>
                        <div class="detail-value">${printer.modelo || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Ubicación:</div>
                        <div class="detail-value">${printer.ubicacion}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Estado:</div>
                        <div class="detail-value">
                            <span class="status ${printer.estado.toLowerCase().includes('conectado') ? 'connected' : 'disconnected'}">
                                ${printer.estado}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="card-actions">
                    <button class="action-btn btn-view" data-id="${printer.id}">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    <button class="action-btn btn-edit" data-id="${printer.id}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn btn-delete" data-id="${printer.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            `;
            printersContainer.appendChild(card);
        });
        
        // Agregar event listeners a los botones
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', () => viewPrinter(btn.dataset.id));
        });
        
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editPrinter(btn.dataset.id));
        });
        
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deletePrinter(btn.dataset.id));
        });
    }
    
    // Ver detalles de impresora
    function viewPrinter(id) {
        fetch(`/impresoras/api/${id}`)
        .then(response => response.json())
        .then(printer => {
            detailsContent.innerHTML = `
                <div class="details-grid">
                    <div class="detail-item">
                        <div class="detail-title">Nombre</div>
                        <div>${printer.nombre}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-title">Tipo</div>
                        <div>${printer.tipo}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-title">Modelo</div>
                        <div>${printer.modelo || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-title">Vendor ID</div>
                        <div>${printer.vendor_id || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-title">Product ID</div>
                        <div>${printer.product_id || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-title">IP</div>
                        <div>${printer.ip || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-title">Ubicación</div>
                        <div>${printer.ubicacion}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-title">Estado</div>
                        <div class="status ${printer.estado.toLowerCase().includes('conectado') ? 'connected' : 'disconnected'}">
                            ${printer.estado}
                        </div>
                    </div>
                </div>
            `;
            detailsModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    }
    
    // Editar impresora
    function editPrinter(id) {
        fetch(`/impresoras/api/${id}`)
        .then(response => response.json())
        .then(printer => {
            openModal('edit', printer);
        });
    }
    
    // Eliminar impresora
    function deletePrinter(id) {
        if (!confirm('¿Está seguro de eliminar esta impresora?')) return;
        
        fetch(`/impresoras/api/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showConfirmation();
                loadPrinters();
            } else {
                alert('Error al eliminar la impresora');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocurrió un error al eliminar la impresora');
        });
    }
    
    // Mostrar mensaje de confirmación
    function showConfirmation() {
        confirmationMessage.style.display = 'block';
        setTimeout(() => {
            confirmationMessage.style.display = 'none';
        }, 3000);
    }
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', function(event) {
        if (event.target === printerModal) {
            closePrinterModal();
        }
        if (event.target === detailsModal) {
            closeDetails();
        }
    });
});