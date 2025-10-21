// Variables globales y configuración inicial
let cart = [];
let scannerTimeout = null;
let scannerBuffer = '';
let scannerActive = false;
let currentPaymentMethod = 'efectivo';
let currentClient = { id: 'cf', name: 'Consumidor Final', rnc: '000-000000-0', type: 'cliente' };
const ITBIS_RATE = 0.18;
let globalDiscount = { amount: 0, type: 'fixed' };

// Variable para controlar el último producto agregado
let lastProductAdded = null;

// CONFIGURACIÓN CORREGIDA DE NOTYF
const notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    types: [
        { type: 'success', background: '#4caf50' },
        { type: 'error', background: '#ef476f' },
        { type: 'info', background: '#2196f3' }
    ]
});

// ========== CONFIGURACIÓN DE ESCÁNER SIEMPRE ACTIVO ==========
const SCANNER_DELAY = 100; // ms entre caracteres para considerar que es un escáner

function setupAlwaysOnScanner() {
    const scannerInput = document.getElementById('always-on-scanner');
    
    if (!scannerInput) {
        console.error('Campo de escáner siempre activo no encontrado');
        return;
    }

    // Enfocar el campo oculto al cargar la página
    setTimeout(() => {
        if (!scannerActive) { // Solo enfocar si el escáner manual NO está activo
            scannerInput.focus();
        }
    }, 500);

    // Event listener para todo el documento - captura todas las teclas
    document.addEventListener('keydown', function(e) {
        // Si el escáner manual está activo, ignorar
        if (scannerActive) return;
        
        // Si el usuario está escribiendo en un campo, ignorar (excepto Enter)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if (e.key === 'Enter') {
                // Si es Enter en el campo de búsqueda, procesar como búsqueda normal
                if (e.target.id === 'product-search' && scannerBuffer === '') {
                    return; // Permitir comportamiento normal del Enter
                }
            } else {
                resetScannerBuffer();
                return; // Permitir escritura normal en campos
            }
        }

        // Ignorar teclas especiales
        if (e.ctrlKey || e.altKey || e.metaKey || e.key === 'Shift') {
            return;
        }

        // Prevenir comportamiento por defecto para teclas alfanuméricas
        if (e.key.length === 1 || e.key === 'Enter') {
            e.preventDefault();
        }

        // Procesar la tecla
        processScannerKey(e.key);
    });

    // Mantener el foco en el escáner oculto (solo si el manual no está activo)
    scannerInput.addEventListener('blur', function() {
        setTimeout(() => {
            if (!scannerActive && !document.activeElement || 
                (document.activeElement.tagName !== 'INPUT' && 
                 document.activeElement.tagName !== 'TEXTAREA')) {
                scannerInput.focus();
            }
        }, 100);
    });

    // También enfocar cuando se haga clic en cualquier lugar que no sea un campo de entrada
    document.addEventListener('click', function(e) {
        if (!scannerActive && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            setTimeout(() => {
                scannerInput.focus();
            }, 100);
        }
    });

    console.log('🔍 Escáner siempre activo inicializado');
}

function processScannerKey(key) {
    const scannerInput = document.getElementById('always-on-scanner');
    
    // Resetear timeout anterior
    if (scannerTimeout) {
        clearTimeout(scannerTimeout);
    }

    if (key === 'Enter') {
        // Procesar código completo
        const code = scannerBuffer.trim();
        if (code.length > 0) {
            console.log('🔍 [Siempre Activo] Código escaneado:', code);
            processScannedCode(code);
            // Pequeña vibración táctil (si está disponible)
            if (navigator.vibrate) navigator.vibrate(50);
        }
        scannerBuffer = '';
        if (scannerInput) scannerInput.value = '';
    } else if (key.length === 1) {
        // Agregar carácter al buffer
        scannerBuffer += key;
        if (scannerInput) scannerInput.value = '*'.repeat(scannerBuffer.length);
        
        // Mostrar indicador visual del escáner
        showScannerIndicator('Siempre Activo');
    } else if (key === 'Backspace') {
        // Permitir borrar (útil para correcciones)
        scannerBuffer = scannerBuffer.slice(0, -1);
        if (scannerInput) scannerInput.value = '*'.repeat(scannerBuffer.length);
    }

    // Timeout para resetear el buffer si no se completa el escaneo
    scannerTimeout = setTimeout(() => {
        if (scannerBuffer.length > 0) {
            console.log('⏰ Timeout del escáner siempre activo, buffer reseteado:', scannerBuffer);
            resetScannerBuffer();
        }
    }, SCANNER_DELAY + 500);
}

function resetScannerBuffer() {
    scannerBuffer = '';
    const scannerInput = document.getElementById('always-on-scanner');
    if (scannerInput) scannerInput.value = '';
    hideScannerIndicator();
    
    if (scannerTimeout) {
        clearTimeout(scannerTimeout);
        scannerTimeout = null;
    }
}

