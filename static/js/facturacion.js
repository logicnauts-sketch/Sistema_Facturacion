// Variables globales y configuración inicial
let cart = [];
let currentPaymentMethod = 'efectivo';
let currentClient = { id: 'cf', name: 'Consumidor Final', rnc: '000-000000-0', type: 'cliente' };
const ITBIS_RATE = 0.18;

const notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    types: [{ type: 'error', background: '#ef476f' }]
});

// Funciones básicas de utilidad
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
    return parseFloat(str.replace(/[^\d.]/g, ''));
}

function calculateItbis(price) {
    const base = price / (1 + ITBIS_RATE);
    return price - base;
}

// Funciones de gestión de datos
async function searchProducts(term) {
    try {
        const response = await fetch(`/api/productos?q=${encodeURIComponent(term)}`);
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        const data = await response.json();
        return data.map(product => ({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            itbis: Boolean(product.itbis)
        }));
    } catch (error) {
        notyf.error('Error al buscar productos');
        console.error('Error en searchProducts:', error);
        return [];
    }
}

async function loadPersonas(tipo, containerId) {
    try {
        const response = await fetch(`/api/personas?tipo=${tipo}`);
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        const data = await response.json();
        renderPersonas(data, containerId);
    } catch (error) {
        notyf.error('Error al cargar registros');
        console.error('Error en loadPersonas:', error);
    }
}

