// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const searchMovements = document.getElementById('searchMovements');
const movementsTable = document.querySelector('#movementsTable tbody');

// Demo Data
const demoData = {
    dailyReport: {
        income: 12450,
        expenses: 3210,
        balance: 9240
    },
    movements: [
        { id: "TRX-001", time: "08:15", description: "Venta al contado", type: "Ingreso", amount: 1850, balance: 1850 },
        { id: "TRX-002", time: "09:30", description: "Pago a proveedor", type: "Egreso", amount: 750, balance: 1100 },
        { id: "TRX-003", time: "10:45", description: "Venta con tarjeta", type: "Ingreso", amount: 3200, balance: 4300 },
        { id: "TRX-004", time: "11:20", description: "Servicio técnico", type: "Ingreso", amount: 850, balance: 5150 },
        { id: "TRX-005", time: "12:10", description: "Compra de materiales", type: "Egreso", amount: 1200, balance: 3950 },
        { id: "TRX-006", time: "14:30", description: "Venta mayorista", type: "Ingreso", amount: 5600, balance: 9550 },
        { id: "TRX-007", time: "15:45", description: "Gastos operativos", type: "Egreso", amount: 450, balance: 9100 },
        { id: "TRX-008", time: "16:20", description: "Venta en línea", type: "Ingreso", amount: 1890, balance: 10990 },
        { id: "TRX-009", time: "17:00", description: "Pago de servicios", type: "Egreso", amount: 810, balance: 10180 },
        { id: "TRX-010", time: "17:45", description: "Venta directa", type: "Ingreso", amount: 2260, balance: 12440 }
    ]
};

// Initialize the application
function initApp() {
    // Set theme preference from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if(themeToggle) themeToggle.checked = true;
    }
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reportDate').value = today;
    
    // Load data
    loadDailyReport();
    loadMovements();
}

// Load daily report data
function loadDailyReport() {
    document.getElementById('incomeValue').textContent = `$${demoData.dailyReport.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('expensesValue').textContent = `$${demoData.dailyReport.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('balanceValue').textContent = `$${demoData.dailyReport.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Load movements table
function loadMovements() {
    if(!movementsTable) return;
    
    movementsTable.innerHTML = '';
    
    demoData.movements.forEach(movement => {
        const row = document.createElement('tr');
        
        const typeClass = movement.type === "Ingreso" ? "movement-income" : "movement-expense";
        
        row.innerHTML = `
            <td class="movement-id">${movement.id}</td>
            <td>${movement.time}</td>
            <td>${movement.description}</td>
            <td>${movement.type}</td>
            <td class="${typeClass}">${movement.type === "Ingreso" ? "+" : "-"}$${movement.amount.toLocaleString()}</td>
            <td>$${movement.balance.toLocaleString()}</td>
        `;
        
        movementsTable.appendChild(row);
    });
}

// Event Listeners
if(themeToggle) {
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
}

if(searchMovements) {
    searchMovements.addEventListener('input', () => {
        const searchTerm = searchMovements.value.toLowerCase();
        const rows = movementsTable.querySelectorAll('tr');
        
        rows.forEach(row => {
            const description = row.cells[2].textContent.toLowerCase();
            const type = row.cells[3].textContent.toLowerCase();
            
            if (description.includes(searchTerm) || type.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

document.getElementById('exportCSV')?.addEventListener('click', () => {
    alert('La exportación a CSV ha sido iniciada');
});

document.getElementById('printReport')?.addEventListener('click', () => {
    window.print();
});

// Initialize the application
document.addEventListener('DOMContentLoaded', initApp);