function showScannerIndicator(mode = 'Siempre Activo') {
    let indicator = document.getElementById('scanner-always-on-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'scanner-always-on-indicator';
        indicator.innerHTML = `
            <div class="scanner-indicator">
                <i class="fas fa-barcode"></i>
                <span>Escáner ${mode} - Buffer: <span id="scanner-buffer-display"></span></span>
            </div>
        `;
        document.body.appendChild(indicator);
        
        // Agregar estilos si no existen
        if (!document.getElementById('scanner-indicator-styles')) {
            const styles = document.createElement('style');
            styles.id = 'scanner-indicator-styles';
            styles.textContent = `
                .scanner-indicator {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #4CAF50;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    z-index: 10000;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    animation: pulse 2s infinite;
                }
                .scanner-indicator.manual-mode {
                    background: #2196F3;
                }
                .scanner-indicator i {
                    margin-right: 5px;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
    }
    
    // Aplicar clase diferente para modo manual
    if (mode === 'Manual') {
        indicator.querySelector('.scanner-indicator').classList.add('manual-mode');
    } else {
        indicator.querySelector('.scanner-indicator').classList.remove('manual-mode');
    }
    
    const bufferDisplay = document.getElementById('scanner-buffer-display');
    if (bufferDisplay) {
        bufferDisplay.textContent = scannerBuffer.length > 0 ? '*'.repeat(scannerBuffer.length) : 'vacío';
    }
}

function hideScannerIndicator() {
    const indicator = document.getElementById('scanner-always-on-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// ========== FUNCIONES BÁSICAS DE UTILIDAD ==========
function openModal(modal) {
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function formatNumber(num) {
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseFormattedNumber(str) {
    return parseFloat(str.replace(/[^\d.]/g, '')) || 0;
}

function calculateItbis(price) {
    if (!price || isNaN(price)) return 0;
    const base = price / (1 + ITBIS_RATE);
    return price - base;
}

function getElementOrError(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Elemento con ID '${id}' no encontrado`);
    }
    return element;
}

// ========== FUNCIONES DE BÚSQUEDA DE PRODUCTOS ==========
async function searchProducts(term, exact = false) {
    try {
        let url = `/facturacion/api/productos?q=${encodeURIComponent(term)}`;
        if (exact) {
            url += '&exact=true';
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('Error al buscar productos:', error);
        notyf.error('Error al buscar productos');
        return [];
    }
}

// ========== FUNCIONES DEL ESCÁNER MANUAL ==========
function toggleScanner() {
    const scannerContainer = document.getElementById('scanner-input-container');
    const scannerInput = document.getElementById('scanner-input');
    const scannerToggle = document.getElementById('scanner-toggle');
    const productSearch = document.getElementById('product-search');
    
    scannerActive = !scannerActive;
    
    if (scannerActive) {
        scannerContainer.classList.remove('hidden');
        if (productSearch) productSearch.style.display = 'none';
        scannerToggle.classList.add('active');
        scannerToggle.title = 'Desactivar escáner manual';
        scannerInput.focus();
        notyf.success('Modo escáner manual activado. Escanee un código de barras.');
        
        // Mostrar indicador en modo manual
        showScannerIndicator('Manual');
    } else {
        scannerContainer.classList.add('hidden');
        if (productSearch) productSearch.style.display = 'block';
        scannerToggle.classList.remove('active');
        scannerToggle.title = 'Activar escáner manual';
        if (productSearch) productSearch.focus();
        
        // Limpiar buffer y ocultar indicador
        scannerBuffer = '';
        scannerInput.value = '';
        hideScannerIndicator();
        notyf.success('Modo escáner manual desactivado.');
        
        // Re-enfocar el escáner siempre activo
        const alwaysOnScanner = document.getElementById('always-on-scanner');
        if (alwaysOnScanner) {
            setTimeout(() => alwaysOnScanner.focus(), 100);
        }
    }
}

function setupManualScanner() {
    const scannerInput = document.getElementById('scanner-input');
    const scannerToggle = document.getElementById('scanner-toggle');
    const scannerClose = document.getElementById('scanner-close');
    
    if (!scannerInput || !scannerToggle) return;
    
    scannerToggle.addEventListener('click', toggleScanner);
    
    if (scannerClose) {
        scannerClose.addEventListener('click', toggleScanner);
    }
    
    scannerInput.addEventListener('keydown', function(e) {
        if (!scannerActive) return;
        
        if (scannerTimeout) {
            clearTimeout(scannerTimeout);
        }
        
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = scannerBuffer.trim();
            if (code.length > 0) {
                console.log('🔍 [Manual] Código escaneado:', code);
                processScannedCode(code);
            }
            scannerBuffer = '';
            scannerInput.value = '';
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            scannerBuffer += e.key;
            scannerInput.value = '*'.repeat(scannerBuffer.length);
        }
        
        scannerTimeout = setTimeout(() => {
            if (scannerBuffer.length > 0) {
                console.log('Buffer del escáner manual resetado:', scannerBuffer);
            }
            scannerBuffer = '';
            scannerInput.value = '';
        }, 150);
    });
    
    scannerInput.addEventListener('blur', function() {
        if (scannerActive) {
            setTimeout(() => {
                scannerInput.focus();
            }, 100);
        }
    });
}

// ========== FUNCIONES COMUNES DE ESCÁNER ==========
async function processScannedCode(code) {
    if (!code || code.length < 3) {
        console.log('❌ Código demasiado corto:', code);
        return;
    }
    
    console.log('🔍 Procesando código:', code);
    
    try {
        // Primero intentar búsqueda exacta
        const exactProducts = await searchProducts(code, true);
        
        if (exactProducts && exactProducts.length > 0) {
            const product = exactProducts[0];
            addToCart(product);
            notyf.success(`✅ ${product.name} agregado desde escáner`);
            return;
        }
        
        // Si no se encuentra con búsqueda exacta, intentar búsqueda normal
        console.log('🔄 No encontrado exactamente, intentando búsqueda normal...');
        const normalProducts = await searchProducts(code);
        
        if (normalProducts && normalProducts.length > 0) {
            const product = normalProducts[0];
            addToCart(product);
            notyf.success(`✅ ${product.name} agregado (búsqueda parcial)`);
        } else {
            notyf.error('❌ Producto no encontrado');
            console.log('📦 Código no encontrado en la base de datos:', code);
        }
        
    } catch (error) {
        console.error('❌ Error procesando código escaneado:', error);
        notyf.error('🌐 Error de conexión con el servidor');
    }
}