// Funciones de renderizado UI
function renderPersonas(personas, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';

    if (personas.length > 0) {
        personas.forEach(persona => {
            const item = document.createElement('div');
            item.className = 'client-card';
            if (persona.id === currentClient.id) item.classList.add('active');
            
            const iconType = (persona.id === 'cf') ? 'user' : 
                            (persona.type.toLowerCase() === 'cliente' ? 'user' : 'truck');
            
            item.innerHTML = `
                <div class="client-card-content">
                    <div class="client-avatar"><i class="fas fa-${iconType}"></i></div>
                    <div class="client-details">
                        <h4>${persona.name}</h4>
                        <p>${persona.type === 'Proveedor' ? 'RNC' : 'Cédula'}: ${persona.rnc}</p>
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                currentClient = {
                    id: persona.id,
                    name: persona.name,
                    rnc: persona.rnc,
                    type: persona.type.toLowerCase()
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

// Funciones de gestión del carrito
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            itbis: product.itbis,
            quantity: 1
        });
    }
    updateCart();
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
    } else {
        cartTableContainer.classList.remove('hidden');
        emptyCart.classList.add('hidden');
        cartItems.innerHTML = '';
        
        cart.forEach(item => {
            let itbisAmount = 0;
            if (item.itbis) itbisAmount = calculateItbis(item.price) * item.quantity;
            
            const lineTotal = item.price * item.quantity;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="number" min="1" value="${item.quantity}" class="quantity-input" data-id="${item.id}"></td>
                <td><div class="font-medium">${item.name}</div></td>
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
    cart = cart.filter(item => item.id !== id);
    updateCart();
    notyf.error('Producto eliminado');
}

function updateSummary() {
    const subtotalEl = document.getElementById('subtotal');
    const itbisTotalEl = document.getElementById('itbis-total');
    const totalEl = document.getElementById('total');
    const changeAmount = document.getElementById('change-amount');
    const invoiceBtn = document.getElementById('invoice-btn');
    
    if (!subtotalEl || !itbisTotalEl || !totalEl || !changeAmount || !invoiceBtn) return;
    
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
    
    const total = subtotal + itbisTotal;
    
    subtotalEl.textContent = `RD$ ${formatNumber(subtotal)}`;
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

// Funciones de gestión de pagos
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
    
    openModal(document.getElementById('credit-modal'));
}

// Funciones para descargar PDF
function descargarFacturaPDF(factura_id) {
    fetch(`/api/facturas/${factura_id}/pdf`)
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

// Funciones de facturación y reset
async function generateInvoice() {
    const subtotalEl = document.getElementById('subtotal');
    const itbisTotalEl = document.getElementById('itbis-total');
    const invoiceBtn = document.getElementById('invoice-btn');
    const dueDate = document.getElementById('due-date');

    // Verificar estado de caja con la función corregida
    const cajaAbierta = await verificarEstadoCaja();
    if (!cajaAbierta) {
        notyf.error('No se puede facturar: Caja cerrada');
        closeModal(document.getElementById('payment-modal'));
        closeModal(document.getElementById('card-validation-modal'));
        closeModal(document.getElementById('transfer-modal'));
        closeModal(document.getElementById('credit-modal'));
        return;
    }
    
    if (!subtotalEl || !itbisTotalEl || !invoiceBtn) return;
    
    const subtotal = parseFormattedNumber(subtotalEl.textContent);
    const itbis = parseFormattedNumber(itbisTotalEl.textContent);
    const total = subtotal + itbis;
    
    const facturaData = {
        cliente_id: currentClient.id,
        total: total,
        itbis_total: itbis,
        metodo_pago: currentPaymentMethod,
        detalles: cart.map(item => ({
            producto_id: item.id,
            cantidad: item.quantity,
            precio: item.price,
            itbis: item.itbis
        })),
        es_proveedor: currentClient.type === 'proveedor'
    };

    if (currentPaymentMethod === 'credito' && dueDate) {
        facturaData.fecha_vencimiento = dueDate.value;
    }

    invoiceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    invoiceBtn.disabled = true;

    try {
        const response = await fetch('/api/facturas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(facturaData)
        });

        const data = await response.json();
        
        if (data.success) {
            // Registrar movimiento en caja
            const tipo = currentClient.type === 'proveedor' ? 'gasto' : 'venta';
            const descripcion = `Factura #${data.factura_id} - ${currentClient.name}`;
            
            try {
                await fetch('/api/caja/movimientos', {
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
            
            // Cerrar modales
            closeModal(document.getElementById('payment-modal'));
            closeModal(document.getElementById('card-validation-modal'));
            closeModal(document.getElementById('transfer-modal'));
            closeModal(document.getElementById('credit-modal'));
            
            // Manejo de proveedores (descarga de PDF)
            if (currentClient.type === 'proveedor') {
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
                // Reset normal para clientes
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
    } finally {
        if (currentPaymentMethod === 'tarjeta') {
            closeModal(document.getElementById('card-validation-modal'));
        }
    }
}

async function verificarEstadoCaja() {
    try {
        const response = await fetch('/api/caja/estado-actual');
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        
        const data = await response.json();
        
        // Verificar si la respuesta tiene la estructura esperada
        if (data && data.success && data.data) {
            return data.data.open; // Acceder a la propiedad dentro de data.data
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
    const amountReceived = document.getElementById('amount-received');
    if (amountReceived) amountReceived.value = '';
    
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

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const minDate = new Date(today.setDate(today.getDate() + 1)).toISOString().split('T')[0];
    const dueDate = document.getElementById('due-date');
    if (dueDate) dueDate.min = minDate;

    selectPaymentMethod('efectivo');
    updateCart();
    updateClientUI();

    // Elementos del DOM
    const productSearch = document.getElementById('product-search');
    const searchBtn = document.getElementById('search-btn');
    const clientInfo = document.getElementById('client-info');
    const closeClientModal = document.getElementById('close-client-modal');
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
                case 'efectivo': if (!invoiceBtn.disabled) openPaymentModal(); break;
                case 'tarjeta': openCardValidationModal(); break;
                case 'transferencia': openTransferModal(); break;
                case 'credito': openCreditModal(); break;
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
        modalProductSearch.addEventListener('input', async () => {
            const term = modalProductSearch.value.trim();
            const products = await searchProducts(term);
            loadProductsForModal(products);
        });
    }

    if (modalSearchBtn) {
        modalSearchBtn.addEventListener('click', async () => {
            const term = modalProductSearch.value.trim();
            const products = await searchProducts(term);
            loadProductsForModal(products);
        });
    }

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
                if (modal.id === 'payment-modal') resetConfirmButton();
            }
        });
    });

    // Funciones auxiliares de UI
    function loadProductSuggestions(products) {
        const searchSuggestions = document.getElementById('search-suggestions');
        if (!searchSuggestions) return;
        
        searchSuggestions.innerHTML = '';
        
        if (products.length > 0) {
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
        
        if (products.length > 0) {
            products.forEach(product => {
                const row = document.createElement('tr');
                row.dataset.id = product.id;
                row.innerHTML = `
                    <td>${product.id}</td>
                    <td>${product.name}</td>
                    <td>RD$ ${formatNumber(product.price)}</td>
                    <td>${product.itbis ? 'Sí' : 'No'}</td>
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
});

