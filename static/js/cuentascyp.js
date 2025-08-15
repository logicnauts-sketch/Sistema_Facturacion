document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const accountsTable = document.getElementById('accountsTable');
    const tableBody = accountsTable.querySelector('tbody');
    const filterBtn = document.getElementById('filterBtn');
    const statusFilter = document.getElementById('statusFilter');
    const typeFilter = document.getElementById('typeFilter');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const detailModal = document.getElementById('detailModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const closeModal = document.getElementById('closeModal');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationContainer = document.getElementById('paginationContainer');
    
    // Nuevas referencias para el modal de pago
    const paymentModal = document.getElementById('paymentModal');
    const paymentModalTitle = document.getElementById('paymentModalTitle');
    const paymentAccountName = document.getElementById('paymentAccountName');
    const paymentAccountDocument = document.getElementById('paymentAccountDocument');
    const paymentBalance = document.getElementById('paymentBalance');
    const paymentAmount = document.getElementById('paymentAmount');
    const paymentDate = document.getElementById('paymentDate');
    const paymentMethod = document.getElementById('paymentMethod');
    const paymentReference = document.getElementById('paymentReference');
    const paymentNotes = document.getElementById('paymentNotes');
    const paymentForm = document.getElementById('paymentForm');
    const cancelPayment = document.getElementById('cancelPayment');
    const submitPayment = document.getElementById('submitPayment');
    
    // Variables de estado
    let accountsData = [];
    let currentSort = { column: 'dueDate', direction: 'asc' };
    let currentPage = 1;
    const itemsPerPage = 5;
    let currentAccount = null; // Para almacenar la cuenta actual en pago

    // Inicializar la tabla
    async function initTable() {
        showLoading(true);
        await fetchAccounts();
        renderTable();
        setupEventListeners();
        showLoading(false);
    }

    // Mostrar/ocultar indicador de carga
    function showLoading(show) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }

    // Obtener datos del servidor
    async function fetchAccounts() {
        try {
            const response = await fetch(API_URL);
            accountsData = await response.json();
        } catch (error) {
            console.error('Error fetching accounts:', error);
            accountsData = [];
        }
    }

    // Renderizar la tabla con datos
    function renderTable() {
        tableBody.innerHTML = '';
        
        const filteredData = filterAccounts();
        const sortedData = sortAccounts(filteredData);
        const paginatedData = paginateData(sortedData);
        
        paginatedData.forEach(account => {
            tableBody.appendChild(createTableRow(account));
        });
        
        updatePagination(filteredData.length);
        updateSummaryCards(filteredData);
    }

    // Crear fila de tabla
    function createTableRow(account) {
        const row = document.createElement('tr');
        row.className = 'account-row hover:bg-gray-50';
        row.dataset.id = account.id;
        
        // Calcular estado real basado en fechas
        const today = new Date();
        const dueDate = new Date(account.dueDate);
        const isOverdue = dueDate < today && account.status !== 'paid';
        const actualStatus = isOverdue ? 'overdue' : account.status;
        
        const statusClass = {
            pending: 'bg-yellow-100 text-yellow-800',
            paid: 'bg-green-100 text-green-800',
            overdue: 'bg-red-100 text-red-800'
        }[actualStatus] || '';
        
        const statusText = {
            pending: 'Pendiente',
            paid: 'Pagado',
            overdue: 'Vencido'
        }[actualStatus] || actualStatus;
        
        const amountFormatted = formatCurrency(account.amount);
        const issueDateFormatted = formatDate(account.issueDate);
        const dueDateFormatted = formatDate(account.dueDate);
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="${account.type === 'receivable' ? 'bg-blue-600' : 'bg-red-600'} text-white w-8 h-8 rounded-full flex items-center justify-center">
                        <span class="text-xs">${account.name.substring(0, 2)}</span>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${account.name}</div>
                        <div class="text-sm text-gray-500">${account.document}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${amountFormatted}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${issueDateFormatted}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${dueDateFormatted}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                    ${statusText}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-blue-600 hover:text-blue-900 mr-3 tooltip view-details" data-tooltip="Ver detalles" data-id="${account.id}">
                    <i class="fas fa-eye"></i>
                </button>
                ${actualStatus !== 'paid' ? `
                <button class="text-green-600 hover:text-green-900 mr-3 tooltip register-payment" data-tooltip="${account.type === 'receivable' ? 'Registrar pago' : 'Realizar pago'}" data-id="${account.id}">
                    <i class="fas fa-money-bill-wave"></i>
                </button>
                <button class="text-purple-600 hover:text-purple-900 tooltip send-reminder" data-tooltip="Enviar recordatorio" data-id="${account.id}">
                    <i class="fas fa-bell"></i>
                </button>
                ` : `
                <button class="text-green-600 hover:text-green-900 mr-3 tooltip view-history" data-tooltip="Ver historial" data-id="${account.id}">
                    <i class="fas fa-history"></i>
                </button>
                `}
            </td>
        `;
        
        return row;
    }

    // Filtrar cuentas según los criterios seleccionados
    function filterAccounts() {
        const today = new Date();
        
        return accountsData.filter(account => {
            // Calcular estado real basado en fecha actual
            const dueDate = new Date(account.dueDate);
            const isOverdue = dueDate < today && account.status !== 'paid';
            const actualStatus = isOverdue ? 'overdue' : account.status;
            
            // Aplicar filtro de estado
            let statusMatch = true;
            if (statusFilter.value !== 'all') {
                if (statusFilter.value === 'overdue') {
                    statusMatch = isOverdue;
                } else {
                    statusMatch = account.status === statusFilter.value && !isOverdue;
                }
            }
            
            // Aplicar filtro de tipo
            const typeMatch = typeFilter.value === 'all' || account.type === typeFilter.value;
            
            // Aplicar filtro de fecha
            let dateMatch = true;
            if (startDate.value && endDate.value) {
                const issueDate = new Date(account.issueDate);
                const start = new Date(startDate.value);
                const end = new Date(endDate.value);
                end.setDate(end.getDate() + 1); // Incluir el día final
                
                dateMatch = issueDate >= start && issueDate < end;
            }
            
            return statusMatch && typeMatch && dateMatch;
        });
    }

    // Ordenar cuentas
    function sortAccounts(data) {
        return [...data].sort((a, b) => {
            let valueA, valueB;
            
            switch(currentSort.column) {
                case 'name':
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
                    break;
                case 'amount':
                    valueA = a.amount;
                    valueB = b.amount;
                    break;
                case 'issueDate':
                    valueA = new Date(a.issueDate);
                    valueB = new Date(b.issueDate);
                    break;
                case 'dueDate':
                    valueA = new Date(a.dueDate);
                    valueB = new Date(b.dueDate);
                    break;
                default:
                    return 0;
            }
            
            return currentSort.direction === 'asc' 
                ? valueA < valueB ? -1 : valueA > valueB ? 1 : 0
                : valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
        });
    }

    // Paginar datos
    function paginateData(data) {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return data.slice(startIndex, startIndex + itemsPerPage);
    }

    // Actualizar paginación
    function updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        
        paginationInfo.innerHTML = `
            Mostrando <span class="font-medium">${startItem}</span> a 
            <span class="font-medium">${endItem}</span> de 
            <span class="font-medium">${totalItems}</span> resultados
        `;
        
        // Limpiar paginación existente
        paginationContainer.innerHTML = '';
        
        // Crear botón Anterior
        const prevButton = document.createElement('a');
        prevButton.href = '#';
        prevButton.className = `relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;
        prevButton.innerHTML = '<span class="sr-only">Anterior</span><i class="fas fa-chevron-left"></i>';
        prevButton.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        };
        paginationContainer.appendChild(prevButton);
        
        // Crear botones de página
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('a');
            pageButton.href = '#';
            pageButton.className = `relative inline-flex items-center px-4 py-2 border text-sm font-medium ${i === currentPage ? 'bg-blue-50 text-blue-600 border-blue-500' : 'bg-white text-gray-500 hover:bg-gray-50'}`;
            pageButton.textContent = i;
            pageButton.onclick = () => {
                currentPage = i;
                renderTable();
            };
            paginationContainer.appendChild(pageButton);
        }
        
        // Crear botón Siguiente
        const nextButton = document.createElement('a');
        nextButton.href = '#';
        nextButton.className = `relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;
        nextButton.innerHTML = '<span class="sr-only">Siguiente</span><i class="fas fa-chevron-right"></i>';
        nextButton.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        };
        paginationContainer.appendChild(nextButton);
    }

    // Actualizar tarjetas de resumen con datos reales
    function updateSummaryCards(data) {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        const next15Days = new Date(today);
        next15Days.setDate(today.getDate() + 15);
        
        const summary = {
            totalReceivable: 0,
            pendingReceivable: 0,
            overdueReceivable: 0,
            totalPayable: 0,
            pendingPayable: 0,
            overduePayable: 0,
            nextDueAmount: 0,
            thisWeekDue: 0,
            next15DaysDue: 0
        };
        
        data.forEach(account => {
            const dueDate = new Date(account.dueDate);
            const isOverdue = dueDate < today && account.status !== 'paid';
            const isPending = account.status !== 'paid';
            
            if (account.type === 'receivable') {
                summary.totalReceivable += account.amount;
                
                if (isOverdue) {
                    summary.overdueReceivable += account.amount;
                } else if (isPending) {
                    summary.pendingReceivable += account.amount;
                }
            } else {
                summary.totalPayable += account.amount;
                
                if (isOverdue) {
                    summary.overduePayable += account.amount;
                } else if (isPending) {
                    summary.pendingPayable += account.amount;
                }
            }
            
            // Calcular próximos vencimientos para cuentas pendientes
            if (isPending && !isOverdue) {
                if (dueDate <= nextWeek) {
                    summary.thisWeekDue += account.amount;
                    summary.nextDueAmount += account.amount;
                } else if (dueDate <= next15Days) {
                    summary.next15DaysDue += account.amount;
                    summary.nextDueAmount += account.amount;
                }
            }
        });
        
        // Actualizar DOM - CORREGIDO: se eliminó el RD$ duplicado
        document.getElementById('totalReceivable').textContent = formatCurrency(summary.totalReceivable);
        document.getElementById('pendingReceivable').textContent = formatCurrency(summary.pendingReceivable);
        document.getElementById('overdueReceivable').textContent = formatCurrency(summary.overdueReceivable);
        
        document.getElementById('totalPayable').textContent = formatCurrency(summary.totalPayable);
        document.getElementById('pendingPayable').textContent = formatCurrency(summary.pendingPayable);
        document.getElementById('overduePayable').textContent = formatCurrency(summary.overduePayable);
        
        document.getElementById('nextDueAmount').textContent = formatCurrency(summary.nextDueAmount);
        document.getElementById('thisWeekDue').textContent = formatCurrency(summary.thisWeekDue);
        document.getElementById('next15DaysDue').textContent = formatCurrency(summary.next15DaysDue);
    }

    // Mostrar detalles de la cuenta (con mejor estilo y centrado)
    function showAccountDetails(accountId) {
        const account = accountsData.find(a => a.id === accountId);
        if (!account) return;
        
        const typeText = account.type === 'receivable' ? 'Por Cobrar' : 'Por Pagar';
        
        // Calcular estado real
        const today = new Date();
        const dueDate = new Date(account.dueDate);
        const isOverdue = dueDate < today && account.status !== 'paid';
        const actualStatus = isOverdue ? 'overdue' : account.status;
        
        const statusText = {
            pending: 'Pendiente',
            paid: 'Pagado',
            overdue: 'Vencido'
        }[actualStatus] || actualStatus;
        
        modalTitle.textContent = `Detalles: ${account.document}`;
        
        modalContent.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold mb-3 text-blue-600">Información Básica</h4>
                    <div class="space-y-2">
                        <p><span class="font-medium">Tipo:</span> ${typeText}</p>
                        <p><span class="font-medium">Estado:</span> <span class="px-2 py-1 rounded-full ${actualStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' : actualStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${statusText}</span></p>
                        <p><span class="font-medium">Monto:</span> ${formatCurrency(account.amount)}</p>
                        <p><span class="font-medium">Fecha Emisión:</span> ${formatDate(account.issueDate)}</p>
                        <p><span class="font-medium">Fecha Vencimiento:</span> ${formatDate(account.dueDate)}</p>
                    </div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold mb-3 text-blue-600">${account.type === 'receivable' ? 'Cliente' : 'Proveedor'}</h4>
                    <div class="space-y-2">
                        <p><span class="font-medium">Nombre:</span> ${account.name}</p>
                        <p><span class="font-medium">Documento:</span> ${account.document}</p>
                        <p><span class="font-medium">Contacto:</span> ${account.contact}</p>
                        <p><span class="font-medium">Email:</span> ${account.email}</p>
                        <p><span class="font-medium">Teléfono:</span> ${account.phone}</p>
                    </div>
                </div>
            </div>
            <div class="mt-4 bg-gray-50 p-4 rounded-lg">
                <h4 class="font-semibold mb-3 text-blue-600">Historial de Transacciones</h4>
                <div class="p-3">
                    <p class="text-gray-600">${account.status === 'paid' ? 
                        '<i class="fas fa-check-circle text-green-500 mr-2"></i> Pago completo realizado' : 
                        '<i class="fas fa-info-circle text-yellow-500 mr-2"></i> Sin transacciones registradas'}</p>
                </div>
            </div>
        `;
        
        detailModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Evitar scroll en el fondo
    }

    // Abrir modal para realizar pago
    function openPaymentModal(accountId) {
        const account = accountsData.find(a => a.id === accountId);
        if (!account) return;
        
        currentAccount = account;
        
        paymentModalTitle.textContent = `${account.type === 'receivable' ? 'Registrar Pago' : 'Realizar Pago'}`;
        paymentAccountName.textContent = account.name;
        paymentAccountDocument.textContent = account.document;
        paymentBalance.textContent = formatCurrency(account.amount);
        paymentAmount.value = account.amount;
        paymentAmount.max = account.amount;
        paymentDate.valueAsDate = new Date();
        paymentMethod.value = 'transfer';
        paymentReference.value = '';
        paymentNotes.value = '';
        
        paymentModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // Registrar un pago desde el modal
    function processPayment() {
        if (!currentAccount) return;
        
        const amount = parseFloat(paymentAmount.value);
        
        if (isNaN(amount) || amount <= 0) {
            alert('Por favor ingrese un monto válido mayor que cero.');
            return;
        }
        
        if (amount > currentAccount.amount) {
            alert('El monto ingresado excede el saldo pendiente.');
            return;
        }
        
        // Simular registro de pago
        currentAccount.amount -= amount;
        if (currentAccount.amount <= 0) {
            currentAccount.status = 'paid';
        }
        
        // Obtener detalles del pago
        const paymentDetails = {
            date: paymentDate.value,
            amount: amount,
            method: paymentMethod.value,
            reference: paymentReference.value,
            notes: paymentNotes.value
        };
        
        // Aquí normalmente se enviaría la información al servidor
        console.log('Pago registrado:', paymentDetails);
        
        // Mostrar confirmación
        alert(`Pago de ${formatCurrency(amount)} registrado exitosamente.`);
        
        // Cerrar modal
        paymentModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        
        // Actualizar tabla
        renderTable();
    }

    // Enviar recordatorio
    function sendReminder(accountId) {
        const account = accountsData.find(a => a.id === accountId);
        if (!account) return;
        
        alert(`Recordatorio enviado a ${account.contact} (${account.email})`);
    }

    // Configurar event listeners
    function setupEventListeners() {
        // Filtros
        filterBtn.addEventListener('click', renderTable);
        
        // Ordenamiento
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                
                if (currentSort.column === column) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.column = column;
                    currentSort.direction = 'asc';
                }
                
                // Actualizar indicadores visuales
                sortableHeaders.forEach(h => {
                    const icon = h.querySelector('i');
                    if (h === header) {
                        icon.className = currentSort.direction === 'asc' 
                            ? 'fas fa-sort-up ml-1' 
                            : 'fas fa-sort-down ml-1';
                    } else {
                        icon.className = 'fas fa-sort ml-1 text-gray-400';
                    }
                });
                
                renderTable();
            });
        });
        
        // Botones de acción en la tabla
        tableBody.addEventListener('click', (e) => {
            const viewDetailsBtn = e.target.closest('.view-details');
            const registerPaymentBtn = e.target.closest('.register-payment');
            const sendReminderBtn = e.target.closest('.send-reminder');
            const viewHistoryBtn = e.target.closest('.view-history');
            
            if (viewDetailsBtn || viewHistoryBtn) {
                const accountId = parseInt((viewDetailsBtn || viewHistoryBtn).dataset.id);
                showAccountDetails(accountId);
            }
            else if (registerPaymentBtn) {
                const accountId = parseInt(registerPaymentBtn.dataset.id);
                openPaymentModal(accountId);
            }
            else if (sendReminderBtn) {
                const accountId = parseInt(sendReminderBtn.dataset.id);
                sendReminder(accountId);
            }
        });
        
        // Cerrar modales
        closeModal.addEventListener('click', () => {
            detailModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        });
        
        cancelPayment.addEventListener('click', () => {
            paymentModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        });
        
        // Cerrar modales al hacer clic fuera del contenido
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
        });
        
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) {
                paymentModal.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
        });
        
        // Registrar pago al enviar formulario
        paymentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            processPayment();
        });
        
        // También permitir el botón de enviar
        submitPayment.addEventListener('click', processPayment);
        
        // Establecer fechas por defecto para filtros
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        startDate.valueAsDate = firstDay;
        endDate.valueAsDate = lastDay;
        
        // Aplicar estilo a los inputs de fecha
        applyDateInputStyles();
    }

    // Aplicar estilo a los inputs de fecha
    function applyDateInputStyles() {
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            // Crear un div contenedor para el estilo
            const wrapper = document.createElement('div');
            wrapper.className = 'relative';
            
            // Mover el input al wrapper
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
            
            // Agregar ícono de calendario
            const icon = document.createElement('i');
            icon.className = 'fas fa-calendar absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none';
            wrapper.appendChild(icon);
            
            // Aplicar clases de estilo
            input.className = 'date-input w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
        });
    }

    // Funciones de utilidad
    function formatCurrency(amount) {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP',
            minimumFractionDigits: 2
        }).format(amount);
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-DO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Inicializar
    initTable();
});