// ========== FUNCIONES DE DESCUENTO ==========
function applyDiscount() {
    const discountInput = document.getElementById('discount-amount');
    const discountType = document.getElementById('discount-type');
    
    if (!discountInput || !discountType) return;
    
    const discountValue = parseFormattedNumber(discountInput.value) || 0;
    const type = discountType.value;
    
    if (discountValue < 0) {
        notyf.error('El descuento no puede ser negativo');
        return;
    }
    
    if (type === 'percentage' && discountValue > 100) {
        notyf.error('El descuento no puede ser mayor al 100%');
        return;
    }
    
    globalDiscount = {
        amount: discountValue,
        type: type
    };
    
    updateSummary();
    
    if (discountValue > 0) {
        notyf.success(`Descuento ${type === 'fixed' ? 'de RD$ ' + formatNumber(discountValue) : 'del ' + discountValue + '%'} aplicado`);
    } else {
        notyf.success('Descuento eliminado');
    }
}

function calculateDiscount(subtotal) {
    if (globalDiscount.amount <= 0) return 0;
    
    if (globalDiscount.type === 'fixed') {
        return Math.min(globalDiscount.amount, subtotal);
    } else {
        return (subtotal * globalDiscount.amount) / 100;
    }
}

// ========== FUNCIONES DE TECLADO ==========
function setupKeyboardActions() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || cart.length === 0) {
            return;
        }

        if (!lastProductAdded && cart.length > 0) {
            lastProductAdded = cart[cart.length - 1].id;
        }

        switch (e.key) {
            case '+':
            case 'Add':
                e.preventDefault();
                increaseLastProductQuantity();
                break;
                
            case '-':
            case 'Subtract':
                e.preventDefault();
                decreaseLastProductQuantity();
                break;
        }
    });
}

function increaseLastProductQuantity() {
    if (!lastProductAdded) return;
    
    const product = cart.find(item => item.id === lastProductAdded);
    if (product) {
        updateQuantity(product.id, product.quantity + 1);
        highlightLastProduct();
    }
}

function decreaseLastProductQuantity() {
    if (!lastProductAdded) return;
    
    const product = cart.find(item => item.id === lastProductAdded);
    if (product) {
        if (product.quantity > 1) {
            updateQuantity(product.id, product.quantity - 1);
        } else {
            removeItem(product.id);
            if (cart.length > 0) {
                lastProductAdded = cart[cart.length - 1].id;
            } else {
                lastProductAdded = null;
            }
        }
        highlightLastProduct();
    }
}

function highlightLastProduct() {
    document.querySelectorAll('#cart-items tr').forEach(row => {
        row.classList.remove('last-product-highlight');
    });
    
    if (lastProductAdded) {
        const rows = document.querySelectorAll('#cart-items tr');
        const lastProductRow = Array.from(rows).find(row => {
            const input = row.querySelector('.quantity-input');
            return input && input.dataset.id === lastProductAdded;
        });
        
        if (lastProductRow) {
            lastProductRow.classList.add('last-product-highlight');
            lastProductRow.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }
}

// ========== FUNCIONES DE GESTIÓN DE DATOS ==========
async function loadPersonas(tipo, containerId, term = '') {
    try {
        let url = `/facturacion/api/personas?tipo=${tipo}`;
        
        if (term) {
            url += `&q=${encodeURIComponent(term)}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        const data = await response.json();
        
        // MEJORA: Validar que la respuesta sea un array
        if (Array.isArray(data)) {
            renderPersonas(data, containerId);
        } else {
            console.error('Respuesta de personas no es un array:', data);
            renderPersonas([], containerId);
        }
    } catch (error) {
        notyf.error('Error al cargar registros');
        console.error('Error en loadPersonas:', error);
    }
}

// ========== FUNCIONES DE RENDERIZADO UI ==========
function renderPersonas(personas, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';

    if (personas && personas.length > 0) {
        personas.forEach(persona => {
            const item = document.createElement('div');
            item.className = 'client-card';
            if (persona.id === currentClient.id) item.classList.add('active');
            
            const iconType = (persona.id === 'cf') ? 'user' : 
                            (persona.type && persona.type.toLowerCase() === 'cliente' ? 'user' : 'truck');
            
            item.innerHTML = `
                <div class="client-card-content">
                    <div class="client-avatar"><i class="fas fa-${iconType}"></i></div>
                    <div class="client-details">
                        <h4>${persona.name || 'Sin nombre'}</h4>
                        <p>${persona.type === 'Proveedor' ? 'RNC' : 'Cédula'}: ${persona.rnc || 'N/A'}</p>
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                currentClient = {
                    id: persona.id,
                    name: persona.name,
                    rnc: persona.rnc,
                    type: persona.type ? persona.type.toLowerCase() : 'cliente'
                };
                updateClientUI();
                closeModal(document.getElementById('client-modal'));
            });
            
            container.appendChild(item);
        });
    } else {
        container.innerHTML = '<div class="text-center p-4">No se encontraron registros</div>';
    }
}

