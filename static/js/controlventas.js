// Inicializar gráficos
document.addEventListener('DOMContentLoaded', function() {
    // Variables globales para gráficos
    let productChart, categoryChart;
    
    // Cargar datos de ventas por producto
    function loadProductSalesData() {
        fetch('/api/ventas_por_producto')
            .then(response => response.json())
            .then(data => {
                renderProductChart(data);
            })
            .catch(error => {
                console.error('Error cargando datos:', error);
            });
    }
    
    // Renderizar gráfico de productos
    function renderProductChart(data) {
        const ctx = document.getElementById('productChart').getContext('2d');
        
        if (productChart) {
            productChart.destroy();
        }
        
        // Preparar colores
        const backgroundColors = [];
        const borderColors = [];
        
        for (let i = 0; i < data.labels.length; i++) {
            const hue = (i * 137.5) % 360; // Distribución uniforme
            backgroundColors.push(`hsla(${hue}, 70%, 80%, 0.7)`);
            borderColors.push(`hsla(${hue}, 70%, 50%, 1)`);
        }
        
        productChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Total Ventas ($)',
                    data: data.ventas,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
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
                                return `Ventas: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value;
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }
    
    // Renderizar gráfico de categorías
    function renderCategoryChart() {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        if (categoryChart) {
            categoryChart.destroy();
        }
        
        // Obtener datos del DOM (generados por Flask)
        const labels = [];
        const data = [];
        const colors = ['#3B82F6', '#10B981', '#6366F1', '#F59E0B', '#EC4899'];
        
        document.querySelectorAll('#tab-content-categoria .space-y-4 > div').forEach((el, index) => {
            const category = el.querySelector('span').textContent;
            const sales = parseFloat(el.querySelector('.font-semibold').textContent.replace('$', ''));
            
            labels.push(category);
            data.push(sales);
        });
        
        categoryChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors.map(color => color.replace('0.7', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${context.label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Interacción de botones de período
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(button => {
        button.addEventListener('click', function() {
            periodButtons.forEach(btn => {
                btn.classList.remove('bg-primary', 'text-white');
                btn.classList.add('bg-gray-100', 'text-gray-700');
            });
            this.classList.remove('bg-gray-100', 'text-gray-700');
            this.classList.add('bg-primary', 'text-white');
            
            // Mostrar spinner de carga
            document.getElementById('spinner').classList.remove('hidden');
            
            // Simular carga de datos
            setTimeout(() => {
                document.getElementById('spinner').classList.add('hidden');
            }, 800);
        });
    });
    
    // Interacción de tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Actualizar estado de botones
            tabButtons.forEach(btn => {
                btn.classList.remove('bg-primary', 'text-white');
                btn.classList.add('bg-gray-100', 'text-gray-700');
            });
            this.classList.remove('bg-gray-100', 'text-gray-700');
            this.classList.add('bg-primary', 'text-white');
            
            // Mostrar el contenido correspondiente
            const tabId = this.id.replace('tab-', 'tab-content-');
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.add('hidden');
            });
            document.getElementById(tabId).classList.remove('hidden');
            
            // Renderizar gráfico si es necesario
            if (tabId === 'tab-content-categoria') {
                renderCategoryChart();
            }
            
            // Mostrar spinner de carga
            document.getElementById('spinner').classList.remove('hidden');
            
            // Simular carga de datos
            setTimeout(() => {
                document.getElementById('spinner').classList.add('hidden');
            }, 500);
        });
    });
    
    // Interacción para rango personalizado
    const customRangeBtn = document.getElementById('custom-range-btn');
    const customRangePanel = document.getElementById('custom-range-panel');
    
    customRangeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        customRangePanel.classList.toggle('hidden');
    });
    
    // Cerrar panel al hacer clic fuera de él
    document.addEventListener('click', function(event) {
        if (!customRangeBtn.contains(event.target) && !customRangePanel.contains(event.target)) {
            customRangePanel.classList.add('hidden');
        }
    });
    
    // Botones de exportación
    const exportButtons = document.querySelectorAll('.export-btn');
    exportButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Simular exportación
            const spinner = document.getElementById('spinner');
            spinner.classList.remove('hidden');
            
            setTimeout(() => {
                spinner.classList.add('hidden');
                alert('Exportación completada');
            }, 1200);
        });
    });
    
    // Cargar datos iniciales
    loadProductSalesData();
});