// inventario.js
// Obtener elementos DOM
const statsContainer = document.getElementById('stats-container');
const historyContainer = document.getElementById('history-container');
const alertContainer = document.getElementById('alert-container');
const alertText = document.getElementById('alert-text');
const productSelect = document.getElementById('product-select');
const inventoryForm = document.getElementById('inventory-form');
const movementFilters = document.getElementById('movement-filters');
const filterButtons = movementFilters.querySelectorAll('.tab-filter');
const apiBaseUrl = '/inventario/api';

// Estado de la aplicación
let lastUpdate = 0;
let currentFilter = 'all';
let productosData = [];
let movimientosData = [];

// Función para parsear fecha en formato DD/MM/YYYY HH:mm a objeto Date
function parseCustomDate(dateStr) {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
}

// Función para cargar datos iniciales
function loadInitialData() {
    fetch(`${apiBaseUrl}/datos-inventario`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            lastUpdate = data.timestamp;
            productosData = data.productos || [];
            movimientosData = data.movimientos || [];
            
            renderStats(data.estadisticas);
            renderMovimientos(applyCurrentFilter(movimientosData));
            renderAlerts(data.bajo_stock);
            populateProductSelect();
        })
        .catch(error => {
            console.error('Error al cargar datos:', error);
            notyf.error('Error al cargar datos del inventario');
        });
}

// Función para aplicar el filtro actual
function applyCurrentFilter(data) {
    if (currentFilter === 'all') {
        return data;
    } else if (currentFilter === 'Entrada' || currentFilter === 'Salida') {
        return data.filter(m => m.tipo === currentFilter);
    } else if (currentFilter === 'last7') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0); // Inicio del día
        
        return data.filter(m => {
            const fechaMov = parseCustomDate(m.fecha);
            return fechaMov >= sevenDaysAgo;
        });
    }
    return data;
}