function updateClientUI() {
    const clientInfo = document.getElementById('client-info');
    if (!clientInfo) return;
    
    const clientElement = clientInfo.querySelector('.client-content');
    if (!clientElement) return;
    
    const clientIcon = (currentClient.id === 'cf') ? 'user' : 
                     (currentClient.type === 'cliente' ? 'user' : 'truck');
    
    clientElement.innerHTML = `
        <i class="fas fa-${clientIcon} client-icon"></i>
        <span>${currentClient.name}</span>
        ${currentClient.type === 'proveedor' ? '<span class="badge bg-blue ml-2">PROVEEDOR</span>' : ''}
    `;
}

// ========== FUNCIONES DE GESTIÓN DEL CARRITO ==========
function addToCart(product) {
    if (!product || !product.id || !product.name) {
        notyf.error('❌ Producto inválido - datos incompletos');
        return;
    }
    
    if (product.stock !== undefined && product.stock <= 0) {
        notyf.error('❌ Producto agotado en inventario');
        return;
    }
    
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        if (product.stock !== undefined && existingItem.quantity >= product.stock) {
            notyf.error('❌ No hay suficiente stock disponible');
            return;
        }
        existingItem.quantity++;
        lastProductAdded = existingItem.id;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price || 0,
            itbis: product.itbis || false,
            quantity: 1,
            stock: product.stock
        });
        lastProductAdded = product.id;
    }
    updateCart();
    notyf.success(`✅ ${product.name} agregado al carrito`);
}

function updateCart() {
    const cartItems = document.getElementById('cart-items');
    const cartTableContainer = document.getElementById('cart-table-container');
    const emptyCart = document.getElementById('empty-cart');
    const invoiceBtn = document.getElementById('invoice-btn');
    
    if (!cartItems || !cartTableContainer || !emptyCart || !invoiceBtn) return;
    
    if (cart.length === 0) {
        cartItems.innerHTML = '';
        cartTableContainer.classList.add('hidden');
        emptyCart.classList.remove('hidden');
        invoiceBtn.disabled = true;
        lastProductAdded = null;
    } else {
        cartTableContainer.classList.remove('hidden');
        emptyCart.classList.add('hidden');
        cartItems.innerHTML = '';
        
        cart.forEach((item, index) => {
            let itbisAmount = 0;
            if (item.itbis) itbisAmount = calculateItbis(item.price) * item.quantity;
            
            const lineTotal = item.price * item.quantity;
            const isLastProduct = item.id === lastProductAdded;
            
            const row = document.createElement('tr');
            if (isLastProduct) {
                row.classList.add('last-product-highlight');
            }
            
            row.innerHTML = `
                <td>
                    <input type="number" min="1" value="${item.quantity}" class="quantity-input" data-id="${item.id}">
                    ${isLastProduct ? '<span class="last-product-indicator" title="Último producto agregado"></span>' : ''}
                </td>
                <td>
                    <div class="font-medium">${item.name}</div>
                    ${isLastProduct ? '<span class="last-product-badge">ÚLTIMO</span>' : ''}
                </td>
                <td>RD$ ${formatNumber(item.price)}</td>
                <td>RD$ ${formatNumber(itbisAmount)}</td>
                <td class="font-medium">RD$ ${formatNumber(lineTotal)}</td>
                <td><button class="delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button></td>
            `;
            cartItems.appendChild(row);
        });
        
        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => {
                updateQuantity(e.target.dataset.id, parseInt(e.target.value));
            });
        });
        
        document.querySelectorAll('.delete-item').forEach(button => {
            button.addEventListener('click', (e) => {
                removeItem(e.target.closest('button').dataset.id);
            });
        });
    }
    updateSummary();
    
    setTimeout(() => {
        highlightLastProduct();
    }, 100);
}

function updateQuantity(id, quantity) {
    if (quantity < 1) {
        removeItem(id);
        return;
    }
    
    const item = cart.find(item => item.id === id);
    if (item) {
        item.quantity = quantity;
        updateCart();
    }
}

function removeItem(id) {
    if (lastProductAdded === id) {
        const index = cart.findIndex(item => item.id === id);
        if (index > 0) {
            lastProductAdded = cart[index - 1].id;
        } else if (cart.length > 1) {
            lastProductAdded = cart[1].id;
        } else {
            lastProductAdded = null;
        }
    }
    
    cart = cart.filter(item => item.id !== id);
    updateCart();
    notyf.error('Producto eliminado');
}

