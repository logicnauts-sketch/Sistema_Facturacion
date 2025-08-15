
document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const searchButton = document.getElementById('searchButton');
    const saveButton = document.getElementById('saveButton');
    const closeModal = document.getElementById('closeModal');
    const resultsModal = document.getElementById('resultsModal');
    const modalBody = document.getElementById('modalBody');
    const currentPrinterSection = document.getElementById('currentPrinterSection');
    const noPrinterSection = document.getElementById('noPrinterSection');
    const currentPrinterDetails = document.getElementById('currentPrinterDetails');
    const confirmationMessage = document.getElementById('confirmationMessage');
    
    // Impresora seleccionada
    let selectedPrinter = null;
    
    // Función para abrir el modal
    function openModal() {
        resultsModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    // Función para cerrar el modal
    function closeResultsModal() {
        resultsModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    // Event listeners
    searchButton.addEventListener('click', buscarImpresoras);
    closeModal.addEventListener('click', closeResultsModal);
    saveButton.addEventListener('click', guardarImpresora);
    
    // Cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', function(event) {
        if (event.target === resultsModal) {
            closeResultsModal();
        }
    });
    
    // Función principal para buscar impresoras
    function buscarImpresoras() {
        openModal();
        
        // Mostrar animación de carga
        modalBody.innerHTML = `
            <div class="loader">
                <div class="spinner"></div>
                <p>Buscando impresoras conectadas...</p>
            </div>
        `;
        
        // Realizar petición al endpoint Flask
        fetch("/impresoras/scan")
            .then(response => {
                if (!response.ok) {
                    throw new Error("Error en la respuesta del servidor: " + response.status);
                }
                return response.json();
            })
            .then(impresoras => {
                mostrarResultados(impresoras);
            })
            .catch(error => {
                console.error("Error:", error);
                modalBody.innerHTML = `
                    <div class="no-printers">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error en la búsqueda</h3>
                        <p>Ocurrió un error al intentar buscar impresoras: ${error.message}</p>
                        <div class="action-buttons" style="margin-top:20px;">
                            <button class="btn btn-primary" onclick="buscarImpresoras()">
                                <i class="fas fa-redo"></i> Reintentar
                            </button>
                            <button class="btn btn-secondary" onclick="closeResultsModal()">
                                <i class="fas fa-times"></i> Cerrar
                            </button>
                        </div>
                    </div>
                `;
            });
    }
    
    // Función para mostrar los resultados en el modal
    function mostrarResultados(impresoras) {
        if (impresoras.length === 0) {
            modalBody.innerHTML = `
                <div class="no-printers">
                    <i class="fas fa-print"></i>
                    <h3>No se encontraron impresoras</h3>
                    <p>No se detectaron impresoras 2conect conectadas a este dispositivo.</p>
                    <div class="action-buttons" style="margin-top:20px;">
                        <button class="btn btn-primary" onclick="buscarImpresoras()">
                            <i class="fas fa-redo"></i> Intentar de nuevo
                        </button>
                        <button class="btn btn-secondary" onclick="closeResultsModal()">
                            <i class="fas fa-times"></i> Cerrar
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="results-header">
                <p style="margin-bottom:15px;">Se encontraron <strong>${impresoras.length}</strong> impresoras 2conect:</p>
            </div>
            <div class="printer-list">
        `;
        
        impresoras.forEach(printer => {
            const statusClass = printer.estado.toLowerCase().includes('conectado') ? "connected" : "disconnected";
            const statusIcon = printer.estado.toLowerCase().includes('conectado') ? "fa-check-circle" : "fa-times-circle";
            const estadoTexto = printer.estado.toLowerCase().includes('conectado') ? "Conectado" : "Desconectado";
            
            // Asegurar que los campos existan
            const nombre = printer.nombre || "Nombre no disponible";
            const tipo = printer.tipo || "Tipo desconocido";
            const modelo = printer.modelo || "N/A";
            const ip = printer.ip || "N/A";
            const ubicacion = printer.ubicacion || "N/A";
            
            html += `
                <div class="printer-item">
                    <div class="printer-header">
                        <div class="printer-icon">
                            <i class="fas fa-print"></i>
                        </div>
                        <div class="printer-name">${nombre}</div>
                    </div>
                    
                    <div class="printer-details-modal">
                        <div class="detail-modal">
                            <div class="detail-label-modal">Tipo</div>
                            <div class="detail-value-modal">${tipo}</div>
                        </div>
                        <div class="detail-modal">
                            <div class="detail-label-modal">Modelo</div>
                            <div class="detail-value-modal">${modelo}</div>
                        </div>
                        <div class="detail-modal">
                            <div class="detail-label-modal">IP</div>
                            <div class="detail-value-modal">${ip}</div>
                        </div>
                        <div class="detail-modal">
                            <div class="detail-label-modal">Ubicación</div>
                            <div class="detail-value-modal">${ubicacion}</div>
                        </div>
                    </div>
                    
                    <div class="status ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${estadoTexto}
                    </div>
                    
                    <div class="printer-actions">
                        <button class="select-btn" data-printer='${JSON.stringify(printer)}'>
                            <i class="fas fa-check"></i> Seleccionar
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `
            </div>
            <div class="action-buttons" style="margin-top:20px; justify-content:center;">
                <button class="btn btn-secondary" onclick="closeResultsModal()" style="margin-top:10px;">
                    <i class="fas fa-times"></i> Cerrar
                </button>
            </div>
        `;
        
        modalBody.innerHTML = html;
        
        // Agregar event listeners a los botones de selección
        document.querySelectorAll('.select-btn').forEach(button => {
            button.addEventListener('click', function() {
                const printerData = JSON.parse(this.getAttribute('data-printer'));
                seleccionarImpresora(printerData);
                closeResultsModal();
            });
        });
    }
    
    // Función para seleccionar una impresora
    function seleccionarImpresora(printer) {
        selectedPrinter = printer;
        
        // Actualizar la vista
        currentPrinterDetails.innerHTML = `
            <div class="printer-details">
                <div class="detail">
                    <div class="detail-label">Nombre</div>
                    <div class="detail-value">${printer.nombre}</div>
                </div>
                <div class="detail">
                    <div class="detail-label">Tipo</div>
                    <div class="detail-value">${printer.tipo}</div>
                </div>
                <div class="detail">
                    <div class="detail-label">Modelo</div>
                    <div class="detail-value">${printer.modelo}</div>
                </div>
                <div class="detail">
                    <div class="detail-label">Estado</div>
                    <div class="detail-value">
                        <span class="status ${printer.estado.toLowerCase().includes('conectado') ? 'connected' : 'disconnected'}">
                            <i class="fas ${printer.estado.toLowerCase().includes('conectado') ? 'fa-check-circle' : 'fa-times-circle'}"></i> 
                            ${printer.estado}
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        // Mostrar sección de impresora seleccionada
        currentPrinterSection.style.display = 'block';
        noPrinterSection.style.display = 'none';
        
        // Habilitar botón de guardar
        saveButton.disabled = false;
    }
    
    // Función para guardar la impresora seleccionada
    function guardarImpresora() {
        if (!selectedPrinter) return;
        
        // Simular envío al servidor
        fetch("/impresoras/guardar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(selectedPrinter)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Mostrar mensaje de confirmación
                confirmationMessage.style.display = 'block';
                
                // Ocultar mensaje después de 3 segundos
                setTimeout(() => {
                    confirmationMessage.style.display = 'none';
                }, 3000);
            }
        })
        .catch(error => {
            console.error("Error al guardar:", error);
            alert("Ocurrió un error al guardar la impresora seleccionada");
        });
    }
    
    // Inicializar vista
    function initView() {
        // Por defecto, no hay impresora seleccionada
        currentPrinterSection.style.display = 'none';
        noPrinterSection.style.display = 'block';
        confirmationMessage.style.display = 'none';
        saveButton.disabled = true;
    }
    
    // Hacer las funciones accesibles globalmente
    window.buscarImpresoras = buscarImpresoras;
    window.closeResultsModal = closeResultsModal;
    
    // Inicializar
    initView();
});
