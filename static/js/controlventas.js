// Variables globales
let allProducts = [];
let currentProducts = [];
let currentPage = 1;
const itemsPerPage = 5;
let salesChart = null;
let currentPeriod = 'hoy'; // Período actual
let notyf = new Notyf({
  duration: 3000,
  position: {
    x: 'right',
    y: 'top'
  },
  types: [
    {
      type: 'info',
      background: '#4e73df',
      icon: {
        className: 'fas fa-info-circle',
        tagName: 'i',
        color: '#fff'
      }
    }
  ]
});

// Colores para avatares de productos
const avatarColors = {
    "Tecnología": "#4e73df",
    "Muebles": "#1cc88a",
    "Electrónicos": "#6f42c1",
    "Móviles": "#f6c23e",
    "Tablets": "#e74a3b",
    "Monitores": "#36b9cc",
    "Accesorios": "#4e73df"
};

// Inicializar dashboard
async function initDashboard(period = 'hoy', startDate = null, endDate = null) {
    let dashboardResponse;  // Declarar fuera del try para acceso en catch
    
    try {

        // Construir URL con parámetros
        let url = '/controlventas/dashboard';
        const params = new URLSearchParams();
        
        if (period) {
            params.append('period', period);
        }
        if (startDate && endDate) {
            params.append('start_date', startDate);
            params.append('end_date', endDate);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        // Obtener datos del dashboard
        dashboardResponse = await fetch(url);
        const dashboardData = await dashboardResponse.json();
        
        // Asegurar que los valores numéricos son números
        const ventasTotales = Number(dashboardData.ventas_totales) || 0;
        const promedioVenta = Number(dashboardData.promedio_venta) || 0;
        const productosVendidos = Number(dashboardData.productos_vendidos) || 0;

        // Actualizar métricas con manejo de errores
        document.getElementById('totalSales').textContent = `$${ventasTotales.toFixed(2)}`;
        document.getElementById('avgSale').textContent = `$${promedioVenta.toFixed(2)}`;
        document.getElementById('productsSold').textContent = productosVendidos.toLocaleString();
        
        // Actualizar tendencias con valores predeterminados
        const trendSales = dashboardData.trend_sales ?? 0;
        const trendAvg = dashboardData.trend_avg ?? 0;
        const trendQuantity = dashboardData.trend_quantity ?? 0;
        
        const trends = document.querySelectorAll('.metric-trend');
        trends[0].innerHTML = `<i class="fas fa-arrow-up"></i> ${trendSales}% desde el período anterior`;
        trends[1].innerHTML = `<i class="fas fa-arrow-up"></i> ${trendAvg}% desde el período anterior`;
        trends[2].innerHTML = `<i class="fas fa-arrow-up"></i> ${trendQuantity}% desde el período anterior`;
        
        // Cargar productos con validación
        allProducts = Array.isArray(dashboardData.top_productos) 
            ? [...dashboardData.top_productos] 
            : [];
            
        currentProducts = [...allProducts];
        
        // Renderizar tabla
        renderProductsTable();
        
        // Cargar gráfico
        await loadChartData(period, startDate, endDate);
        
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        notyf.error('Error al cargar datos del dashboard');
        
        // Intentar parsear como texto si falla JSON
        if (dashboardResponse) {
            const text = await dashboardResponse.text();
            console.error('Respuesta del servidor:', text);
        } else {
            console.error('No se pudo obtener respuesta del servidor');
        }
    }
}

// Renderizar tabla de productos
function renderProductsTable() {
    const tableBody = document.getElementById('productsTableBody');
    tableBody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, currentProducts.length);
    const pageProducts = currentProducts.slice(startIndex, endIndex);
    
    // Verificar si no hay productos
    if (pageProducts.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="5" class="text-center">
                <div class="no-products-message">
                    <i class="fas fa-box-open"></i>
                    <h3>No se encontraron ventas</h3>
                    <p>No hay ventas registradas. Comienza agregando una nueva venta.</p>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
        
        // Actualizar resumen
        document.getElementById('shownItems').textContent = 0;
        document.getElementById('totalItems').textContent = 0;
        
        // Actualizar estado de paginación
        updatePagination();
        return;
    }
    
    pageProducts.forEach((product) => {
        try {
            const firstLetter = product.name?.charAt(0) || '?';
            const avatarColor = avatarColors[product.category] || '#4e73df';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="product-cell">
                        <div class="product-avatar" style="background-color: ${avatarColor}">${firstLetter}</div>
                        <div class="product-info">
                            <div class="product-name">${product.name || 'Producto desconocido'}</div>
                            <div class="product-price">$${Number(product.price || 0).toFixed(2)}</div>
                        </div>
                    </div>
                </td>
                <td class="category">${product.category || 'Sin categoría'}</td>
                <td class="sales-total">$${Number(product.sales || 0).toFixed(2)}</td>
                <td class="quantity">${Number(product.quantity || 0)}</td>
                <td class="actions">
                    <button class="action-btn view">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn download">
                        <i class="fas fa-download"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        } catch (e) {
            console.error('Error al renderizar producto:', product, e);
        }
    });
    
    // Actualizar resumen
    document.getElementById('shownItems').textContent = pageProducts.length;
    document.getElementById('totalItems').textContent = currentProducts.length;
    
    // Actualizar estado de paginación
    updatePagination();
}