function updateSummary() {
    const subtotalEl = document.getElementById('subtotal');
    const discountEl = document.getElementById('discount-total');
    const itbisTotalEl = document.getElementById('itbis-total');
    const totalEl = document.getElementById('total');
    const changeAmount = document.getElementById('change-amount');
    const invoiceBtn = document.getElementById('invoice-btn');
    
    if (!subtotalEl || !discountEl || !itbisTotalEl || !totalEl || !changeAmount || !invoiceBtn) {
        console.error('Elementos del resumen no encontrados');
        return;
    }
    
    let subtotal = 0;
    let itbisTotal = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        if (item.itbis) {
            const base = itemTotal / (1 + ITBIS_RATE);
            subtotal += base;
            itbisTotal += itemTotal - base;
        } else {
            subtotal += itemTotal;
        }
    });
    
    const discountAmount = calculateDiscount(subtotal);
    const subtotalAfterDiscount = subtotal - discountAmount;
    
    const total = subtotalAfterDiscount + itbisTotal;
    
    subtotalEl.textContent = `RD$ ${formatNumber(subtotalAfterDiscount)}`;
    discountEl.textContent = `RD$ ${formatNumber(discountAmount)}`;
    itbisTotalEl.textContent = `RD$ ${formatNumber(itbisTotal)}`;
    totalEl.textContent = `RD$ ${formatNumber(total)}`;
    
    if (currentPaymentMethod === 'efectivo') {
        const amountReceived = document.getElementById('amount-received');
        if (amountReceived) {
            const rec = parseFormattedNumber(amountReceived.value) || 0;
            const change = rec - total;
            changeAmount.textContent = `RD$ ${formatNumber(change >= 0 ? change : 0)}`;
        }
    }
    
    validateInvoiceButton();
}

function validateInvoiceButton() {
    const totalEl = document.getElementById('total');
    const invoiceBtn = document.getElementById('invoice-btn');
    const amountReceived = document.getElementById('amount-received');
    
    if (!totalEl || !invoiceBtn) return;
    
    const total = parseFormattedNumber(totalEl.textContent);
    
    if (total <= 0) {
        invoiceBtn.disabled = true;
        return;
    }
    
    if (currentPaymentMethod === 'efectivo') {
        if (!amountReceived) {
            invoiceBtn.disabled = true;
            return;
        }
        const rec = parseFormattedNumber(amountReceived.value) || 0;
        invoiceBtn.disabled = rec < total;
    } else {
        invoiceBtn.disabled = false;
    }
}

// ========== FUNCIONES DE PAGOS ==========
function selectPaymentMethod(method) {
    const cashInput = document.getElementById('cash-input');
    const cashChange = document.getElementById('cash-change');
    const amountReceived = document.getElementById('amount-received');
    
    currentPaymentMethod = method;
    
    document.querySelectorAll('.payment-method').forEach(m => {
        m.classList.toggle('active', m.dataset.method === method);
    });
    
    if (method === 'efectivo') {
        if (cashInput) cashInput.classList.remove('hidden');
        if (cashChange) cashChange.classList.remove('hidden');
        setTimeout(() => {
            if (amountReceived) {
                amountReceived.focus();
                amountReceived.select();
            }
        }, 100);
    } else {
        if (cashInput) cashInput.classList.add('hidden');
        if (cashChange) cashChange.classList.add('hidden');
    }
}

function openPaymentModal() {
    const totalEl = document.getElementById('total');
    const amountReceived = document.getElementById('amount-received');
    const modalTotal = document.getElementById('modal-total');
    const modalReceived = document.getElementById('modal-received');
    const modalChange = document.getElementById('modal-change');
    const confirmPayment = document.getElementById('confirm-payment');
    
    if (!totalEl || !amountReceived || !modalTotal || !modalReceived || !modalChange || !confirmPayment) return;
    
    const total = parseFormattedNumber(totalEl.textContent);
    const rec = parseFormattedNumber(amountReceived.value) || 0;
    const change = rec - total;
    
    modalTotal.textContent = totalEl.textContent;
    modalReceived.textContent = `RD$ ${formatNumber(rec)}`;
    modalChange.textContent = `RD$ ${formatNumber(change >= 0 ? change : 0)}`;
    
    resetConfirmButton();
    openModal(document.getElementById('payment-modal'));
    
    setTimeout(() => {
        confirmPayment.focus();
    }, 100);
}

function openCardValidationModal() {
    openModal(document.getElementById('card-validation-modal'));
    generateInvoice();
}

function openTransferModal() {
    const totalEl = document.getElementById('total');
    const transferTotal = document.getElementById('transfer-total');
    if (totalEl && transferTotal) transferTotal.textContent = totalEl.textContent;
    openModal(document.getElementById('transfer-modal'));
}

function openCreditModal() {
    const totalEl = document.getElementById('total');
    const creditTotal = document.getElementById('credit-total');
    const dueDate = document.getElementById('due-date');
    
    if (totalEl && creditTotal) creditTotal.textContent = totalEl.textContent;
    
    if (dueDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dueDate.min = tomorrow.toISOString().split('T')[0];
        
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        dueDate.value = nextWeek.toISOString().split('T')[0];
    }
    
    resetCreditButton();
    openModal(document.getElementById('credit-modal'));
}