// Renderizar estadísticas
function renderStats(stats) {
    if (!stats) {
        statsContainer.innerHTML = '<p>Error al cargar estadísticas</p>';
        return;
    }
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-title">Total de Productos</div>
            <div class="stat-value">${stats.total_productos}</div>
            <div class="stat-trend trend-up">
                <i class="fas fa-arrow-up"></i>
                <span>${Math.floor(stats.total_productos * 0.15)} nuevos este mes</span>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-title">Movimientos este mes</div>
            <div class="stat-value">${stats.movimientos_mes}</div>
            <div class="stat-trend ${stats.movimientos_mes > 100 ? 'trend-up' : 'trend-down'}">
                <i class="fas fa-arrow-${stats.movimientos_mes > 100 ? 'up' : 'down'}"></i>
                <span>${Math.abs(stats.movimientos_mes - 100)}% ${stats.movimientos_mes > 100 ? 'más' : 'menos'} que el mes pasado</span>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-title">Valor total del inventario</div>
            <div class="stat-value">$${stats.valor_inventario.toLocaleString('es-ES', {maximumFractionDigits: 0})}</div>
            <div class="stat-trend ${stats.valor_inventario > 80000 ? 'trend-up' : 'trend-down'}">
                <i class="fas fa-arrow-${stats.valor_inventario > 80000 ? 'up' : 'down'}"></i>
                <span>${Math.abs(stats.valor_inventario/80000 - 1).toFixed(1)}% ${stats.valor_inventario > 80000 ? 'más' : 'menos'} que el mes pasado</span>
            </div>
        </div>
    `;
}

// Renderizar movimientos
function renderMovimientos(movimientos) {
    if (!movimientos || movimientos.length === 0) {
        historyContainer.innerHTML = '<p class="no-movements">No hay movimientos registrados</p>';
        return;
    }
    
    historyContainer.innerHTML = movimientos.map(mov => {
        const iconClass = 
            mov.tipo === 'Entrada' ? 'entry' : 
            mov.tipo === 'Salida' ? 'exit' : 
            mov.tipo === 'Ajuste' ? 'adjustment' : 
            mov.tipo === 'Transferencia' ? 'transfer' : 'return';
        
        const iconSymbol = 
            mov.tipo === 'Entrada' ? 'fa-arrow-down' : 
            mov.tipo === 'Salida' ? 'fa-arrow-up' : 
            mov.tipo === 'Ajuste' ? 'fa-exchange-alt' : 
            mov.tipo === 'Transferencia' ? 'fa-truck-loading' : 'fa-undo';
        
        return `
            <div class="history-item fade-in">
                <div class="history-icon ${iconClass}">
                    <i class="fas ${iconSymbol}"></i>
                </div>
                <div class="history-content">
                    <div class="history-title">${mov.tipo} de productos</div>
                    <div class="history-details">
                        <div>
                            <span class="detail-label">Producto:</span>
                            ${mov.producto}
                        </div>
                        <div>
                            <span class="detail-label">Cantidad:</span>
                            ${mov.cantidad} unidades
                        </div>
                        <div>
                            <span class="detail-label">Fecha:</span>
                            ${mov.fecha}
                        </div>
                        <div>
                            <span class="detail-label">Responsable:</span>
                            ${mov.responsable}
                        </div>
                        <div>
                            <span class="detail-label">Motivo:</span>
                            ${mov.motivo}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Renderizar alertas
function renderAlerts(lowStockProducts) {
    if (!lowStockProducts || lowStockProducts.length === 0) {
        alertContainer.style.display = 'none';
        return;
    }
    
    alertContainer.style.display = 'flex';
    const alertItems = lowStockProducts.map(p => 
        `${p.nombre} tiene solo ${p.stock} unidades (stock mínimo: ${p.stock_min})`
    ).join('<br>');
    
    alertText.innerHTML = alertItems;
}

// Llenar el selector de productos
function populateProductSelect() {
    // Limpiar opciones existentes excepto la primera
    while (productSelect.options.length > 1) {
        productSelect.remove(1);
    }
    
    // Añadir productos
    productosData.forEach(producto => {
        const option = document.createElement('option');
        option.value = producto.id;
        option.textContent = `${producto.nombre} (${producto.codigo})`;
        productSelect.appendChild(option);
    });
    
    // Si no hay productos, mostrar mensaje
    if (productosData.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No hay productos disponibles";
        option.disabled = true;
        option.selected = true;
        productSelect.appendChild(option);
    }
}

// Manejar envío de formulario
inventoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const productId = parseInt(productSelect.value);
    const movementType = document.getElementById('movement-type').value;
    const quantity = parseInt(document.getElementById('movement-quantity').value);
    const reason = document.getElementById('movement-reason').value;
    
    if (!productId || !movementType || !quantity || !reason) {
        notyf.error('Por favor complete todos los campos');
        return;
    }
    
    // Validar cantidad positiva
    if (quantity <= 0) {
        notyf.error('La cantidad debe ser un número positivo');
        return;
    }
    
    // Enviar movimiento al servidor
    fetch(`${apiBaseUrl}/registrar-movimiento`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            producto_id: productId,
            tipo: movementType,
            cantidad: quantity,
            motivo: reason
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Error del servidor') });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Actualizar datos localmente
            const productoIndex = productosData.findIndex(p => p.id === productId);
            if (productoIndex !== -1) {
                productosData[productoIndex] = data.producto_actualizado;
            }
            
            // Agregar movimiento al inicio
            movimientosData.unshift(data.movimiento);
            if (movimientosData.length > 20) {
                movimientosData.pop();
            }
            
            // Renderizar movimientos con el filtro actual aplicado
            renderMovimientos(applyCurrentFilter(movimientosData));
            
            // Actualizar alertas de stock
            renderAlerts(productosData.filter(p => p.stock < p.stock_min));
            
            // Mostrar notificación
            notyf.success('Movimiento registrado correctamente');
            
            // Limpiar formulario
            inventoryForm.reset();
        } else {
            notyf.error(data.error || 'Error al registrar movimiento');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        notyf.error(error.message || 'Error al conectar con el servidor');
    });
});

// Manejar filtros
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Quitar clase active a todos
        filterButtons.forEach(btn => btn.classList.remove('active'));
        // Añadir clase active al seleccionado
        button.classList.add('active');
        currentFilter = button.dataset.filter;
        
        // Renderizar movimientos con el nuevo filtro aplicado
        renderMovimientos(applyCurrentFilter(movimientosData));
        
        notyf.success(`Filtro aplicado: ${button.textContent}`);
    });
});

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos iniciales
    loadInitialData();
    
    // Inicializar notificaciones
    window.notyf = new Notyf({
        duration: 3000,
        position: {
            x: 'right',
            y: 'top'
        },
        types: [
            {
                type: 'success',
                background: '#06d6a0',
                icon: {
                    className: 'fas fa-check',
                    tagName: 'i',
                    color: '#fff'
                }
            },
            {
                type: 'error',
                background: '#ef476f',
                icon: {
                    className: 'fas fa-times',
                    tagName: 'i',
                    color: '#fff'
                }
            }
        ]
    });
});