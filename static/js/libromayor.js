
// Datos para el libro mayor
const ledgerData = {
    cash: [
        { date: '2023-08-01', entry: '#AS-001', description: 'Saldo inicial', debit: 0, credit: 0, balance: 50000 },
        { date: '2023-08-05', entry: '#AS-025', description: 'Venta contado', debit: 25000, credit: 0, balance: 75000 },
        { date: '2023-08-10', entry: '#AS-037', description: 'Compra materiales', debit: 0, credit: 15000, balance: 60000 },
        { date: '2023-08-15', entry: '#AS-042', description: 'Venta contado', debit: 42300, credit: 0, balance: 102300 },
        { date: '2023-08-20', entry: '#AS-056', description: 'Pago alquiler', debit: 0, credit: 7100, balance: 95200 }
    ],
    bank: [
        { date: '2023-08-01', entry: '#AS-001', description: 'Saldo inicial', debit: 0, credit: 0, balance: 150000 },
        { date: '2023-08-05', entry: '#AS-025', description: 'Depósito ventas', debit: 50000, credit: 0, balance: 200000 },
        { date: '2023-08-10', entry: '#AS-037', description: 'Pago nómina', debit: 0, credit: 45000, balance: 155000 },
        { date: '2023-08-15', entry: '#AS-042', description: 'Transferencia recibida', debit: 30000, credit: 0, balance: 185000 },
        { date: '2023-08-20', entry: '#AS-056', description: 'Pago factura', debit: 0, credit: 25000, balance: 160000 }
    ],
    receivables: [
        { date: '2023-08-01', entry: '#AS-001', description: 'Saldo inicial', debit: 0, credit: 0, balance: 125400 },
        { date: '2023-08-05', entry: '#AS-025', description: 'Venta a Cliente A', debit: 25000, credit: 0, balance: 150400 },
        { date: '2023-08-10', entry: '#AS-037', description: 'Pago Cliente B', debit: 0, credit: 15000, balance: 135400 },
        { date: '2023-08-15', entry: '#AS-042', description: 'Venta a Cliente C', debit: 42300, credit: 0, balance: 177700 },
        { date: '2023-08-20', entry: '#AS-056', description: 'Pago Cliente A', debit: 0, credit: 7100, balance: 170600 },
        { date: '2023-08-25', entry: '#AS-062', description: 'Venta a Cliente D', debit: 18750, credit: 0, balance: 189350 },
        { date: '2023-08-28', entry: '#AS-071', description: 'Pago Cliente C', debit: 0, credit: 10500, balance: 178850 }
    ],
    inventory: [
        { date: '2023-08-01', entry: '#AS-001', description: 'Saldo inicial', debit: 0, credit: 0, balance: 80000 },
        { date: '2023-08-05', entry: '#AS-025', description: 'Compra materiales', debit: 30000, credit: 0, balance: 110000 },
        { date: '2023-08-10', entry: '#AS-037', description: 'Salida producción', debit: 0, credit: 45000, balance: 65000 },
        { date: '2023-08-15', entry: '#AS-042', description: 'Compra materiales', debit: 25000, credit: 0, balance: 90000 },
        { date: '2023-08-20', entry: '#AS-056', description: 'Salida producción', debit: 0, credit: 20000, balance: 70000 }
    ],
    'fixed-assets': [
        { date: '2023-08-01', entry: '#AS-001', description: 'Saldo inicial', debit: 0, credit: 0, balance: 300000 },
        { date: '2023-08-10', entry: '#AS-037', description: 'Compra equipo', debit: 50000, credit: 0, balance: 350000 },
        { date: '2023-08-20', entry: '#AS-056', description: 'Depreciación', debit: 0, credit: 10000, balance: 340000 }
    ],
    payables: [
        { date: '2023-08-01', entry: '#AS-001', description: 'Saldo inicial', debit: 0, credit: 0, balance: 75000 },
        { date: '2023-08-05', entry: '#AS-025', description: 'Compra a crédito', debit: 0, credit: 25000, balance: 100000 },
        { date: '2023-08-10', entry: '#AS-037', description: 'Pago a proveedor', debit: 15000, credit: 0, balance: 85000 },
        { date: '2023-08-15', entry: '#AS-042', description: 'Compra a crédito', debit: 0, credit: 30000, balance: 115000 },
        { date: '2023-08-20', entry: '#AS-056', description: 'Pago a proveedor', debit: 20000, credit: 0, balance: 95000 }
    ],
    loans: [
        { date: '2023-08-01', entry: '#AS-001', description: 'Saldo inicial', debit: 0, credit: 0, balance: 200000 },
        { date: '2023-08-10', entry: '#AS-037', description: 'Pago préstamo', debit: 20000, credit: 0, balance: 180000 },
        { date: '2023-08-20', entry: '#AS-056', description: 'Pago préstamo', debit: 20000, credit: 0, balance: 160000 }
    ],
    capital: [
        { date: '2023-08-01', entry: '#AS-001', description: 'Saldo inicial', debit: 0, credit: 0, balance: 500000 },
        { date: '2023-08-15', entry: '#AS-042', description: 'Aporte socio', debit: 0, credit: 50000, balance: 550000 }
    ]
};