// ========== FUNCIONES DE FACTURACIÓN Y RESET ==========
async function generateInvoice() {
    const subtotalEl = document.getElementById('subtotal');
    const discountEl = document.getElementById('discount-total');
    const itbisTotalEl = document.getElementById('itbis-total');
    const invoiceBtn = document.getElementById('invoice-btn');
    const dueDateElement = document.getElementById('due-date');
    const amountReceived = document.getElementById('amount-received');

    const cajaAbierta = await verificarEstadoCaja();
    if (!cajaAbierta) {
        notyf.error('No se puede facturar: Caja cerrada');
        closeModal(document.getElementById('payment-modal'));
        closeModal(document.getElementById('card-validation-modal'));
        closeModal(document.getElementById('transfer-modal'));
        closeModal(document.getElementById('credit-modal'));
        return;
    }
    
    if (!subtotalEl || !discountEl || !itbisTotalEl || !invoiceBtn) return;
    
    const subtotal = parseFormattedNumber(subtotalEl.textContent);
    const discount = parseFormattedNumber(discountEl.textContent);
    const itbis = parseFormattedNumber(itbisTotalEl.textContent);
    const total = subtotal + itbis;
    
    const facturaData = {
        cliente_id: currentClient.id,
        total: total,
        descuento: discount,
        itbis_total: itbis,
        metodo_pago: currentPaymentMethod,
        detalles: cart.map(item => ({
            producto_id: item.id,
            cantidad: item.quantity,
            precio: item.price,
            itbis: item.itbis
        })),
        es_proveedor: currentClient.type === 'proveedor',
        tipo: currentClient.type === 'proveedor' ? 'compra' : 'venta'
    };

    if (currentPaymentMethod === 'efectivo' && amountReceived) {
        facturaData.monto_recibido = parseFormattedNumber(amountReceived.value) || 0;
    }

    if (currentPaymentMethod === 'credito') {
        if (dueDateElement && dueDateElement.value) {
            facturaData.fecha_vencimiento = dueDateElement.value;
        } else {
            notyf.error('Se requiere fecha de vencimiento para créditos');
            resetInvoiceButton();
            return;
        }
    }

    invoiceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    invoiceBtn.disabled = true;

    try {
        const response = await fetch('/facturacion/api/facturas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(facturaData)
        });

        const data = await response.json();
        
        if (data.success) {
            if (currentPaymentMethod !== 'credito') {
                const tipo = currentClient.type === 'proveedor' ? 'gasto' : 'venta';
                const descripcion = `Factura #${data.factura_id} - ${currentClient.name}`;
                
                try {
                    await fetch('/facturacion/api/caja/movimientos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tipo: tipo,
                            metodo_pago: currentPaymentMethod,
                            descripcion: descripcion,
                            monto: total,
                            factura_id: data.factura_id
                        })
                    });
                } catch (error) {
                    console.error('Error registrando movimiento en caja:', error);
                    notyf.error('Movimiento no registrado en caja. Contacte soporte');
                }
            }
            
            closeModal(document.getElementById('payment-modal'));
            closeModal(document.getElementById('card-validation-modal'));
            closeModal(document.getElementById('transfer-modal'));
            closeModal(document.getElementById('credit-modal'));
            
            const esCompra = currentClient.type === 'proveedor';
            const esCredito = currentPaymentMethod === 'credito';
            
            if (esCompra || esCredito) {
                Swal.fire({
                    title: '¿Descargar factura?',
                    text: '¿Desea descargar la factura en PDF?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, descargar',
                    cancelButtonText: 'No, gracias',
                    customClass: {
                        popup: 'swal-popup-custom',
                        confirmButton: 'btn btn-primary',
                        cancelButton: 'btn btn-secondary'
                    },
                    buttonsStyling: false,
                    allowOutsideClick: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        descargarFacturaPDF(data.factura_id);
                    }
                    setTimeout(() => resetSystem(), 1000);
                });
            } else {
                setTimeout(() => resetSystem(), 1000);
            }
        } else {
            notyf.error(data.error || 'Error al generar factura');
            resetInvoiceButton();
        }
    } catch (error) {
        notyf.error('Error de conexión con el servidor');
        console.error(error);
        resetInvoiceButton();
        
        if (currentPaymentMethod === 'credito') {
            resetCreditButton();
        }
    } finally {
        if (currentPaymentMethod === 'tarjeta') {
            closeModal(document.getElementById('card-validation-modal'));
        }
        
        if (currentPaymentMethod === 'credito') {
            resetCreditButton();
        }
    }
}

async function verificarEstadoCaja() {
    try {
        const response = await fetch('/facturacion/api/caja/estado-actual');
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        
        const data = await response.json();
        
        if (data && data.success && data.data) {
            return data.data.open;
        } else {
            notyf.error('Respuesta inesperada del servidor');
            return false;
        }
    } catch (error) {
        notyf.error('Error al verificar estado de caja');
        console.error('Error en verificarEstadoCaja:', error);
        return false;
    }
}

function resetSystem() {
    cart = [];
    lastProductAdded = null;
    globalDiscount = { amount: 0, type: 'fixed' };
    
    const amountReceived = document.getElementById('amount-received');
    const discountInput = document.getElementById('discount-amount');
    const discountType = document.getElementById('discount-type');
    
    if (amountReceived) amountReceived.value = '';
    if (discountInput) discountInput.value = '';
    if (discountType) discountType.value = 'fixed';
    
    selectPaymentMethod('efectivo');
    updateCart();

    currentClient = { id: 'cf', name: 'Consumidor Final', rnc: '000-000000-0', type: 'cliente' };
    updateClientUI();

    window.location.reload();
}

function resetInvoiceButton() {
    const invoiceBtn = document.getElementById('invoice-btn');
    if (invoiceBtn) {
        invoiceBtn.innerHTML = '<i class="fas fa-file-invoice"></i> Facturar y Pagar';
        invoiceBtn.disabled = false;
    }
    resetConfirmButton();
}

function resetConfirmButton() {
    const confirmPayment = document.getElementById('confirm-payment');
    if (confirmPayment) {
        confirmPayment.disabled = false;
        confirmPayment.classList.remove('processing');
        confirmPayment.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pago';
    }
}

function resetCreditButton() {
    const confirmCredit = document.getElementById('confirm-credit');
    if (confirmCredit) {
        confirmCredit.disabled = false;
        confirmCredit.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Crédito';
    }
}