// Actualizar estado de paginación
function updatePagination() {
    const totalPages = Math.ceil(currentProducts.length / itemsPerPage);
    const pagination = document.querySelector('.pagination');
    
    // Limpiar botones de página (excepto prev/next)
    while (pagination.children.length > 2) {
        pagination.removeChild(pagination.children[1]);
    }
    
    // Añadir botones de página
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderProductsTable();
        });
        pagination.insertBefore(pageBtn, pagination.lastElementChild);
    }
    
    // Actualizar estado de botones prev/next
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('prevPage').classList.toggle('disabled', currentPage === 1);
    document.getElementById('nextPage').disabled = currentPage === totalPages;
    document.getElementById('nextPage').classList.toggle('disabled', currentPage === totalPages);
}

// Cargar datos para el gráfico
async function loadChartData(period = 'hoy', startDate = null, endDate = null) {
    try {
        let url = '/api/ventas_por_producto';
        const params = new URLSearchParams();
        
        if (period) {
            params.append('period', period);
        }
        if (startDate && endDate) {
            params.append('start_date', startDate);
            params.append('end_date', endDate);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const chartData = await response.json();
        renderChart(chartData);
    } catch (error) {
        console.error('Error al cargar datos del gráfico:', error);
        notyf.error('Error al cargar datos del gráfico');
        // Datos de respaldo
        renderChart({
            labels: [
                "Laptop HP EliteBook (Tecnología)",
                "Smartphone Samsung Galaxy (Tecnología)",
                "Mesa de Oficina (Muebles)",
                "Silla Ergonómica (Muebles)",
                "Impresora Laser (Tecnología)"
            ],
            ventas: [3250, 2780.50, 1950.75, 1780.25, 1250],
            cantidad: [42, 35, 28, 22, 18]
        });
    }
}

// Renderizar gráfico
function renderChart(data) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (salesChart) {
        salesChart.destroy();
    }
    
    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Ventas Totales ($)',
                data: data.ventas,
                backgroundColor: 'rgba(78, 115, 223, 0.5)',
                borderColor: 'rgba(78, 115, 223, 1)',
                borderWidth: 1
            }, {
                label: 'Cantidad Vendida',
                data: data.cantidad,
                backgroundColor: 'rgba(28, 200, 138, 0.5)',
                borderColor: 'rgba(28, 200, 138, 1)',
                borderWidth: 1,
                type: 'line',
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Ventas Totales ($)'
                    }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cantidad Vendida'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Ventas por Producto'
                }
            }
        }
    });
}

