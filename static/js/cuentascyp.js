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
            // Usamos window.API_URL que se define en el HTML
            const API_URL = window.API_URL || '/api/cuentas';
            console.log('Fetching from:', API_URL); // Para depuración
            
            const response = await fetch(API_URL);

            if (!response.ok) {
                // intentar leer el body (por si el backend devuelve { error: "mensaje" })
                let text;
                try {
                    text = await response.text();
                    console.error('API error body:', text);
                } catch (err) {
                    console.error('No se pudo leer body de error:', err);
                }
                throw new Error(`Error HTTP: ${response.status} - ${text || ''}`);
            }

            
            const data = await response.json();
            
            // Asegurarnos de que siempre trabajamos con un array
            if (Array.isArray(data)) {
                accountsData = data;
            } else if (data && Array.isArray(data.accounts)) {
                // Si la respuesta es un objeto que contiene un array 'accounts'
                accountsData = data.accounts;
            } else if (data && Array.isArray(data.items)) {
                // Otra posible estructura común
                accountsData = data.items;
            } else {
                // Si no es un array, crear uno vacío y loguear el error
                console.error('La API no devolvió un array:', data);
                accountsData = [];
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            accountsData = []; // Asegurar que siempre es un array
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
        row.className = 'table-row account-row';
        row.dataset.id = account.id;
        
        // Calcular estado real basado en fechas
        const today = new Date();
        const dueDate = new Date(account.dueDate);
        const isOverdue = dueDate < today && account.status !== 'paid';
        const actualStatus = isOverdue ? 'overdue' : account.status;
        
        const statusClass = {
            pending: 'status-badge status-pending',
            paid: 'status-badge status-paid',
            overdue: 'status-badge status-overdue',
            partial: 'status-badge status-partial'
        }[actualStatus] || '';
        
        const statusText = {
            pending: 'Pendiente',
            paid: 'Pagado',
            overdue: 'Vencido',
            partial: 'Parcial'
        }[actualStatus] || actualStatus;
        
        const amountFormatted = formatCurrency(account.amount);
        const issueDateFormatted = formatDate(account.issueDate);
        const dueDateFormatted = formatDate(account.dueDate);
        
        row.innerHTML = `
            <td class="table-cell">
                <div class="account-info">
                    <div class="account-avatar ${account.type === 'receivable' ? 'account-avatar-blue' : 'account-avatar-red'}">
                        ${account.name.substring(0, 2)}
                    </div>
                    <div class="account-details">
                        <div class="account-name">${account.name}</div>
                        <div class="account-document">${account.document}</div>
                    </div>
                </div>
            </td>
            <td class="table-cell">
                ${amountFormatted}
            </td>
            <td class="table-cell">
                ${issueDateFormatted}
            </td>
            <td class="table-cell">
                ${dueDateFormatted}
            </td>
            <td class="table-cell">
                <span class="${statusClass}">
                    ${statusText}
                </span>
            </td>
            <td class="table-cell text-right">
                <button class="action-button view tooltip view-details" data-tooltip="Ver detalles" data-id="${account.id}">
                    <i class="fas fa-eye"></i>
                </button>
                ${actualStatus !== 'paid' ? `
                <button class="action-button payment tooltip register-payment" data-tooltip="${account.type === 'receivable' ? 'Registrar pago' : 'Realizar pago'}" data-id="${account.id}">
                    <i class="fas fa-money-bill-wave"></i>
                </button>
                <button class="action-button reminder tooltip send-reminder" data-tooltip="Enviar recordatorio" data-id="${account.id}">
                    <i class="fas fa-bell"></i>
                </button>
                ` : `
                <button class="action-button view tooltip view-history" data-tooltip="Ver historial" data-id="${account.id}">
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
            Mostrando <span class="pagination-number">${startItem}</span> a 
            <span class="pagination-number">${endItem}</span> de 
            <span class="pagination-number">${totalItems}</span> resultados
        `;
        
        // Limpiar paginación existente
        paginationContainer.innerHTML = '';
        
        // Crear botón Anterior
        const prevButton = document.createElement('a');
        prevButton.href = '#';
        prevButton.className = `pagination-link ${currentPage === 1 ? 'disabled' : ''}`;
        prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevButton.onclick = (e) => {
            e.preventDefault();
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
            pageButton.className = `pagination-link ${i === currentPage ? 'active' : ''}`;
            pageButton.textContent = i;
            pageButton.onclick = (e) => {
                e.preventDefault();
                currentPage = i;
                renderTable();
            };
            paginationContainer.appendChild(pageButton);
        }
        
        // Crear botón Siguiente
        const nextButton = document.createElement('a');
        nextButton.href = '#';
        nextButton.className = `pagination-link ${currentPage === totalPages ? 'disabled' : ''}`;
        nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextButton.onclick = (e) => {
            e.preventDefault();
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
        
        // Actualizar DOM
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

    // Mostrar detalles de la cuenta
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
            overdue: 'Vencido',
            partial: 'Parcial'
        }[actualStatus] || actualStatus;
        
        modalTitle.textContent = `Detalles: ${account.document}`;
        
        modalContent.innerHTML = `
            <div class="payment-details">
                <div class="payment-detail">
                    <h4 class="detail-label">Información Básica</h4>
                    <p><span class="detail-label">Tipo:</span> ${typeText}</p>
                    <p><span class="detail-label">Estado:</span> <span class="status-badge ${actualStatus === 'pending' ? 'status-pending' : actualStatus === 'paid' ? 'status-paid' : 'status-overdue'}">${statusText}</span></p>
                    <p><span class="detail-label">Monto:</span> ${formatCurrency(account.amount)}</p>
                    <p><span class="detail-label">Fecha Emisión:</span> ${formatDate(account.issueDate)}</p>
                    <p><span class="detail-label">Fecha Vencimiento:</span> ${formatDate(account.dueDate)}</p>
                </div>
                <div class="payment-detail">
                    <h4 class="detail-label">${account.type === 'receivable' ? 'Cliente' : 'Proveedor'}</h4>
                    <p><span class="detail-label">Nombre:</span> ${account.name}</p>
                    <p><span class="detail-label">Documento:</span> ${account.document}</p>
                    <p><span class="detail-label">Contacto:</span> ${account.contact}</p>
                    <p><span class="detail-label">Email:</span> ${account.email}</p>
                    <p><span class="detail-label">Teléfono:</span> ${account.phone}</p>
                </div>
            </div>
            <div class="payment-detail">
                <h4 class="detail-label">Historial de Transacciones</h4>
                <p>${account.status === 'paid' ? 
                    '<i class="fas fa-check-circle text-success"></i> Pago completo realizado' : 
                    '<i class="fas fa-info-circle"></i> Sin transacciones registradas'}</p>
            </div>
        `;
        
        detailModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
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
                            ? 'fas fa-sort-up sort-icon' 
                            : 'fas fa-sort-down sort-icon';
                    } else {
                        icon.className = 'fas fa-sort sort-icon';
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