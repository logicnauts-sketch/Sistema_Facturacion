(function() {
    // Variables globales
    let currentCategory = null;
    let currentSearchTerm = '';

    // DOM Elements
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const tabFilters = document.querySelectorAll('.tab-filter');
    const productForm = document.getElementById('product-form');
    const openAddProductModalBtn = document.getElementById('openAddProductModal');
    const addProductModal = document.getElementById('addProductModal');
    const closeModalBtn = document.querySelector('.close');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const cancelButton = document.getElementById('cancel-form');
    const openAddCategoryModalBtn = document.getElementById('openAddCategoryModal');
    const addCategoryModal = document.getElementById('addCategoryModal');
    const closeCategoryModalBtn = document.getElementById('closeCategoryModal');
    const categoryNameInput = document.getElementById('category-name');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const categoryError = document.getElementById('category-error');

    // Initialize Notyf for notifications
    const notyf = new Notyf({
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
            },
            {
                type: 'warning',
                background: '#ffd166',
                icon: {
                    className: 'fas fa-exclamation',
                    tagName: 'i',
                    color: '#fff'
                }
            }
        ]
    });

    // Función para calcular el precio de venta
    function calcularPrecioVenta() {
        const purchaseEl = document.getElementById('product-purchase-price');
        const percentEl = document.getElementById('product-sale-percentage');
        if (!purchaseEl || !percentEl) return;

        const precioCompra = parseFloat(purchaseEl.value.replace(/,/g, '.')) || 0;
        const porcentajeGanancia = parseFloat(percentEl.value.replace(/,/g, '.')) || 0;

        const taxSelect = document.getElementById('product-tax');
        let taxPercentage = 0;
        if (taxSelect) {
            const taxOption = taxSelect.value;
            if (taxOption === '18') {
                taxPercentage = 18;
            } else if (taxOption === 'personalizado') {
                const customTax = document.getElementById('product-custom-tax');
                taxPercentage = customTax ? parseFloat(customTax.value.replace(/,/g, '.')) || 0 : 0;
            }
        }

        const precioConMargen = precioCompra * (1 + (porcentajeGanancia / 100));
        const precioVenta = precioConMargen * (1 + (taxPercentage / 100));
        const salePriceEl = document.getElementById('product-sale-price');
        if (salePriceEl) salePriceEl.value = precioVenta.toFixed(2);
    }

    // ============================================
    // MANEJADORES DE EVENTOS
    // ============================================

    // Mobile menu toggle
    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.style.display = 'block';
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.style.display = 'none';
        });
    }

    // Navigation between sections
    if (navLinks && sections) {
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                navLinks.forEach(item => item.classList.remove('active'));
                link.classList.add('active');
                
                const targetSection = link.getAttribute('data-section');
                
                sections.forEach(section => section.classList.remove('active'));
                
                if (targetSection) {
                    document.getElementById(targetSection).classList.add('active');
                }
                
                if (window.innerWidth < 992) {
                    if (sidebar) sidebar.classList.remove('active');
                    if (overlay) overlay.style.display = 'none';
                }
            });
        });
    }

    // Tab filters
    if (tabFilters) {
        tabFilters.forEach(tab => {
            tab.addEventListener('click', () => {
                tabFilters.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentCategory = tab.dataset.category === 'Todos' ? null : tab.dataset.category;
                // La búsqueda por categoría ahora se hará en el servidor
                // Por lo que recargamos la página con el filtro aplicado
                const url = new URL(window.location.href);
                if (currentCategory) {
                    url.searchParams.set('categoria', currentCategory);
                } else {
                    url.searchParams.delete('categoria');
                }
                window.location.href = url.toString();
            });
        });
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentSearchTerm = this.value.trim().toLowerCase();
        });
        
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                currentSearchTerm = searchInput.value.trim().toLowerCase();
                // La búsqueda ahora se hará en el servidor
                // Por lo que recargamos la página con el término de búsqueda
                const url = new URL(window.location.href);
                if (currentSearchTerm) {
                    url.searchParams.set('buscar', currentSearchTerm);
                } else {
                    url.searchParams.delete('buscar');
                }
                window.location.href = url.toString();
            });
        }
    }

    // Modal functions
    if (openAddProductModalBtn && addProductModal && closeModalBtn) {
        openAddProductModalBtn.addEventListener('click', async () => {
            if (productForm) {
                productForm.reset();
                productForm.dataset.mode = 'add';
                productForm.dataset.productId = '';
                document.querySelector('.modal-title').textContent = 'Registrar Nuevo Producto';
                
                // Obtener próximo código del backend
                try {
                    const response = await fetch('/api/productos/proximo-codigo');
                    if (response.ok) {
                        const data = await response.json();
                        document.getElementById('product-code').value = data.proximo_codigo;
                    } else {
                        throw new Error('Error al obtener el código');
                    }
                } catch (error) {
                    notyf.error(error.message);
                    // Generar código de respaldo
                    const codigos = Array.from(document.querySelectorAll('#products-table-body tr td:first-child'))
                        .map(td => td.textContent)
                        .filter(c => c && c.startsWith('PRD-'));
                    
                    let maxNum = 0;
                    codigos.forEach(codigo => {
                        const parts = codigo.split('-');
                        if (parts.length > 1) {
                            const num = parseInt(parts[1]);
                            if (!isNaN(num) && num > maxNum) maxNum = num;
                        }
                    });
                    
                    document.getElementById('product-code').value = `PRD-${(maxNum + 1).toString().padStart(3, '0')}`;
                }
                
                // Reiniciar porcentaje y precio de venta
                document.getElementById('product-sale-percentage').value = '';
                document.getElementById('product-sale-price').value = '';

                // Ocultar campo de impuesto personalizado
                document.getElementById('custom-tax-container').style.display = 'none';
                // Resetear selector de impuestos
                document.getElementById('product-tax').value = '0';
            }
            addProductModal.style.display = 'flex';
        });

        closeModalBtn.addEventListener('click', () => {
            addProductModal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === addProductModal) {
                addProductModal.style.display = 'none';
            }
        });
    }

    // Cancel button in modal
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            if (productForm) productForm.reset();
            if (addProductModal) addProductModal.style.display = 'none';
        });
    }

    // Eventos para calcular precio de venta automático
    if (document.getElementById('product-purchase-price') && document.getElementById('product-sale-percentage')) {
        document.getElementById('product-purchase-price').addEventListener('input', calcularPrecioVenta);
        document.getElementById('product-sale-percentage').addEventListener('input', calcularPrecioVenta);
    }

    // Evento para el selector de impuestos
    if (document.getElementById('product-tax')) {
        document.getElementById('product-tax').addEventListener('change', function() {
            const customTaxContainer = document.getElementById('custom-tax-container');
            if (this.value === 'personalizado') {
                customTaxContainer.style.display = 'block';
            } else {
                customTaxContainer.style.display = 'none';
            }
            calcularPrecioVenta();
        });
    }

    // Evento para el campo de impuesto personalizado
    if (document.getElementById('product-custom-tax')) {
        document.getElementById('product-custom-tax').addEventListener('input', calcularPrecioVenta);
    }

    // Form submission
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(productForm);
            const data = Object.fromEntries(formData.entries());
            const mode = productForm.dataset.mode || 'add';
            const productId = productForm.dataset.productId || '';
            
            // Obtener el valor del impuesto
            let taxPercentage = 0;
            const taxSelect = document.getElementById('product-tax');
            if (taxSelect) {
                if (taxSelect.value === '18') {
                    taxPercentage = 18;
                } else if (taxSelect.value === 'personalizado') {
                    const customTax = document.getElementById('product-custom-tax');
                    const taxValue = customTax ? customTax.value.replace(',', '.') : '0';
                    taxPercentage = parseFloat(taxValue) || 0;
                }
            }
            
            // Validar campos numéricos
            const initialQuantity = parseInt(data.initial_quantity) || 0;
            const minStock = parseInt(data.min_stock) || 0;
            const maxStock = parseInt(data.max_stock) || 0;
            
            // Validar stock mínimo y máximo
            if (minStock > maxStock) {
                await Swal.fire({
                    title: 'Error de validación',
                    text: 'El stock mínimo no puede ser mayor que el stock máximo',
                    icon: 'error',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }
            
            // Preparar datos para enviar al backend
            const productData = {
                code: data.code,
                name: data.name,
                description: data.description || '',
                category: data.category,
                purchase_price: parseFloat(data.purchase_price) || 0,
                sale_price: parseFloat(data.sale_price) || 0,
                initial_quantity: initialQuantity,
                min_stock: minStock,
                max_stock: maxStock,
                tax_percentage: taxPercentage
            };
            
            try {
                let response;
                let endpoint = '/api/productos';
                let method = 'POST';
                
                if (mode === 'edit') {
                    endpoint = `/api/productos/${productId}`;
                    method = 'PUT';
                }
                
                response = await fetch(endpoint, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(productData)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    await Swal.fire({
                        title: '¡Éxito!',
                        text: result.message || `Producto ${mode === 'add' ? 'creado' : 'actualizado'} exitosamente`,
                        icon: 'success',
                        confirmButtonText: 'Aceptar'
                    });

                    // Recargar la página para actualizar los datos
                    location.reload();
                } else {
                    const error = await response.json();
                    await Swal.fire({
                        title: 'Error',
                        text: error.error || 'Error al guardar el producto',
                        icon: 'error',
                        confirmButtonText: 'Aceptar'
                    });
                }
            } catch (error) {
                await Swal.fire({
                    title: 'Error de conexión',
                    text: error.message,
                    icon: 'error',
                    confirmButtonText: 'Aceptar'
                });
                console.error('Submit product error:', error);
            }
        });
    }

    // Evento para agregar categoría
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', async () => {
            const name = categoryNameInput.value.trim();
            
            if (!name) {
                categoryError.style.display = 'block';
                return;
            }
            
            categoryError.style.display = 'none';
            
            try {
                // Ruta corregida: /productos/api/categorias
                const response = await fetch('api/categorias', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ nombre: name })
                });
                
                if (response.ok) {
                    notyf.success('Categoría agregada correctamente');
                    location.reload();
                } else {
                    const error = await response.json();
                    notyf.error(error.error || 'Error al agregar la categoría');
                }
            } catch (error) {
                notyf.error('Error de conexión: ' + error.message);
            }
        });
    }

    // Abrir modal de categorías
    if (openAddCategoryModalBtn && addCategoryModal) {
        openAddCategoryModalBtn.addEventListener('click', () => {
            addCategoryModal.style.display = 'flex';
        });
    }

    // Cerrar modal de categorías
    if (closeCategoryModalBtn) {
        closeCategoryModalBtn.addEventListener('click', () => {
            addCategoryModal.style.display = 'none';
        });
    }

    // Cerrar al hacer clic fuera del modal
    window.addEventListener('click', (event) => {
        if (event.target === addCategoryModal) {
            addCategoryModal.style.display = 'none';
        }
    });

    // Eventos para editar y eliminar productos
    document.querySelectorAll('.action-btn.edit').forEach(btn => {
        btn.addEventListener('click', async () => {
            const productId = btn.dataset.id;
            
            try {
                const response = await fetch(`/api/productos/${productId}`);
                if (!response.ok) {
                    throw new Error('Producto no encontrado');
                }
                
                const product = await response.json();
                
                // Llenar el formulario
                document.getElementById('product-code').value = product.codigo || '';
                document.getElementById('product-name').value = product.nombre || '';
                document.getElementById('product-description').value = product.descripcion || '';
                document.getElementById('product-category').value = product.categoria || '';
                document.getElementById('product-purchase-price').value = parseFloat(product.precio_compra) || 0;
                document.getElementById('product-sale-price').value = parseFloat(product.precio_venta) || 0;
                document.getElementById('product-initial-quantity').value = parseInt(product.stock_actual) || 0;
                document.getElementById('product-min-stock').value = parseInt(product.stock_minimo) || 0;
                document.getElementById('product-max-stock').value = parseInt(product.stock_maximo) || 0;

                // Configurar impuestos
                const taxSelect = document.getElementById('product-tax');
                const customTaxContainer = document.getElementById('custom-tax-container');
                const customTaxInput = document.getElementById('product-custom-tax');

                if (product.impuesto === 18) {
                    taxSelect.value = '18';
                    customTaxContainer.style.display = 'none';
                } else if (product.impuesto > 0) {
                    taxSelect.value = 'personalizado';
                    customTaxContainer.style.display = 'block';
                    customTaxInput.value = product.impuesto;
                } else {
                    taxSelect.value = '0';
                    customTaxContainer.style.display = 'none';
                }

                // Modo edición
                productForm.dataset.mode = 'edit';
                productForm.dataset.productId = product.id;
                document.querySelector('.modal-title').textContent = 'Editar Producto';
                addProductModal.style.display = 'flex';
                calcularPrecioVenta();
                
            } catch (error) {
                notyf.error('Error al cargar el producto: ' + error.message);
            }
        });
    });

    // Eventos para eliminar productos
    document.querySelectorAll('.action-btn.delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const productId = btn.dataset.id;
            
            // Mostrar confirmación con SweetAlert
            const result = await Swal.fire({
                title: '¿Eliminar producto?',
                text: "¡Esta acción no se puede deshacer!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });
            
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/api/productos/${productId}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        // Mostrar confirmación con SweetAlert
                        await Swal.fire({
                            title: '¡Eliminado!',
                            text: 'El producto ha sido eliminado correctamente.',
                            icon: 'success',
                            confirmButtonText: 'Aceptar'
                        });
                        
                        // Recargar la página para actualizar
                        location.reload();
                    } else {
                        const error = await response.json();
                        await Swal.fire({
                            title: 'Error',
                            text: error.error || 'Error al eliminar el producto',
                            icon: 'error',
                            confirmButtonText: 'Aceptar'
                        });
                    }
                } catch (error) {
                    await Swal.fire({
                        title: 'Error de conexión',
                        text: error.message,
                        icon: 'error',
                        confirmButtonText: 'Aceptar'
                    });
                }
            }
        });
    });

    // Eventos para gestión de categorías
    document.querySelectorAll('.edit-category').forEach(btn => {
        btn.addEventListener('click', function() {
            const categoryId = this.dataset.id;
            const categoryItem = this.closest('.category-item');
            const categoryName = categoryItem.querySelector('.category-name').textContent;
            
            // Convertir a modo edición
            categoryItem.innerHTML = `
                <input type="text" class="form-control" value="${categoryName}" 
                    id="edit-category-${categoryId}">
                <div class="category-actions">
                    <button class="btn btn-sm btn-success save-category" data-id="${categoryId}">
                        <i class="fas fa-save"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary cancel-edit" data-id="${categoryId}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            // Enfocar el input
            document.getElementById(`edit-category-${categoryId}`).focus();
        });
    });

    // Eventos para eliminar categorías
    document.querySelectorAll('.delete-category').forEach(btn => {
        btn.addEventListener('click', async function() {
            const categoryId = this.dataset.id;
            const categoryName = this.closest('.category-item').querySelector('.category-name').textContent;
            
            const result = await Swal.fire({
                title: '¿Eliminar categoría?',
                html: `¿Estás seguro de eliminar la categoría <b>${categoryName}</b>?<br>
                       Esta acción no se puede deshacer.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });
            
            if (result.isConfirmed) {
                try {
                    // Ruta corregida: /productos/api/categorias
                    const response = await fetch(`api/categorias/${categoryId}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        notyf.success('Categoría eliminada correctamente');
                        location.reload();
                    } else {
                        const error = await response.json();
                        notyf.error(error.error || 'Error al eliminar la categoría');
                    }
                } catch (error) {
                    notyf.error('Error de conexión: ' + error.message);
                }
            }
        });
    });

    // Eventos para guardar y cancelar edición de categorías
    document.addEventListener('click', async function(e) {
        if (e.target.closest('.save-category')) {
            const btn = e.target.closest('.save-category');
            const categoryId = btn.dataset.id;
            const input = document.getElementById(`edit-category-${categoryId}`);
            const newName = input.value.trim();
            
            if (!newName) {
                notyf.error('El nombre de la categoría no puede estar vacío');
                return;
            }
            
            try {
                const response = await fetch(`/api/categorias/${categoryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ nombre: newName })
                });
                
                if (response.ok) {
                    notyf.success('Categoría actualizada correctamente');
                    location.reload();
                } else {
                    const error = await response.json();
                    notyf.error(error.error || 'Error al actualizar la categoría');
                }
            } catch (error) {
                notyf.error('Error de conexión: ' + error.message);
            }
        }
        
        // Cancelar edición
        if (e.target.closest('.cancel-edit')) {
            location.reload();
        }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && document.getElementById('addProductModal').style.display === 'flex') {
            document.getElementById('addProductModal').style.display = 'none';
        }
        if (event.key === 'Escape' && document.getElementById('addCategoryModal').style.display === 'flex') {
            document.getElementById('addCategoryModal').style.display = 'none';
        }
    });
})();

