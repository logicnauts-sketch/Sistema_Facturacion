// Variables globales
let categories = {
    Ingreso: [],
    Egreso: []
};

let transactions = [];
let financialSummary = {
    total_income: 0,
    total_expenses: 0,
    net_profit: 0
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

// Función para cargar datos desde el backend
async function loadData() {
    try {
        await loadFinancialSummary();
        await loadChartsData();
        await loadCategories();
        await loadTransactions();
        updateUI();
    } catch (error) {
        console.error('Error cargando datos:', error);
        alert('Error al cargar los datos. Por favor, recarga la página.');
    }
}

// Cargar resumen financiero
async function loadFinancialSummary() {
    const response = await fetch('/api/financial-summary');
    if (response.ok) {
        financialSummary = await response.json();
    } else {
        throw new Error('Error al cargar el resumen financiero');
    }
}

// Cargar datos para gráficos
async function loadChartsData() {
    const response = await fetch('/api/financial-charts');
    if (response.ok) {
        const chartsData = await response.json();
        initCharts(chartsData.income, chartsData.expenses);
    } else {
        throw new Error('Error al cargar datos para gráficos');
    }
}

// Cargar categorías
async function loadCategories() {
    const response = await fetch('/api/categories');
    if (response.ok) {
        categories = await response.json();
    } else {
        throw new Error('Error al cargar categorías');
    }
}

// Cargar transacciones
async function loadTransactions() {
    const response = await fetch('/api/transactions');
    if (response.ok) {
        transactions = await response.json();
    } else {
        throw new Error('Error al cargar transacciones');
    }
}

// Actualizar la interfaz con los datos cargados
function updateUI() {
    updateSummaryCards();
    renderTransactions();
    addActionListeners();
}

// Actualizar tarjetas de resumen
function updateSummaryCards() {
    document.querySelector('.card:first-child .card-value').textContent = 
        `RD$ ${financialSummary.total_income.toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
    
    document.querySelector('.card:nth-child(2) .card-value').textContent = 
        `RD$ ${financialSummary.total_expenses.toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
    
    document.querySelector('.card:last-child .card-value').textContent = 
        `RD$ ${financialSummary.net_profit.toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
}

// Renderizar transacciones en la tabla
function renderTransactions() {
    // Limpiar tabla
    transactionsTable.innerHTML = '';
    
    // Agregar cada transacción
    transactions.forEach(transaction => {
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td>${transaction.date}</td>
            <td><span class="transaction-tag ${transaction.type === 'Ingreso' ? 'income-tag' : 'expense-tag'}">${transaction.type}</span></td>
            <td>${transaction.category}</td>
            <td>${transaction.concept}</td>
            <td class="amount ${transaction.type === 'Ingreso' ? 'income-text' : 'expense-text'}">RD$ ${Math.abs(transaction.amount).toLocaleString('es-ES', {minimumFractionDigits: 2})}</td>
            <td>${transaction.responsible}</td>
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
        transactionsTable.appendChild(newRow);
    });
}

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
saveTransactionBtn.addEventListener('click', async function() {
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
    
    try {
        const response = await fetch('/api/add-transaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: date,
                type: type,
                category: category,
                concept: concept,
                amount: amount,
                responsible: responsible
            })
        });
        
        if (response.ok) {
            // Recargar todos los datos después de agregar la transacción
            await loadData();
            // Mostrar mensaje de éxito
            alert(`¡Transacción agregada exitosamente!\nConcepto: ${concept}\nMonto: RD$ ${parseFloat(amount).toLocaleString('es-ES', {minimumFractionDigits: 2})}`);
            // Cerrar el modal
            closeModal();
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        console.error('Error agregando transacción:', error);
        alert('Error al agregar la transacción. Por favor, intente nuevamente.');
    }
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
                // En una implementación real, aquí haríamos una llamada al backend para eliminar
                alert('Funcionalidad de eliminación no implementada en este ejemplo');
            }
        });
    });
}

// Inicializar gráficos con datos reales
function initCharts(incomeData, expensesData) {
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

// Inicializar la aplicación al cargar
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});