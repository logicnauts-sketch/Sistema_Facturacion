// Datos de ejemplo para simular el backend
const mockClients = Array.from({length: 45}, (_, i) => ({
    id: i + 1,
    nombre: `Cliente ${i + 1}`,
    cedula: `00${i % 3}-${1234567 + i}-${i % 10}`,
    telefono: `809-${(5550000 + i).toString().slice(0, 3)}-${(5550000 + i).toString().slice(3)}`,
    direccion: `Calle #${i + 1}, Ciudad`,
    correo: `cliente${i + 1}@example.com`,
    tipo: ['Normal', 'Frecuente', 'Crédito'][i % 3],
    fechaRegistro: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString()
}));

const mockPurchaseHistory = Array.from({length: 8}, (_, i) => ({
    id: i + 1,
    fecha: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toLocaleDateString(),
    factura: `FAC-00${i + 1}`,
    productos: Math.floor(Math.random() * 5) + 1,
    monto: (Math.random() * 1000 + 100).toFixed(2)
}));

// Estado de la aplicación
let clients = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentClientId = null;

// Elementos del DOM
const clientFormContainer = document.getElementById('clientFormContainer');
const clientListContainer = document.getElementById('clientListContainer');
const clientTableBody = document.getElementById('clientTableBody');
const clientForm = document.getElementById('clientForm');
const formTitle = document.getElementById('formTitle');
const clientIdInput = document.getElementById('clientId');
const newClientBtn = document.getElementById('newClientBtn');
const toggleFormBtn = document.getElementById('toggleFormBtn');
const closeFormBtn = document.getElementById('closeFormBtn');
const searchInput = document.getElementById('searchInput');
const historyModal = document.getElementById('historyModal');
const historyTableBody = document.getElementById('historyTableBody');
const clientName = document.getElementById('clientName');
const clientInfo = document.getElementById('clientInfo');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageNumbers = document.getElementById('pageNumbers');
const startItem = document.getElementById('startItem');
const endItem = document.getElementById('endItem');
const totalItems = document.getElementById('totalItems');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// Funciones para simular fetch API
async function fetchClients() {
    // Simular retraso de red
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                success: true,
                clients: mockClients,
                total: mockClients.length
            });
        }, 800);
    });
}

async function fetchClient(id) {
    return new Promise(resolve => {
        setTimeout(() => {
            const client = mockClients.find(c => c.id === id);
            resolve(client ? {success: true, client} : {success: false, message: 'Cliente no encontrado'});
        }, 500);
    });
}

async function fetchPurchaseHistory(id) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                success: true,
                history: mockPurchaseHistory,
                client: mockClients.find(c => c.id === id)
            });
        }, 700);
    });
}

async function createClient(clientData) {
    return new Promise(resolve => {
        setTimeout(() => {
            const newId = mockClients.length > 0 ? Math.max(...mockClients.map(c => c.id)) + 1 : 1;
            const newClient = {id: newId, ...clientData, fechaRegistro: new Date().toISOString()};
            mockClients.unshift(newClient);
            resolve({success: true, client: newClient});
        }, 800);
    });
}

async function updateClient(id, clientData) {
    return new Promise(resolve => {
        setTimeout(() => {
            const index = mockClients.findIndex(c => c.id === id);
            if (index !== -1) {
                mockClients[index] = {...mockClients[index], ...clientData};
                resolve({success: true, client: mockClients[index]});
            } else {
                resolve({success: false, message: 'Cliente no encontrado'});
            }
        }, 800);
    });
}

async function deleteClient(id) {
    return new Promise(resolve => {
        setTimeout(() => {
            const index = mockClients.findIndex(c => c.id === id);
            if (index !== -1) {
                mockClients.splice(index, 1);
                resolve({success: true});
            } else {
                resolve({success: false, message: 'Cliente no encontrado'});
            }
        }, 800);
    });
}

// Funciones de la UI
function showToast(message, type = 'info') {
    // Cambiar el icono según el tipo
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toastIcon.className = `${icons[type]} text-xl`;
    
    // Cambiar color según el tipo
    const colors = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-info'
    };
    
    toast.className = toast.className.replace(/bg-\w+/, colors[type]);
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    
    // Ocultar automáticamente después de 4 segundos
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