// ========== FUNCIONES DE INTERFAZ DE PRODUCTOS ==========
function loadProductSuggestions(products) {
    const searchSuggestions = document.getElementById('search-suggestions');
    if (!searchSuggestions) return;
    
    searchSuggestions.innerHTML = '';
    
    if (products && products.length > 0) {
        products.forEach(product => {
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion-item';
            suggestion.innerHTML = `
                <div class="suggestion-icon"><i class="fas fa-box"></i></div>
                <div class="suggestion-text">${product.name} (${product.id})</div>
                <div class="suggestion-price">RD$ ${formatNumber(product.price)}</div>
            `;
            suggestion.addEventListener('click', () => {
                addToCart(product);
                const productSearch = document.getElementById('product-search');
                if (productSearch) productSearch.value = '';
                searchSuggestions.classList.add('hidden');
            });
            searchSuggestions.appendChild(suggestion);
        });
        searchSuggestions.classList.remove('hidden');
    } else {
        searchSuggestions.classList.add('hidden');
    }
}

function loadProductsForModal(products) {
    const productsList = document.getElementById('products-list');
    if (!productsList) return;
    
    productsList.innerHTML = '';
    
    if (products && products.length > 0) {
        products.forEach(product => {
            const row = document.createElement('tr');
            row.dataset.id = product.id;
            
            let stock = 0;
            if (typeof product.stock === 'number') {
                stock = product.stock;
            } else if (product.stock !== undefined && product.stock !== null) {
                stock = parseInt(product.stock) || 0;
            }
            
            let stockClass = 'stock-ok';
            let stockText = stock.toString();
            
            if (stock === 0) {
                stockClass = 'stock-zero';
                stockText = 'Agotado';
            } else if (stock <= 5) {
                stockClass = 'stock-low';
                stockText = `${stock} (Bajo)`;
            }
            
            const productName = product.name ? product.name.trim() : 'Sin nombre';
            const categoria = product.categoria || 'Sin categoría';
            const price = product.price || 0;
            
            row.innerHTML = `
                <td>
                    <div class="product-name">${productName}</div>
                    ${product.itbis ? '<div class="itbis-badge">ITBIS</div>' : ''}
                </td>
                <td>
                    <div class="categoria-badge">${categoria}</div>
                </td>
                <td class="text-right">RD$ ${formatNumber(price)}</td>
                <td class="text-center"><span class="stock-badge ${stockClass}">${stockText}</span></td>
            `;
            
            productsList.appendChild(row);
        });
        
        document.querySelectorAll('#products-list tr').forEach(row => {
            row.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const product = products.find(p => p.id === id);
                if (product) {
                    addToCart(product);
                    closeModal(document.getElementById('products-modal'));
                }
            });
        });
    } else {
        productsList.innerHTML = '<tr><td colspan="4" class="text-center">No se encontraron productos</td></tr>';
    }
}

async function performModalSearch() {
    const modalProductSearch = document.getElementById('modal-product-search');
    const term = modalProductSearch ? modalProductSearch.value.trim() : '';
    
    try {
        const products = await searchProducts(term);
        loadProductsForModal(products);
    } catch (error) {
        console.error('Error en búsqueda:', error);
    }
}

