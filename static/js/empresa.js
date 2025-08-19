        // Referencias a elementos DOM
        const openModalBtn = document.getElementById('openModal');
        const closeModalBtn = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelChanges');
        const saveBtn = document.getElementById('saveChanges');
        const modal = document.getElementById('configModal');
        const tabBtns = document.querySelectorAll('.tab-btn');
        const logoInput = document.getElementById('logo');
        const logoPreview = document.getElementById('logoPreview');
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const companyName = document.getElementById('companyName');
        const companyLogo = document.getElementById('companyLogo');
        const logoIcon = document.getElementById('logoIcon');
        const companyLogoImg = document.getElementById('companyLogoImg');
        const companyLogoImg2 = document.getElementById('companyLogoImg2');
        const colorPrincipalInput = document.getElementById('color_principal');
        const empresaForm = document.getElementById('empresaForm');
        const openInvoicePreview = document.getElementById('openInvoicePreview');
        const closeInvoiceModal = document.getElementById('closeInvoiceModal');
        const closeInvoicePreview = document.getElementById('closeInvoicePreview');
        const invoicePreviewModal = document.getElementById('invoicePreviewModal');
        const invoiceTabs = document.querySelectorAll('.invoice-tab');

        // Variable global para los datos de la empresa
        let empresaData = {
            nombre: "",
            rnc: "",
            actividad_comercial: "",
            telefono: "",
            email: "",
            direccion: "",
            website: "",
            mensaje_legal: "",
            terminos: "",
            color_principal: "#4361ee",
            logo_path: ""
        };

        // Función para cargar datos de la empresa desde el servidor
        async function cargarDatosEmpresa() {
            try {
                const response = await fetch('/empresa/datos');
                if (!response.ok) {
                    throw new Error('Error al cargar datos de la empresa');
                }
                const data = await response.json();
                
                // Actualizar variable global
                empresaData = data;
                
                // Actualizar encabezado
                companyName.textContent = empresaData.nombre;
                companyLogo.style.background = empresaData.color_principal;
                
                // Actualizar logo si está disponible
                // En la función cargarDatosEmpresa()
                if (empresaData.logo_path) {
                companyLogoImg.src = empresaData.logo_path;
                companyLogoImg2.src = empresaData.logo_path;
                companyLogoImg.style.display = 'block';
                companyLogoImg2.style.display = 'block'; // Mostrar en factura
                logoIcon.style.display = 'none';
                } else {
                companyLogoImg.style.display = 'none';
                companyLogoImg2.style.display = 'none'; // Ocultar en factura
                logoIcon.style.display = 'flex';
}
                
                // Actualizar datos en la página principal
                document.getElementById('legalData').textContent = 
                    `${empresaData.nombre} - RNC: ${empresaData.rnc}`;
                    
                document.getElementById('contactData').textContent = 
                    `${empresaData.direccion} | Tel: ${empresaData.telefono}`;
                    
                document.getElementById('messagesData').textContent = 
                    empresaData.mensaje_legal;
                
                // Actualizar formulario con datos de la empresa
                document.getElementById('nombre').value = empresaData.nombre || '';
                document.getElementById('rnc').value = empresaData.rnc || '';
                document.getElementById('actividad_comercial').value = empresaData.actividad_comercial || '';
                document.getElementById('telefono').value = empresaData.telefono || '';
                document.getElementById('email').value = empresaData.email || '';
                document.getElementById('direccion').value = empresaData.direccion || '';
                document.getElementById('website').value = empresaData.website || '';
                document.getElementById('mensaje_legal').value = empresaData.mensaje_legal || '';
                document.getElementById('terminos').value = empresaData.terminos || '';
                document.getElementById('color_principal').value = empresaData.color_principal || '#4361ee';
                
                // Actualizar vista previa del logo en el modal
                if (empresaData.logo_path) {
                    logoPreview.src = empresaData.logo_path;
                } else {
                    logoPreview.src = '';
                }
                
                return empresaData;
            } catch (error) {
                console.error('Error cargando datos:', error);
                showToast('Error al cargar datos de la empresa', 'error');
                return null;
            }
        }

        // Función para actualizar la vista previa de facturas
        function actualizarVistaPreviaFacturas() {
            // Actualizar datos en factura A4
            document.getElementById('preview-company-name').textContent = empresaData.nombre;
            document.getElementById('preview-rnc').textContent = empresaData.rnc;
            document.getElementById('preview-address').textContent = empresaData.direccion;
            document.getElementById('preview-phone').textContent = empresaData.telefono;
            document.getElementById('preview-email').textContent = empresaData.email;
            document.getElementById('preview-legal-message').textContent = empresaData.mensaje_legal;
            
            // Actualizar datos en factura térmica
            document.getElementById('termica-company-name').textContent = empresaData.nombre;
            document.getElementById('termica-rnc').textContent = empresaData.rnc;
            document.getElementById('termica-legal-message').textContent = empresaData.mensaje_legal;
            document.getElementById('termica-legal-message').textContent = empresaData.mensaje_legal;// En actualizarVistaPreviaFacturas()
            document.getElementById('termicaCompanyLogo').src = empresaData.logo_path || '';
        }

        // Abrir modal de configuración
        openModalBtn.addEventListener('click', async () => {
            await cargarDatosEmpresa();
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });

        // Abrir modal de vista previa de facturas
        openInvoicePreview.addEventListener('click', () => {
            // Actualizar datos de factura con la información actual
            actualizarVistaPreviaFacturas();
            invoicePreviewModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });

        // Cerrar modal
        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        // Configurar botones de cierre
        closeModalBtn.addEventListener('click', () => closeModal('configModal'));
        cancelBtn.addEventListener('click', () => closeModal('configModal'));
        closeInvoiceModal.addEventListener('click', () => closeModal('invoicePreviewModal'));
        closeInvoicePreview.addEventListener('click', () => closeModal('invoicePreviewModal'));

        // Cerrar al hacer clic fuera del modal
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                closeModal(e.target.id);
            }
        });

        // Guardar cambios
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Validar formulario
            if (!empresaForm.checkValidity()) {
                empresaForm.reportValidity();
                return;
            }
            
            // Feedback visual: mostrar cargando
            const originalBtnText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            saveBtn.disabled = true;
            
            try {
                // Recoger datos del formulario
                const formData = new FormData();
                formData.append('nombre', document.getElementById('nombre').value);
                formData.append('rnc', document.getElementById('rnc').value);
                formData.append('actividad_comercial', document.getElementById('actividad_comercial').value);
                formData.append('telefono', document.getElementById('telefono').value);
                formData.append('email', document.getElementById('email').value);
                formData.append('direccion', document.getElementById('direccion').value);
                formData.append('website', document.getElementById('website').value);
                formData.append('mensaje_legal', document.getElementById('mensaje_legal').value);
                formData.append('terminos', document.getElementById('terminos').value);
                formData.append('color_principal', document.getElementById('color_principal').value);
                
                // Agregar el archivo de logo si se seleccionó uno
                if (logoInput.files[0]) {
                    formData.append('logo', logoInput.files[0]);
                }
                
                // Enviar datos al servidor
                const response = await fetch('/empresa/guardar', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al guardar los datos');
                }
                
                const result = await response.json();
                
                if (result.success) {
                    // Recargar datos después de guardar
                    await cargarDatosEmpresa();
                    
                    // Mostrar notificación
                    showToast(result.message || '¡Configuración guardada correctamente!', 'success');
                    
                    // Cerrar modal después de guardar
                    setTimeout(() => {
                        closeModal('configModal');
                    }, 1500);
                } else {
                    throw new Error(result.error || 'Error desconocido');
                }
            } catch (error) {
                console.error('Error al guardar:', error);
                showToast(error.message || 'Error al guardar la configuración', 'error');
            } finally {
                // Restaurar botón
                saveBtn.innerHTML = originalBtnText;
                saveBtn.disabled = false;
            }
        });

        // Manejar cambio de logo
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validar tamaño del archivo (máximo 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showToast('El archivo es demasiado grande (máximo 2MB)', 'error');
                    logoInput.value = ''; // Limpiar input
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    // Actualizar vista previa
                    logoPreview.src = event.target.result;
                    
                    // Feedback visual
                    logoPreview.parentElement.style.borderColor = '#4361ee';
                };
                reader.readAsDataURL(file);
            }
        });

        // Funcionalidad de pestañas
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remover clase active de todos los botones
                tabBtns.forEach(b => b.classList.remove('active'));
                
                // Ocultar todos los contenidos
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Activar la pestaña clickeada
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });

        // Funcionalidad de pestañas de facturas
        invoiceTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remover clase active de todos los botones
                invoiceTabs.forEach(t => t.classList.remove('active'));
                
                // Ocultar todos los contenidos
                document.querySelectorAll('.invoice-preview').forEach(preview => {
                    preview.classList.remove('active');
                });
                
                // Activar la pestaña clickeada
                tab.classList.add('active');
                const tabType = tab.getAttribute('data-type');
                document.getElementById(`${tabType}-invoice`).classList.add('active');
            });
        });

        // Cerrar con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal[style*="display: flex"]');
                openModals.forEach(modal => closeModal(modal.id));
            }
        });

        // Cambio de color principal
        colorPrincipalInput.addEventListener('change', (e) => {
            // Actualizar variable CSS
            document.documentElement.style.setProperty('--color-primary', e.target.value);
            
            // Actualizar gradientes
            const btns = document.querySelectorAll('.btn-open-modal, .btn-save');
            btns.forEach(btn => {
                btn.style.background = `linear-gradient(135deg, ${e.target.value}, #3f37c9)`;
            });
            
            // Actualizar logo en encabezado
            companyLogo.style.background = e.target.value;
        });

        // Mostrar notificación
        function showToast(message, type = 'success') {
            toastMessage.textContent = message;
            toast.className = `toast ${type} show`;
            
            // Actualizar icono según el tipo
            const icon = toast.querySelector('i');
            if (type === 'success') {
                icon.className = 'fas fa-check-circle';
            } else {
                icon.className = 'fas fa-exclamation-circle';
            }
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // Inicializar datos al cargar
        document.addEventListener('DOMContentLoaded', async () => {
            // Cargar datos iniciales
            await cargarDatosEmpresa();
            
            // Configurar colores iniciales
            if (empresaData.color_principal) {
                document.documentElement.style.setProperty('--color-primary', empresaData.color_principal);
                
                // Actualizar gradientes de botones
                const btns = document.querySelectorAll('.btn-open-modal, .btn-save');
                btns.forEach(btn => {
                    btn.style.background = `linear-gradient(135deg, ${empresaData.color_principal}, #3f37c9)`;
                });
            }
        });