function validateForm() {
    let isValid = true;
    const nombre = document.getElementById('nombre');
    const cedula = document.getElementById('cedula');
    const telefono = document.getElementById('telefono');
    const direccion = document.getElementById('direccion');
    const correo = document.getElementById('correo');
    const tipo = document.getElementById('tipo');
    
    // Validar nombre
    if (!nombre.value.trim()) {
        document.getElementById('nombreError').classList.remove('hidden');
        nombre.classList.add('border-red-500');
        isValid = false;
    } else {
        document.getElementById('nombreError').classList.add('hidden');
        nombre.classList.remove('border-red-500');
    }
    
    // Validar cédula
    if (!cedula.value.trim()) {
        document.getElementById('cedulaError').classList.remove('hidden');
        cedula.classList.add('border-red-500');
        isValid = false;
    } else {
        document.getElementById('cedulaError').classList.add('hidden');
        cedula.classList.remove('border-red-500');
    }
    
    // Validar teléfono
    if (!telefono.value.trim()) {
        document.getElementById('telefonoError').classList.remove('hidden');
        telefono.classList.add('border-red-500');
        isValid = false;
    } else {
        document.getElementById('telefonoError').classList.add('hidden');
        telefono.classList.remove('border-red-500');
    }
    
    // Validar dirección
    if (!direccion.value.trim()) {
        document.getElementById('direccionError').classList.remove('hidden');
        direccion.classList.add('border-red-500');
        isValid = false;
    } else {
        document.getElementById('direccionError').classList.add('hidden');
        direccion.classList.remove('border-red-500');
    }
    
    // Validar correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo.value.trim() || !emailRegex.test(correo.value)) {
        document.getElementById('correoError').classList.remove('hidden');
        correo.classList.add('border-red-500');
        isValid = false;
    } else {
        document.getElementById('correoError').classList.add('hidden');
        correo.classList.remove('border-red-500');
    }
    
    // Validar tipo
    if (!tipo.value) {
        document.getElementById('tipoError').classList.remove('hidden');
        tipo.classList.add('border-red-500');
        isValid = false;
    } else {
        document.getElementById('tipoError').classList.add('hidden');
        tipo.classList.remove('border-red-500');
    }
    
    return isValid;
}

function resetForm() {
    clientForm.reset();
    clientIdInput.value = '';
    document.querySelectorAll('.border-red-500').forEach(el => el.classList.remove('border-red-500'));
    document.querySelectorAll('[id$="Error"]').forEach(el => el.classList.add('hidden'));
}

function renderClients(clientsToRender) {
    clientTableBody.innerHTML = '';
    
    if (clientsToRender.length === 0) {
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                    <i class="fas fa-exclamation-circle text-warning text-xl mr-2"></i>
                    No se encontraron clientes
                </td>
            </tr>
        `;
        return;
    }
    
    clientsToRender.forEach(client => {
        const row = document.createElement('tr');
        
        // Determinar color según tipo de cliente
        let typeColor = 'text-gray-600';
        if (client.tipo === 'Frecuente') typeColor = 'text-success';
        if (client.tipo === 'Crédito') typeColor = 'text-info';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="font-medium text-gray-900">${client.nombre}</div>
                <div class="text-sm text-gray-500">${client.correo}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-gray-900">${client.cedula}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-gray-900">${client.telefono}</div>
                <div class="text-sm text-gray-500">${client.direccion}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeColor}">
                    ${client.tipo}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-warning hover:text-orange-700 mr-3 action-btn edit-btn" data-id="${client.id}">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="text-danger hover:text-red-700 mr-3 action-btn delete-btn" data-id="${client.id}">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
                <button class="text-info hover:text-cyan-700 action-btn history-btn" data-id="${client.id}">
                    <i class="fas fa-history"></i> Historial
                </button>
            </td>
        `;
        
        clientTableBody.appendChild(row);
    });
    
    // Agregar event listeners a los botones
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editClient(parseInt(btn.dataset.id)));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteClientConfirm(parseInt(btn.dataset.id)));
    });
    
    document.querySelectorAll('.history-btn').forEach(btn => {
        btn.addEventListener('click', () => showPurchaseHistory(parseInt(btn.dataset.id)));
    });
}

function renderPagination(totalClients) {
    const totalPages = Math.ceil(totalClients / itemsPerPage);
    pageNumbers.innerHTML = '';
    
    // Actualizar información de paginación
    startItem.textContent = (currentPage - 1) * itemsPerPage + 1;
    endItem.textContent = Math.min(currentPage * itemsPerPage, totalClients);
    totalItems.textContent = totalClients;
    
    // Habilitar/deshabilitar botones de navegación
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    
    // Generar números de página
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `px-3 py-1 rounded-md ${i === currentPage ? 'bg-primary text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} action-btn`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            loadClients();
        });
        pageNumbers.appendChild(pageBtn);
    }
}

function renderPurchaseHistory(history) {
    historyTableBody.innerHTML = '';
    
    if (history.length === 0) {
        historyTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-4 text-center text-gray-500">
                    <i class="fas fa-exclamation-circle text-warning text-xl mr-2"></i>
                    No hay compras registradas para este cliente
                </td>
            </tr>
        `;
        return;
    }
    
    history.forEach(purchase => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="text-sm text-gray-900">${purchase.fecha}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="text-sm text-gray-900 font-medium">${purchase.factura}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm text-gray-900">${purchase.productos} producto${purchase.productos !== 1 ? 's' : ''}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-right">
                <div class="text-sm font-medium text-gray-900">RD$ ${parseFloat(purchase.monto).toFixed(2)}</div>
            </td>
        `;
        historyTableBody.appendChild(row);
    });
}

