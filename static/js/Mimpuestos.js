
// Datos para gráficos de impuestos
const itbisData = {
    labels: ['Débito Fiscal', 'Crédito Fiscal', 'Neto a Pagar'],
    datasets: [{
        label: 'ITBIS (RD$)',
        data: [64320, 25570, 38750],
        backgroundColor: [
            'rgba(59, 130, 246, 0.7)',
            'rgba(16, 185, 129, 0.7)',
            'rgba(217, 119, 6, 0.7)'
        ],
        borderColor: [
            'rgb(59, 130, 246)',
            'rgb(16, 185, 129)',
            'rgb(217, 119, 6)'
        ],
        borderWidth: 1
    }]
};

const isrData = {
    labels: ['Ingresos Gravables', 'Retenciones', 'Neto a Pagar'],
    datasets: [{
        label: 'ISR (RD$)',
        data: [325400, 5320, 22400],
        backgroundColor: [
            'rgba(139, 92, 246, 0.7)',
            'rgba(239, 68, 68, 0.7)',
            'rgba(234, 88, 12, 0.7)'
        ],
        borderColor: [
            'rgb(139, 92, 246)',
            'rgb(239, 68, 68)',
            'rgb(234, 88, 12)'
        ],
        borderWidth: 1
    }]
};

// Inicializar gráficos
document.addEventListener('DOMContentLoaded', function() {
    // Gráfico ITBIS
    const itbisCtx = document.getElementById('itbisChart').getContext('2d');
    new Chart(itbisCtx, {
        type: 'bar',
        data: itbisData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Desglose de ITBIS'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'RD$ ' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    
    // Gráfico ISR
    const isrCtx = document.getElementById('isrChart').getContext('2d');
    new Chart(isrCtx, {
        type: 'bar',
        data: isrData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Desglose de ISR'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'RD$ ' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    
    // Eventos para botones de pago
    document.querySelectorAll('.pay-now-btn').forEach(button => {
        button.addEventListener('click', function() {
            const taxType = this.dataset.taxType.toUpperCase();
            const amount = this.dataset.amount;
            
            document.getElementById('taxType').value = taxType;
            document.getElementById('taxAmount').value = 'RD$ ' + parseFloat(amount).toLocaleString();
            
            document.getElementById('modalTitle').textContent = `Pagar ${taxType}`;
            
            document.getElementById('paymentModal').classList.add('active');
        });
    });
    
    // Eventos para cerrar modal
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelPayment').addEventListener('click', closeModal);
    
    // Confirmar pago
    document.getElementById('confirmPayment').addEventListener('click', function() {
        const taxType = document.getElementById('taxType').value.toLowerCase();
        const paymentMethod = document.getElementById('paymentMethod').value;
        const paymentDate = document.getElementById('paymentDate').value;
        
        if (!paymentMethod) {
            alert('Por favor seleccione un método de pago');
            return;
        }
        
        closeModal();
        payTax(taxType);
    });
    
    // Eventos para exportación
    document.querySelectorAll('.export-btn').forEach(button => {
        button.addEventListener('click', function() {
            const exportType = this.dataset.exportType;
            const taxType = this.dataset.taxType;
            
            switch(exportType) {
                case 'pdf':
                    exportToPDF(taxType);
                    break;
                case 'excel':
                    exportToExcel(taxType);
                    break;
                case 'xml':
                    exportToXML(taxType);
                    break;
            }
        });
    });
    
    // Eventos para mostrar histórico
    document.getElementById('show-itbis-history').addEventListener('click', function() {
        const historySection = document.getElementById('itbis-history');
        historySection.style.display = historySection.style.display === 'none' ? 'block' : 'none';
    });
    
    document.getElementById('show-isr-history').addEventListener('click', function() {
        const historySection = document.getElementById('isr-history');
        historySection.style.display = historySection.style.display === 'none' ? 'block' : 'none';
    });
});

// Función para cerrar modal
function closeModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

// Función para procesar pago
function payTax(taxType) {
    // Simular pago exitoso
    alert(`¡Pago de ${taxType.toUpperCase()} realizado con éxito!`);
    
    // Actualizar UI
    const summaryCard = document.getElementById(`${taxType}-summary`);
    const reportBox = document.getElementById(`${taxType}-report-box`);
    const payButton = document.querySelector(`.pay-now-btn[data-tax-type="${taxType}"]`);
    
    if (summaryCard) {
        summaryCard.querySelector('p.text-sm').textContent = `${taxType.toUpperCase()} Pagado`;
        summaryCard.querySelector('p.text-2xl').textContent = 'RD$ 0';
        summaryCard.querySelector('p.text-2xl').classList.remove('text-blue-600');
        summaryCard.querySelector('p.text-2xl').classList.add('text-green-600');
        
        const iconDiv = summaryCard.querySelector('.bg-blue-100');
        if (iconDiv) {
            iconDiv.className = 'bg-green-100 p-3 rounded-full';
            iconDiv.innerHTML = '<i class="fas fa-check-circle text-green-600 text-xl"></i>';
        }
        
        const dueDateSpan = summaryCard.querySelector('.flex.justify-between.text-sm span.font-medium');
        if (dueDateSpan) {
            const today = new Date();
            dueDateSpan.textContent = `Pagado el ${today.toLocaleDateString()}`;
        }
    }
    
    if (reportBox) {
        reportBox.className = 'bg-green-50 border border-green-200 rounded-lg p-4 mb-4';
        reportBox.querySelector('h4').textContent = `${taxType.toUpperCase()} Pagado`;
        reportBox.querySelector('.text-2xl').textContent = 'RD$ 0';
        
        const dueDateDiv = reportBox.querySelector('.text-sm');
        if (dueDateDiv) {
            const today = new Date();
            dueDateDiv.textContent = `Pagado el: ${today.toLocaleDateString()}`;
        }
    }
    
    if (payButton) {
        payButton.disabled = true;
        payButton.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
        payButton.classList.add('bg-gray-400', 'cursor-not-allowed');
        payButton.textContent = 'Pagado';
        payButton.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Pagado';
    }
    
    // Actualizar tabla histórica
    const historyTable = document.querySelector(`#${taxType}-history table tbody`);
    if (historyTable) {
        const newRow = document.createElement('tr');
        newRow.className = 'paid-row';
        newRow.innerHTML = `
            <td>Mayo 2023</td>
            <td>RD$ ${taxType === 'itbis' ? '38,750.00' : '22,400.00'}</td>
            <td>${new Date().toLocaleDateString()}</td>
            <td><span class="paid-status">Pagado</span></td>
        `;
        historyTable.insertBefore(newRow, historyTable.firstChild);
    }
}

// Funciones de exportación
function exportToPDF(taxType) {
    alert(`Generando reporte PDF de ${taxType.toUpperCase()}...`);
    // En una implementación real, se usaría jsPDF para generar el documento
}

function exportToExcel(taxType) {
    alert(`Generando reporte Excel de ${taxType.toUpperCase()}...`);
    // En una implementación real, se usaría SheetJS para generar el Excel
}

function exportToXML(taxType) {
    alert(`Generando reporte XML (DGII) de ${taxType.toUpperCase()}...`);
    // En una implementación real, se generaría el formato específico para la DGII
}
