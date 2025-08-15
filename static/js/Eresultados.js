
// Datos para gráficos
const incomeData = {
    labels: ['Ventas de Productos', 'Ingresos por Servicios'],
    datasets: [{
        data: [245800, 79600],
        backgroundColor: ['#3b82f6', '#10b981'],
        borderWidth: 0
    }]
};

const expensesData = {
    labels: ['Costos de Ventas', 'Gastos Operativos', 'Gastos de Personal'],
    datasets: [{
        data: [98700, 56200, 32300],
        backgroundColor: ['#ef4444', '#f97316', '#eab308'],
        borderWidth: 0
    }]
};

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
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 13
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: RD$ ${value.toLocaleString('es-DO')} (${percentage}%)`;
                        }
                    }
                }
            }
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
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 13
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: RD$ ${value.toLocaleString('es-DO')} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Función para exportar el reporte
document.getElementById('exportBtn').addEventListener('click', function() {
    alert('Reporte exportado exitosamente como PDF');
});

// Cambiar período
document.getElementById('periodSelect').addEventListener('change', function() {
    const period = this.value;
    let periodName = '';
    
    switch(period) {
        case 'current':
            periodName = 'Agosto 2023';
            break;
        case 'prev1':
            periodName = 'Julio 2023';
            break;
        case 'prev2':
            periodName = 'Junio 2023';
            break;
    }
    
    alert(`Período cambiado a: ${periodName}`);
});

// Inicializar gráficos cuando el documento esté listo
document.addEventListener('DOMContentLoaded', initCharts);

