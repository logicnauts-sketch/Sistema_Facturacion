// Datos para gráficos
const incomeData = {
    labels: ['Ventas de Productos', 'Servicios', 'Otros Ingresos'],
    datasets: [{
        data: [76, 20, 4],
        backgroundColor: [
            '#10b981',
            '#3b82f6',
            '#8b5cf6'
        ],
        borderWidth: 0
    }]
};

const expensesData = {
    labels: ['Inventario', 'Servicios', 'Nómina', 'Mantenimiento', 'Impuestos'],
    datasets: [{
        data: [35, 23, 21, 13, 8],
        backgroundColor: [
            '#ef4444',
            '#f97316',
            '#eab308',
            '#8b5cf6',
            '#10b981'
        ],
        borderWidth: 0
    }]
};

// Categorías para cada tipo de transacción
const categories = {
    Ingreso: ['Ventas', 'Servicios', 'Inversiones', 'Préstamos', 'Otros Ingresos'],
    Egreso: ['Servicios', 'Nómina', 'Mantenimiento', 'Inventario', 'Impuestos', 'Marketing', 'Gastos Generales']
};

// Referencias a elementos del modal
const modalOverlay = document.getElementById('modalOverlay');
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const saveTransactionBtn = document.getElementById('saveTransactionBtn');
const transactionType = document.getElementById('transactionType');
const transactionCategory = document.getElementById('transactionCategory');
const transactionForm = document.getElementById('transactionForm');
const transactionsTable = document.getElementById('transactionsTable');

// Función para abrir el modal
function openModal() {
    modalOverlay.classList.add('active');
    // Establecer fecha actual como valor predeterminado
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transactionDate').value = today;
}

// Función para cerrar el modal
function closeModal() {
    modalOverlay.classList.remove('active');
    // Resetear el formulario
    transactionForm.reset();
}

// Event listeners para abrir/cerrar el modal
openModalBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);

// Actualizar categorías según el tipo seleccionado
transactionType.addEventListener('change', function() {
    const type = this.value;
    transactionCategory.innerHTML = '<option value="">Seleccionar categoría</option>';
    
    if (type && categories[type]) {
        categories[type].forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            transactionCategory.appendChild(option);
        });
    }
});