// Funcionalidad para mostrar/ocultar el panel de filtros
function setupFilterPanel() {
    const toggleFilters = document.getElementById('toggleFilters');
    const filtersPanel = document.getElementById('filtersPanel');
    const closeFilters = document.getElementById('closeFilters');
    
    toggleFilters.addEventListener('click', (e) => {
        e.stopPropagation();
        filtersPanel.classList.toggle('visible');
    });
    
    closeFilters.addEventListener('click', () => {
        filtersPanel.classList.remove('visible');
    });
    
    // Cerrar panel al hacer clic fuera de él
    document.addEventListener('click', (e) => {
        if (!filtersPanel.contains(e.target) && !toggleFilters.contains(e.target)) {
            filtersPanel.classList.remove('visible');
        }
    });
}

// Funcionalidad para los botones de período
function setupPeriodButtons() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const period = btn.dataset.period;
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentPeriod = period;
            
            if (period === 'personalizado') {
                // Abrir modal para rango personalizado
                const today = new Date().toISOString().split('T')[0];
                const { value: dates } = await Swal.fire({
                    title: 'Seleccione un rango de fechas',
                    html: `
                        <div class="date-range-container">
                            <div class="date-input">
                                <label for="startDate">Fecha de inicio:</label>
                                <input type="date" id="startDate" class="swal2-input" value="${today}" max="${today}">
                            </div>
                            <div class="date-input">
                                <label for="endDate">Fecha de fin:</label>
                                <input type="date" id="endDate" class="swal2-input" value="${today}" max="${today}">
                            </div>
                        </div>
                    `,
                    focusConfirm: false,
                    showCancelButton: true,
                    confirmButtonText: 'Aplicar',
                    cancelButtonText: 'Cancelar',
                    preConfirm: () => {
                        const startDate = document.getElementById('startDate').value;
                        const endDate = document.getElementById('endDate').value;
                        if (!startDate || !endDate) {
                            Swal.showValidationMessage('Por favor, seleccione ambas fechas');
                            return false;
                        }
                        if (new Date(startDate) > new Date(endDate)) {
                            Swal.showValidationMessage('La fecha de inicio debe ser anterior a la fecha de fin');
                            return false;
                        }
                        return { startDate, endDate };
                    },
                    customClass: {
                        popup: 'custom-swal-popup',
                        htmlContainer: 'custom-swal-html'
                    }
                });
                
                if (dates) {
                    // Recargar datos con el rango seleccionado
                    initDashboard('personalizado', dates.startDate, dates.endDate);
                } else {
                    // Si se canceló, volver al período anterior
                    document.querySelectorAll('.period-btn').forEach(b => {
                        if (b.dataset.period === currentPeriod) {
                            b.classList.add('active');
                        }
                    });
                }
            } else {
                // Recargar datos para el período seleccionado
                initDashboard(period);
            }
        });
    });
}

// Funcionalidad para los encabezados ordenables
function setupSortableHeaders() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sort;
            const icon = header.querySelector('i');
            
            // Cambiar ícono
            if (icon.classList.contains('fa-sort')) {
                icon.classList.remove('fa-sort');
                icon.classList.add('fa-sort-up');
            } else if (icon.classList.contains('fa-sort-up')) {
                icon.classList.remove('fa-sort-up');
                icon.classList.add('fa-sort-down');
            } else {
                icon.classList.remove('fa-sort-down');
                icon.classList.add('fa-sort');
            }
            
            // Ordenar productos
            currentProducts.sort((a, b) => {
                let valA, valB;
                
                switch(sortBy) {
                    case 'product':
                        valA = a.name.toLowerCase();
                        valB = b.name.toLowerCase();
                        break;
                    case 'category':
                        valA = a.category.toLowerCase();
                        valB = b.category.toLowerCase();
                        break;
                    case 'sales':
                        valA = a.sales;
                        valB = b.sales;
                        break;
                    case 'quantity':
                        valA = a.quantity;
                        valB = b.quantity;
                        break;
                    default:
                        return 0;
                }
                
                if (icon.classList.contains('fa-sort-up')) {
                    return valA > valB ? 1 : -1;
                } else if (icon.classList.contains('fa-sort-down')) {
                    return valA < valB ? 1 : -1;
                }
                return 0;
            });
            
            renderProductsTable();
        });
    });
}

