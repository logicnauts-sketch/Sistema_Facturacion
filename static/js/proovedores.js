// Función para formatear fecha
function formatDate(dateString) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dateString).toLocaleDateString('es-DO', options);
}

// Inicializar Notyf para notificaciones
const notyf = new Notyf({
    duration: 5000,
    position: { x: 'right', y: 'top' },
    types: [
        {
            type: 'success',
            background: '#28a745',
            icon: {
                className: 'fas fa-check-circle',
                tagName: 'i',
                color: '#fff'
            },
            dismissible: true
        },
        {
            type: 'error',
            background: '#dc3545',
            icon: {
                className: 'fas fa-exclamation-circle',
                tagName: 'i',
                color: '#fff'
            },
            dismissible: true
        }
    ]
});

// DOM Elements
const providersTable = document.getElementById('providers-table').querySelector('tbody');
const providerForm = document.getElementById('provider-form');
const providerModal = document.getElementById('provider-modal');
const historyModal = document.getElementById('history-modal');
const historyTableBody = document.getElementById('history-table-body');
const searchInput = document.getElementById('search-input');
const modalProviderName = document.getElementById('modal-provider-name');
const modalProviderRnc = document.getElementById('modal-provider-rnc');
const openProviderModalBtn = document.getElementById('open-provider-modal');
const payablesTable = document.getElementById('payables-table').querySelector('tbody');
const refreshPayablesBtn = document.getElementById('refresh-payables');

// Abrir modal de proveedores
openProviderModalBtn.addEventListener('click', () => {
    providerForm.reset();
    delete providerForm.dataset.editId;
    providerModal.classList.add('active');
    document.body.style.overflow = 'hidden';
});

// Obtener proveedores desde la API
async function obtenerProveedores() {
    try {
        const response = await fetch('/api/proveedores');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener proveedores');
        }
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        notyf.error(error.message);
        return [];
    }
}

// Obtener cuentas por pagar desde la API
async function obtenerCuentasPorPagar() {
    try {
        const response = await fetch('/api/cuentas_por_pagar');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener cuentas por pagar');
        }
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        notyf.error(error.message);
        return [];
    }
}

// Obtener estadísticas desde la API
async function obtenerEstadisticas() {
    try {
        const response = await fetch('/api/proveedores/stats');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener estadísticas');
        }
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        notyf.error(error.message);
        return {
            proveedores_activos: 0,
            facturas_pendientes: 0,
            total_por_pagar: 0
        };
    }
}

// Actualizar las tarjetas de estadísticas
async function actualizarEstadisticas() {
    const stats = await obtenerEstadisticas();
    
    // Actualizar el DOM
    document.getElementById('stat-proveedores').textContent = stats.proveedores_activos;
    document.getElementById('stat-facturas').textContent = stats.facturas_pendientes;
    document.getElementById('stat-total').textContent = `RD$ ${stats.total_por_pagar.toLocaleString('es-DO')}`;
}