// Funciones principales
async function loadClients() {
    try {
        // Mostrar estado de carga
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                    <i class="fas fa-spinner fa-spin text-primary text-xl"></i> Cargando clientes...
                </td>
            </tr>
        `;
        
        // Obtener clientes
        const response = await fetchClients();
        
        if (response.success) {
            clients = response.clients;
            totalItems.textContent = response.total;
            
            // Filtrar y paginar
            const searchTerm = searchInput.value.toLowerCase();
            let filteredClients = clients;
            
            if (searchTerm) {
                filteredClients = clients.filter(client => 
                    client.nombre.toLowerCase().includes(searchTerm) || 
                    client.cedula.toLowerCase().includes(searchTerm)
                );
            }
            
            const startIndex = (currentPage - 1) * itemsPerPage;
            const paginatedClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);
            
            renderClients(paginatedClients);
            renderPagination(filteredClients.length);
        } else {
            showToast('Error al cargar los clientes', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión con el servidor', 'error');
    }
}

function showClientForm(editMode = false, clientId = null) {
    formTitle.textContent = editMode ? 'Editar Cliente' : 'Nuevo Cliente';
    resetForm();
    
    if (editMode && clientId) {
        // Cargar datos del cliente para editar
        fetchClient(clientId).then(response => {
            if (response.success) {
                const client = response.client;
                clientIdInput.value = client.id;
                document.getElementById('nombre').value = client.nombre;
                document.getElementById('cedula').value = client.cedula;
                document.getElementById('telefono').value = client.telefono;
                document.getElementById('direccion').value = client.direccion;
                document.getElementById('correo').value = client.correo;
                document.getElementById('tipo').value = client.tipo;
            } else {
                showToast(response.message, 'error');
            }
        });
    }
    
    clientFormContainer.classList.remove('hidden');
    // En móviles, ocultar la lista
    if (window.innerWidth < 1024) {
        clientListContainer.classList.add('hidden');
    }
}

function hideClientForm() {
    clientFormContainer.classList.add('hidden');
    clientListContainer.classList.remove('hidden');
    resetForm();
}

async function saveClient(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        showToast('Por favor, complete todos los campos obligatorios correctamente', 'warning');
        return;
    }
    
    const clientData = {
        nombre: document.getElementById('nombre').value,
        cedula: document.getElementById('cedula').value,
        telefono: document.getElementById('telefono').value,
        direccion: document.getElementById('direccion').value,
        correo: document.getElementById('correo').value,
        tipo: document.getElementById('tipo').value
    };
    
    const isEditMode = clientIdInput.value !== '';
    
    try {
        let response;
        if (isEditMode) {
            response = await updateClient(parseInt(clientIdInput.value), clientData);
        } else {
            response = await createClient(clientData);
        }
        
        if (response.success) {
            showToast(
                `Cliente ${isEditMode ? 'actualizado' : 'creado'} exitosamente`, 
                'success'
            );
            hideClientForm();
            loadClients();
        } else {
            showToast(response.message || 'Error al guardar el cliente', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión con el servidor', 'error');
    }
}

function editClient(clientId) {
    showClientForm(true, clientId);
}

function deleteClientConfirm(clientId) {
    if (confirm('¿Está seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
        deleteClient(clientId).then(response => {
            if (response.success) {
                showToast('Cliente eliminado exitosamente', 'success');
                loadClients();
            } else {
                showToast(response.message || 'Error al eliminar el cliente', 'error');
            }
        }).catch(error => {
            console.error('Error:', error);
            showToast('Error de conexión con el servidor', 'error');
        });
    }
}

async function showPurchaseHistory(clientId) {
    currentClientId = clientId;
    historyModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    
    try {
        // Mostrar estado de carga
        historyTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-4 text-center text-gray-500">
                    <i class="fas fa-spinner fa-spin text-primary text-xl"></i> Cargando historial...
                </td>
            </tr>
        `;
        
        const response = await fetchPurchaseHistory(clientId);
        
        if (response.success) {
            clientName.textContent = response.client.nombre;
            clientInfo.textContent = `Cédula: ${response.client.cedula} | Tipo: ${response.client.tipo}`;
            renderPurchaseHistory(response.history);
        } else {
            showToast('Error al cargar el historial de compras', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión con el servidor', 'error');
    }
}

function hidePurchaseHistory() {
    historyModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

// Event listeners
newClientBtn.addEventListener('click', () => showClientForm());
toggleFormBtn.addEventListener('click', () => showClientForm());
closeFormBtn.addEventListener('click', hideClientForm);
clientForm.addEventListener('submit', saveClient);
searchInput.addEventListener('input', () => {
    currentPage = 1;
    loadClients();
});
closeHistoryModal.addEventListener('click', hidePurchaseHistory);
closeHistoryModalBtn.addEventListener('click', hidePurchaseHistory);
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        loadClients();
    }
});
nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(clients.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        loadClients();
    }
});
document.getElementById('closeToast').addEventListener('click', () => {
    toast.classList.add('hidden');
});

// Cerrar formulario al hacer clic fuera
document.addEventListener('click', (e) => {
    if (clientFormContainer.contains(e.target) || 
        newClientBtn.contains(e.target) || 
        toggleFormBtn.contains(e.target)) {
        return;
    }
    
    if (!clientFormContainer.classList.contains('hidden') && window.innerWidth >= 1024) {
        hideClientForm();
    }
});

// Cargar clientes al inicio
loadClients();