// Funcionalidad para la paginación
function setupPagination() {
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderProductsTable();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(currentProducts.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderProductsTable();
        }
    });
}

// Funcionalidad para buscar productos
function setupSearch() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (searchTerm === '') {
            currentProducts = [...allProducts];
        } else {
            currentProducts = allProducts.filter(product => 
                product.name.toLowerCase().includes(searchTerm) || 
                product.category.toLowerCase().includes(searchTerm)
            );
        }
        
        currentPage = 1;
        renderProductsTable();
    });
}

// Funcionalidad para aplicar filtros
function setupFilters() {
    document.getElementById('applyFilters').addEventListener('click', () => {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const productFilter = document.getElementById('productFilter').value;
        
        currentProducts = allProducts.filter(product => {
            const matchesCategory = categoryFilter === '' || product.category === categoryFilter;
            const matchesProduct = productFilter === '' || product.name === productFilter;
            return matchesCategory && matchesProduct;
        });
        
        currentPage = 1;
        renderProductsTable();
        document.getElementById('filtersPanel').classList.remove('visible');
        
        notyf.success('Filtros aplicados correctamente');
    });

    document.getElementById('resetFilters').addEventListener('click', () => {
        document.getElementById('categoryFilter').value = '';
        document.getElementById('productFilter').value = '';
        
        currentProducts = [...allProducts];
        currentPage = 1;
        renderProductsTable();
        document.getElementById('filtersPanel').classList.remove('visible');
        
        notyf.success('Filtros restablecidos');
    });
}

// Funcionalidad para botones de exportación
function setupExportButtons() {
    document.getElementById('exportExcel').addEventListener('click', () => {
        notyf.success('Exportando datos a Excel...');
        // Simular descarga
        simulateDownload('reporte_ventas.xlsx');
    });
    
    document.getElementById('exportPDF').addEventListener('click', () => {
        notyf.success('Exportando datos a PDF...');
        // Simular descarga
        simulateDownload('reporte_ventas.pdf');
    });
    
    document.getElementById('refreshData').addEventListener('click', () => {
        notyf.info('Actualizando datos...');
        // Recargar datos
        initDashboard(currentPeriod);
    });
}

// Simular descarga de archivo
function simulateDownload(filename) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent('Datos de ventas'));
    element.setAttribute('download', filename);
    
    element.style.display = 'none';
    document.body.appendChild(element);
    
    element.click();
    
    document.body.removeChild(element);
}

// Funcionalidad para los botones de acción
function setupActionButtons() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn.view')) {
            const row = e.target.closest('tr');
            const productName = row.querySelector('.product-name').textContent;
            
            Swal.fire({
                title: `Detalles de ${productName}`,
                html: `
                    <div class="product-details">
                        <p><strong>Categoría:</strong> ${row.querySelector('.category').textContent}</p>
                        <p><strong>Ventas totales:</strong> ${row.querySelector('.sales-total').textContent}</p>
                        <p><strong>Cantidad vendida:</strong> ${row.querySelector('.quantity').textContent}</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Cerrar'
            });
        }
        
        if (e.target.closest('.action-btn.download')) {
            const row = e.target.closest('tr');
            const productName = row.querySelector('.product-name').textContent;
            
            Swal.fire({
                title: 'Descargar reporte',
                text: `¿Desea descargar el reporte de ${productName}?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, descargar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    simulateDownload(`reporte_${productName.replace(/\s+/g, '_')}.pdf`);
                    notyf.success(`Reporte de ${productName} descargado`);
                }
            });
        }
    });
}

// Inicializar todas las funcionalidades
function initializeApp() {
    setupFilterPanel();
    setupPeriodButtons();
    setupSortableHeaders();
    setupPagination();
    setupSearch();
    setupFilters();
    setupExportButtons();
    setupActionButtons();
    
    // Inicializar el dashboard con el período 'hoy'
    initDashboard('hoy');
}

// Inicializar la aplicación cuando se cargue la página
document.addEventListener('DOMContentLoaded', initializeApp);