// ========== FUNCIONES DE PDF ==========
function descargarFacturaPDF(factura_id) {
    fetch(`/facturacion/api/facturas/${factura_id}/pdf`)
        .then(response => {
            if (response.status === 404) {
                Swal.fire('Error', 'Factura no encontrada', 'error');
                return null;
            }
            if (!response.ok) throw new Error('Error al descargar PDF');
            return response.blob();
        })
        .then(blob => {
            if (!blob) return;
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `factura_${factura_id}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                a.remove();
                window.URL.revokeObjectURL(url);
            }, 100);
        })
        .catch(error => {
            Swal.fire('Error', 'Error al descargar el PDF: ' + error.message, 'error');
        });
}

// ========== MANEJO DE ERRORES GLOBALES ==========
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
    if (!e.error || !e.error.message || !e.error.message.includes('notyf.info')) {
        notyf.error('Ha ocurrido un error inesperado');
    }
});

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const minDate = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0];
    const dueDate = document.getElementById('due-date');
    if (dueDate) dueDate.min = minDate;

    selectPaymentMethod('efectivo');
    updateCart();
    updateClientUI();

    setupKeyboardActions();
    setupAlwaysOnScanner(); // Escáner siempre activo
    setupManualScanner();   // Escáner manual por botón

    // Elementos del DOM
    const productSearch = document.getElementById('product-search');
    const searchBtn = document.getElementById('search-btn');
    const clientInfo = document.getElementById('client-info');
    const closeClientModal = document.getElementById('close-client-modal');
    const closeProductsModal = document.getElementById('close-products-modal');
    const tabBtns = document.querySelectorAll('.tab');
    const clientSearchBtn = document.getElementById('client-search-btn');
    const modalProductSearch = document.getElementById('modal-product-search');
    const modalSearchBtn = document.getElementById('modal-search-btn');
    const paymentMethods = document.querySelectorAll('.payment-method');
    const amountReceived = document.getElementById('amount-received');
    const invoiceBtn = document.getElementById('invoice-btn');
    const confirmPayment = document.getElementById('confirm-payment');
    const cancelPayment = document.getElementById('cancel-payment');
    const confirmTransfer = document.getElementById('confirm-transfer');
    const confirmCredit = document.getElementById('confirm-credit');
    const cancelCredit1 = document.getElementById('cancel-credit');
    const cancelCredit2 = document.getElementById('cancel-credit-2');
    const applyDiscountBtn = document.getElementById('apply-discount');
    const discountInput = document.getElementById('discount-amount');

    // Configuración de event listeners
    if (productSearch) {
        productSearch.addEventListener('input', async () => {
            const term = productSearch.value.trim();
            if (term.length > 1) {
                const products = await searchProducts(term);
                loadProductSuggestions(products);
            } else {
                const searchSuggestions = document.getElementById('search-suggestions');
                if (searchSuggestions) searchSuggestions.classList.add('hidden');
            }
        });
        
        productSearch.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const term = productSearch.value.trim();
                openModal(document.getElementById('products-modal'));
                const products = await searchProducts(term);
                loadProductsForModal(products);
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            openModal(document.getElementById('products-modal'));
            const products = await searchProducts('');
            loadProductsForModal(products);
        });
    }

    // Event listener para cerrar modal de productos
    if (closeProductsModal) {
        closeProductsModal.addEventListener('click', () => {
            closeModal(document.getElementById('products-modal'));
        });
    }

    // Event listener para aplicar descuento
    if (applyDiscountBtn) {
        applyDiscountBtn.addEventListener('click', applyDiscount);
    }

    // Event listener para Enter en input de descuento
    if (discountInput) {
        discountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyDiscount();
            }
        });
    }

    if (paymentMethods) {
        paymentMethods.forEach(m => {
            m.addEventListener('click', () => {
                selectPaymentMethod(m.dataset.method);
                validateInvoiceButton();
            });
        });
    }

    if (amountReceived) {
        amountReceived.addEventListener('input', () => {
            if (currentPaymentMethod === 'efectivo') {
                const total = parseFormattedNumber(document.getElementById('total').textContent);
                const rec = parseFormattedNumber(amountReceived.value) || 0;
                document.getElementById('change-amount').textContent = `RD$ ${formatNumber(rec - total >= 0 ? rec - total : 0)}`;
            }
            validateInvoiceButton();
        });
        
        amountReceived.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !invoiceBtn.disabled && currentPaymentMethod === 'efectivo') {
                openPaymentModal();
            }
        });
    }

    if (invoiceBtn) {
        invoiceBtn.addEventListener('click', () => {
            switch (currentPaymentMethod) {
                case 'efectivo': 
                    if (!invoiceBtn.disabled) openPaymentModal(); 
                    break;
                case 'tarjeta': 
                    openCardValidationModal(); 
                    break;
                case 'transferencia': 
                    openTransferModal(); 
                    break;
                case 'credito': 
                    openCreditModal(); 
                    break;
            }
        });
    }

    if (confirmPayment) {
        confirmPayment.addEventListener('click', function() {
            this.disabled = true;
            this.classList.add('processing');
            this.innerHTML = '<i class="fas fa-spinner"></i> Procesando...';
            generateInvoice();
        });
    }

    if (cancelPayment) {
        cancelPayment.addEventListener('click', () => {
            closeModal(document.getElementById('payment-modal'));
            resetConfirmButton();
        });
    }

    if (clientInfo) {
        clientInfo.addEventListener('click', () => {
            openModal(document.getElementById('client-modal'));
            loadPersonas('cliente', 'clients-list');
        });
    }

    if (closeClientModal) {
        closeClientModal.addEventListener('click', () => closeModal(document.getElementById('client-modal')));
    }

    if (tabBtns) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('tab-active'));
                btn.classList.add('tab-active');
                
                document.querySelectorAll('.tab-content').forEach(p => p.classList.add('hidden'));
                document.getElementById(`${btn.dataset.tab}-tab`).classList.remove('hidden');
                
                if (btn.dataset.tab === 'clients') {
                    loadPersonas('cliente', 'clients-list');
                } else {
                    loadPersonas('proveedor', 'suppliers-list');
                }
            });
        });
    }

    if (clientSearchBtn) {
        clientSearchBtn.addEventListener('click', () => {
            const clientSearch = document.getElementById('client-search');
            const activeTab = document.querySelector('.tab-active');
            if (clientSearch && activeTab) {
                const term = clientSearch.value.trim();
                const type = activeTab.dataset.tab === 'clients' ? 'cliente' : 'proveedor';
                loadPersonas(type, `${activeTab.dataset.tab}-list`, term);
            }
        });
    }

    if (modalProductSearch) {
        // Búsqueda en tiempo real con debounce
        modalProductSearch.addEventListener('input', async () => {
            const term = modalProductSearch.value.trim();
            clearTimeout(window.modalSearchTimeout);
            window.modalSearchTimeout = setTimeout(async () => {
                await performModalSearch();
            }, 300);
        });
        
        // Agregar event listener para Enter
        modalProductSearch.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await performModalSearch();
            }
        });
    }

    if (modalSearchBtn) {
        modalSearchBtn.addEventListener('click', async () => {
            await performModalSearch();
        });
    }

    // Eventos para crédito
    if (confirmCredit) {
        confirmCredit.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            generateInvoice();
        });
    }

    // Botones de cancelar en el modal de crédito
    [cancelCredit1, cancelCredit2].forEach(btn => {
        if (btn) btn.addEventListener('click', () => {
            closeModal(document.getElementById('credit-modal'));
            resetCreditButton();
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
                if (modal.id === 'payment-modal') resetConfirmButton();
                if (modal.id === 'credit-modal') resetCreditButton();
            }
        });
    });
});