// Renderizar tabla de proveedores
async function renderProvidersTable() {
    try {
        const proveedores = await obtenerProveedores();
        providersTable.innerHTML = '';
        
        if (proveedores.length === 0) {
            providersTable.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <i class="fas fa-search fa-2x mb-2"></i>
                        <p>No se encontraron proveedores</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        proveedores.forEach(provider => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${provider.nombre}</td>
                <td>${provider.rnc_cedula}</td>
                <td>${provider.telefono || ''}</td>
                <td>
                    <span class="status-badge ${provider.estado === 'Activo' ? 'status-active' : 'status-inactive'}">
                        ${provider.estado}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view-history" data-id="${provider.id}" data-name="${provider.nombre}" data-rnc="${provider.rnc_cedula}">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="action-btn edit-provider" data-id="${provider.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-provider" data-id="${provider.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            providersTable.appendChild(row);
        });
        
        // Agregar event listeners a los botones
        document.querySelectorAll('.view-history').forEach(button => {
            button.addEventListener('click', openHistoryModal);
        });
        
        document.querySelectorAll('.edit-provider').forEach(button => {
            button.addEventListener('click', editProvider);
        });
        
        document.querySelectorAll('.delete-provider').forEach(button => {
            button.addEventListener('click', deleteProvider);
        });
        
    } catch (error) {
        console.error('Error al renderizar proveedores:', error);
        notyf.error('Error al cargar la tabla de proveedores');
    }
}

// Renderizar tabla de cuentas por pagar
async function renderCuentasPorPagar() {
    try {
        const cuentas = await obtenerCuentasPorPagar();
        payablesTable.innerHTML = '';
        
        if (cuentas.length === 0) {
            payablesTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="fas fa-search fa-2x mb-2"></i>
                        <p>No se encontraron cuentas por pagar</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        cuentas.forEach(cuenta => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${cuenta.proveedor}</td>
                <td>${cuenta.numero_factura}</td>
                <td>${formatDate(cuenta.fecha_vencimiento)}</td>
                <td>RD$ ${cuenta.monto.toLocaleString('es-DO')}</td>
                <td><span class="status-badge ${cuenta.estado === 'Pendiente' ? 'status-pending' : 'status-active'}">${cuenta.estado}</span></td>
                <td>
                    ${cuenta.estado === 'Pendiente' ? 
                        `<button class="btn btn-success btn-sm mark-paid" data-id="${cuenta.id}">
                            <i class="fas fa-check"></i> Pagar
                        </button>` : 
                        `<button class="btn btn-outline btn-sm" disabled>
                            <i class="fas fa-check"></i> Pagado
                        </button>`
                    }
                </td>
            `;
            
            payablesTable.appendChild(row);
        });
        
        // Agregar event listeners a los botones de pagar
        document.querySelectorAll('.mark-paid').forEach(button => {
            button.addEventListener('click', marcarComoPagada);
        });
        
    } catch (error) {
        console.error('Error al renderizar cuentas por pagar:', error);
        notyf.error('Error al cargar la tabla de cuentas por pagar');
    }
}

// Abrir modal de historial (compras a proveedor)
async function openHistoryModal(e) {
    const button = e.target.closest('.view-history');
    const providerId = button.dataset.id;
    const providerName = button.dataset.name;
    const providerRnc = button.dataset.rnc;
    
    modalProviderName.textContent = providerName;
    modalProviderRnc.textContent = providerRnc;
    
    try {
        const response = await fetch(`/api/proveedores/${providerId}/cuentas`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener el historial');
        }
        const cuentas = await response.json();
        
        historyTableBody.innerHTML = '';
        if (cuentas.length === 0) {
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4">
                        <i class="fas fa-info-circle fa-2x mb-2"></i>
                        <p>No se encontraron facturas para este proveedor</p>
                    </td>
                </tr>
            `;
        } else {
            cuentas.forEach(cuenta => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${formatDate(cuenta.fecha_emision)}</td>
                    <td>${cuenta.numero_factura}</td>
                    <td>RD$ ${cuenta.monto.toLocaleString('es-DO')}</td>
                    <td>
                        <span class="status-badge ${cuenta.estado === 'Pendiente' ? 'status-pending' : 'status-active'}">
                            ${cuenta.estado}
                        </span>
                    </td>
                `;
                
                historyTableBody.appendChild(row);
            });
        }
        
        // Mostrar modal
        historyModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error:', error);
        historyTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-danger">
                    <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                    <p>Error al cargar el historial: ${error.message}</p>
                </td>
            </tr>
        `;
        notyf.error(`Error al cargar el historial: ${error.message}`);
    }
}

// Cerrar modal
document.querySelectorAll('.modal-close').forEach(button => {
    button.addEventListener('click', () => {
        providerModal.classList.remove('active');
        historyModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    });
});

// Cerrar modal al hacer clic fuera del contenido
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });
});

// Validación de formulario
providerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validar campos obligatorios
    const nameInput = document.getElementById('name');
    const rncInput = document.getElementById('rnc');
    const emailInput = document.getElementById('email');
    
    let isValid = true;
    
    if (!nameInput.value.trim()) {
        nameInput.classList.add('error');
        isValid = false;
    } else {
        nameInput.classList.remove('error');
    }
    
    if (!rncInput.value.trim()) {
        rncInput.classList.add('error');
        isValid = false;
    } else {
        rncInput.classList.remove('error');
    }
    
    if (!emailInput.value.trim() || !validateEmail(emailInput.value)) {
        emailInput.classList.add('error');
        isValid = false;
    } else {
        emailInput.classList.remove('error');
    }
    
    if (isValid) {
        const proveedor = {
            nombre: nameInput.value,
            rnc_cedula: rncInput.value,
            telefono: document.getElementById('phone').value,
            email: emailInput.value,
            direccion: document.getElementById('address').value,
            estado: document.getElementById('status').checked ? 'Activo' : 'Inactivo'
        };
        
        try {
            let response;
            const editId = providerForm.dataset.editId;
            
            if (editId) {
                // Actualización
                response = await fetch(`/api/proveedores/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(proveedor)
                });
                delete providerForm.dataset.editId;
            } else {
                // Creación
                response = await fetch('/api/proveedores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(proveedor)
                });
            }
            
            if (response.ok) {
                const result = await response.json();
                notyf.success(editId ? 'Proveedor actualizado correctamente' : 'Proveedor creado correctamente');
                providerForm.reset();
                providerModal.classList.remove('active');
                await renderProvidersTable();
                await actualizarEstadisticas(); // Actualizar estadísticas
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al guardar el proveedor');
            }
        } catch (error) {
            console.error('Error al guardar proveedor:', error);
            notyf.error(error.message);
        }
    }
});

// Validar email
function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Búsqueda de proveedores
searchInput.addEventListener('input', async () => {
    const searchTerm = searchInput.value.toLowerCase();
    
    try {
        const proveedores = await obtenerProveedores();
        const filteredProviders = proveedores.filter(provider => {
            return (
                provider.nombre.toLowerCase().includes(searchTerm) ||
                provider.rnc_cedula.toLowerCase().includes(searchTerm) ||
                (provider.email && provider.email.toLowerCase().includes(searchTerm))
            );
        });
        
        // Renderizar la tabla filtrada
        renderFilteredProvidersTable(filteredProviders);
    } catch (error) {
        console.error('Error en búsqueda:', error);
        notyf.error('Error al realizar la búsqueda');
    }
});

function renderFilteredProvidersTable(proveedores) {
    providersTable.innerHTML = '';
    
    if (proveedores.length === 0) {
        providersTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <i class="fas fa-search fa-2x mb-2"></i>
                    <p>No se encontraron proveedores</p>
                </td>
            </tr>
        `;
        return;
    }
    
    proveedores.forEach(provider => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${provider.nombre}</td>
            <td>${provider.rnc_cedula}</td>
            <td>${provider.telefono || ''}</td>
            <td>
                <span class="status-badge ${provider.estado === 'Activo' ? 'status-active' : 'status-inactive'}">
                    ${provider.estado}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-history" data-id="${provider.id}" data-name="${provider.nombre}" data-rnc="${provider.rnc_cedula}">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="action-btn edit-provider" data-id="${provider.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-provider" data-id="${provider.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        providersTable.appendChild(row);
    });
    
    // Agregar event listeners a los botones
    document.querySelectorAll('.view-history').forEach(button => {
        button.addEventListener('click', openHistoryModal);
    });
    
    document.querySelectorAll('.edit-provider').forEach(button => {
        button.addEventListener('click', editProvider);
    });
    
    document.querySelectorAll('.delete-provider').forEach(button => {
        button.addEventListener('click', deleteProvider);
    });
}

// Editar proveedor
async function editProvider(e) {
    const providerId = e.target.closest('.edit-provider').dataset.id;
    
    try {
        const response = await fetch(`/api/proveedores/${providerId}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener proveedor');
        }
        const provider = await response.json();
        
        if (provider) {
            providerModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            document.getElementById('name').value = provider.nombre;
            document.getElementById('rnc').value = provider.rnc_cedula;
            document.getElementById('phone').value = provider.telefono || '';
            document.getElementById('email').value = provider.email;
            document.getElementById('address').value = provider.direccion || '';
            document.getElementById('status').checked = provider.estado === 'Activo';
            
            // Guardar ID en el formulario para la actualización
            providerForm.dataset.editId = provider.id;
            updateStatusBadge();
        }
    } catch (error) {
        console.error('Error al cargar proveedor:', error);
        notyf.error(error.message);
    }
}

// Actualizar el badge de estado
function updateStatusBadge() {
    const statusInput = document.getElementById('status');
    const statusBadge = document.getElementById('status-badge');
    
    if (statusInput && statusBadge) {
        const isActive = statusInput.checked;
        statusBadge.textContent = isActive ? 'Activo' : 'Inactivo';
        statusBadge.className = isActive ? 
            'status-badge status-active' : 
            'status-badge status-inactive';
    }
}

// Event listener para el switch de estado
document.getElementById('status').addEventListener('change', updateStatusBadge);

// Eliminar proveedor
async function deleteProvider(e) {
    const providerId = e.target.closest('.delete-provider').dataset.id;
    
    try {
        const result = await Swal.fire({
            title: '¿Está seguro?',
            text: "Esta acción eliminará permanentemente al proveedor y no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        
        if (result.isConfirmed) {
            const response = await fetch(`/api/proveedores/${providerId}`, { 
                method: 'DELETE' 
            });
            
            if (response.ok) {
                await renderProvidersTable();
                await actualizarEstadisticas(); // Actualizar estadísticas
                notyf.success('Proveedor eliminado correctamente');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al eliminar el proveedor');
            }
        }
    } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        notyf.error(error.message);
    }
}

// Marcar factura como pagada
async function marcarComoPagada(e) {
    const cuentaId = e.target.closest('.mark-paid').dataset.id;
    
    try {
        const result = await Swal.fire({
            title: '¿Marcar como pagada?',
            text: "Esta acción registrará el pago de la factura",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, marcar como pagada',
            cancelButtonText: 'Cancelar'
        });
        
        if (result.isConfirmed) {
            const response = await fetch(`/api/cuentas_por_pagar/pagar/${cuentaId}`, { 
                method: 'POST' 
            });
            
            if (response.ok) {
                await renderCuentasPorPagar();
                await actualizarEstadisticas(); // Actualizar estadísticas
                notyf.success('Factura marcada como pagada correctamente');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al marcar la factura como pagada');
            }
        }
    } catch (error) {
        console.error('Error al marcar como pagada:', error);
        notyf.error(error.message);
    }
}

// Actualizar cuentas por pagar
refreshPayablesBtn.addEventListener('click', async () => {
    try {
        await renderCuentasPorPagar();
        notyf.success('Cuentas por pagar actualizadas');
    } catch (error) {
        console.error('Error al actualizar cuentas:', error);
        notyf.error('Error al actualizar cuentas por pagar');
    }
});

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await renderProvidersTable();
        await renderCuentasPorPagar();
        await actualizarEstadisticas(); // Nueva función para estadísticas
        updateStatusBadge(); // Inicializar el badge
    } catch (error) {
        console.error('Error de inicialización:', error);
        notyf.error('Error al inicializar la aplicación');
    }
});