// Guardar nueva transacción
saveTransactionBtn.addEventListener('click', function() {
    if (!transactionForm.checkValidity()) {
        alert('Por favor, complete todos los campos requeridos.');
        return;
    }
    
    const date = document.getElementById('transactionDate').value;
    const type = transactionType.value;
    const category = transactionCategory.value;
    const concept = document.getElementById('transactionConcept').value;
    const amount = parseFloat(document.getElementById('transactionAmount').value).toFixed(2);
    const responsible = document.getElementById('transactionResponsible').value;
    
    // Formatear la fecha para mostrar
    const formattedDate = new Date(date).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    // Crear nueva fila en la tabla
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${formattedDate}</td>
        <td><span class="transaction-tag ${type === 'Ingreso' ? 'income-tag' : 'expense-tag'}">${type}</span></td>
        <td>${category}</td>
        <td>${concept}</td>
        <td class="amount ${type === 'Ingreso' ? 'income-text' : 'expense-text'}">RD$ ${parseFloat(amount).toLocaleString('es-ES', {minimumFractionDigits: 2})}</td>
        <td>${responsible}</td>
        <td>
            <div class="actions">
                <div class="action-btn edit-btn">
                    <i class="fas fa-edit"></i>
                </div>
                <div class="action-btn delete-btn">
                    <i class="fas fa-trash"></i>
                </div>
            </div>
        </td>
    `;
    
    // Añadir la nueva fila al principio de la tabla
    transactionsTable.insertBefore(newRow, transactionsTable.firstChild);
    
    // Actualizar resumen (simulado)
    if (type === 'Ingreso') {
        const incomeCard = document.querySelector('.card:first-child .card-value');
        const currentIncome = parseFloat(incomeCard.textContent.replace('RD$', '').replace(/,/g, ''));
        incomeCard.textContent = `RD$ ${(currentIncome + parseFloat(amount)).toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
    } else {
        const expenseCard = document.querySelector('.card:nth-child(2) .card-value');
        const currentExpense = parseFloat(expenseCard.textContent.replace('RD$', '').replace(/,/g, ''));
        expenseCard.textContent = `RD$ ${(currentExpense + parseFloat(amount)).toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
        
        // Actualizar utilidad neta
        const netProfitCard = document.querySelector('.card:last-child .card-value');
        const income = parseFloat(document.querySelector('.card:first-child .card-value').textContent.replace('RD$', '').replace(/,/g, ''));
        const expenses = parseFloat(document.querySelector('.card:nth-child(2) .card-value').textContent.replace('RD$', '').replace(/,/g, ''));
        netProfitCard.textContent = `RD$ ${(income - expenses).toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
    }
    
    // Mostrar mensaje de éxito
    alert(`¡Transacción agregada exitosamente!\nConcepto: ${concept}\nMonto: RD$ ${parseFloat(amount).toLocaleString('es-ES', {minimumFractionDigits: 2})}`);
    
    // Cerrar el modal y resetear el formulario
    closeModal();
    
    // Añadir eventos a los nuevos botones de acción
    addActionListeners();
});

// Función para añadir listeners a los botones de acción
function addActionListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const concept = row.children[3].textContent;
            alert(`Editar transacción: ${concept}`);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const concept = row.children[3].textContent;
            const amount = parseFloat(row.children[4].textContent.replace('RD$', '').replace(/,/g, ''));
            const type = row.children[1].querySelector('.transaction-tag').textContent;
            
            if(confirm(`¿Está seguro que desea eliminar la transacción: ${concept}?`)) {
                // Actualizar resumen (simulado)
                if (type === 'Ingreso') {
                    const incomeCard = document.querySelector('.card:first-child .card-value');
                    const currentIncome = parseFloat(incomeCard.textContent.replace('RD$', '').replace(/,/g, ''));
                    incomeCard.textContent = `RD$ ${(currentIncome - amount).toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
                } else {
                    const expenseCard = document.querySelector('.card:nth-child(2) .card-value');
                    const currentExpense = parseFloat(expenseCard.textContent.replace('RD$', '').replace(/,/g, ''));
                    expenseCard.textContent = `RD$ ${(currentExpense - amount).toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
                }
                
                // Actualizar utilidad neta
                const netProfitCard = document.querySelector('.card:last-child .card-value');
                const income = parseFloat(document.querySelector('.card:first-child .card-value').textContent.replace('RD$', '').replace(/,/g, ''));
                const expenses = parseFloat(document.querySelector('.card:nth-child(2) .card-value').textContent.replace('RD$', '').replace(/,/g, ''));
                netProfitCard.textContent = `RD$ ${(income - expenses).toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
                
                row.remove();
            }
        });
    });
}

// Inicializar gráficos al cargar
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    addActionListeners();
});

// Inicializar gráficos
function initCharts() {
    // Gráfico de ingresos
    const incomeCtx = document.getElementById('incomeChart').getContext('2d');
    new Chart(incomeCtx, {
        type: 'doughnut',
        data: incomeData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value}%`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
    
    // Gráfico de gastos
    const expensesCtx = document.getElementById('expensesChart').getContext('2d');
    new Chart(expensesCtx, {
        type: 'doughnut',
        data: expensesData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value}%`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// Ordenamiento de tablas
document.querySelectorAll('th').forEach(th => {
    if(th.querySelector('.fa-sort')) {
        th.addEventListener('click', function() {
            const table = this.closest('table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            const columnIndex = Array.from(this.parentElement.children).indexOf(this);
            const isAscending = this.classList.toggle('asc');
            
            // Remover clases de ordenamiento de todas las columnas
            this.parentElement.querySelectorAll('th').forEach(el => {
                el.classList.remove('asc', 'desc');
            });
            
            // Añadir clase según la dirección
            this.classList.add(isAscending ? 'asc' : 'desc');
            
            // Ordenar filas
            rows.sort((a, b) => {
                const aValue = a.children[columnIndex].textContent.trim();
                const bValue = b.children[columnIndex].textContent.trim();
                
                // Intenta convertir a número si es posible
                const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
                const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAscending ? aNum - bNum : bNum - aNum;
                }
                
                // Orden alfabético
                return isAscending 
                    ? aValue.localeCompare(bValue) 
                    : bValue.localeCompare(aValue);
            });
            
            // Limpiar y reinsertar filas ordenadas
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }
            
            rows.forEach(row => {
                tbody.appendChild(row);
            });
        });
    }
});

// Funcionalidad de pestañas
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
        // Remover clase activa de todas las pestañas
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.remove('active');
        });
        
        // Añadir clase activa a la pestaña clickeada
        this.classList.add('active');
        
        // Filtrar la tabla según el tipo de transacción
        const tabType = this.dataset.tab;
        const rows = document.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            if(tabType === 'all') {
                row.style.display = '';
            } else {
                const type = row.querySelector('.transaction-tag').textContent.toLowerCase();
                if(type.includes(tabType)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    });
});