// Nombres de cuentas
const accountNames = {
    cash: 'Caja',
    bank: 'Bancos',
    receivables: 'Cuentas por Cobrar',
    inventory: 'Inventario',
    'fixed-assets': 'Activos Fijos',
    payables: 'Cuentas por Pagar',
    loans: 'Préstamos',
    capital: 'Capital'
};

// Formatear moneda
function formatCurrency(value) {
    return `RD$ ${value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
}

// Actualizar tabla con movimientos
function updateMovementsTable(accountId) {
    const movements = ledgerData[accountId] || [];
    const tbody = document.querySelector('.movements-table tbody');
    tbody.innerHTML = '';
    
    movements.forEach(mov => {
        const row = document.createElement('tr');
        
        // Formatear fecha a dd/mm/aaaa
        const dateParts = mov.date.split('-');
        const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        
        // Determinar clases para débito y crédito
        const debitClass = mov.debit > 0 ? 'positive' : '';
        const creditClass = mov.credit > 0 ? 'negative' : '';
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td class="text-bold">${mov.entry}</td>
            <td>${mov.description}</td>
            <td class="text-right text-bold ${debitClass}">${mov.debit > 0 ? formatCurrency(mov.debit) : ''}</td>
            <td class="text-right text-bold ${creditClass}">${mov.credit > 0 ? formatCurrency(mov.credit) : ''}</td>
            <td class="text-right text-bold">${formatCurrency(mov.balance)}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Actualizar resumen de la cuenta
function updateAccountSummary(accountId) {
    const movements = ledgerData[accountId] || [];
    let previousBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let currentBalance = 0;
    
    if (movements.length > 0) {
        previousBalance = movements[0].balance - movements[0].debit + movements[0].credit;
        currentBalance = movements[movements.length - 1].balance;
        
        movements.forEach(mov => {
            totalDebit += mov.debit;
            totalCredit += mov.credit;
        });
    }
    
    document.querySelector('.account-name').textContent = accountNames[accountId];
    
    document.querySelector('.summary-card:nth-child(1) .summary-value').textContent = formatCurrency(previousBalance);
    document.querySelector('.summary-card:nth-child(2) .summary-value').textContent = formatCurrency(totalDebit);
    document.querySelector('.summary-card:nth-child(3) .summary-value').textContent = formatCurrency(totalCredit);
    document.querySelector('.summary-card:nth-child(4) .summary-value').textContent = formatCurrency(currentBalance);
}

// Cambiar cuenta
function changeAccount() {
    const accountSelect = document.getElementById('accountSelect');
    const accountId = accountSelect.value;
    
    updateAccountSummary(accountId);
    updateMovementsTable(accountId);
}

// Filtrar por fecha
function filterByDate() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Aquí se implementaría la lógica para filtrar por fecha
    alert(`Filtrando desde ${startDate} hasta ${endDate}`);
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    // Configurar eventos
    document.getElementById('accountSelect').addEventListener('change', changeAccount);
    document.getElementById('filterBtn').addEventListener('click', filterByDate);
    document.getElementById('addMovementBtn').addEventListener('click', function() {
        alert('Agregar nuevo movimiento contable');
    });
    
    // Inicializar con datos de cuentas por cobrar
    updateAccountSummary('receivables');
    updateMovementsTable('receivables');
});
