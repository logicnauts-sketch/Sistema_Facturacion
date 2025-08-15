

document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const updateBtn = document.getElementById('updateBtn');
    const cutoffDate = document.getElementById('cutoffDate');
    
    // Evento para el botón de actualizar
    updateBtn.addEventListener('click', function() {
        const selectedDate = cutoffDate.value;
        alert(`Actualizando balance con fecha de corte: ${selectedDate}`);
        
        // Aquí iría la lógica para cargar datos actualizados
        // Simulamos una actualización visual
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin btn-icon"></i> Actualizando...';
        updateBtn.disabled = true;
        
        setTimeout(() => {
            updateBtn.innerHTML = '<i class="fas fa-check btn-icon"></i> Actualizado';
            updateBtn.disabled = false;
            
            // Restaurar después de 2 segundos
            setTimeout(() => {
                updateBtn.innerHTML = '<i class="fas fa-sync btn-icon"></i> Actualizar';
            }, 2000);
        }, 1500);
    });
    
    // Detectar si la ecuación contable está balanceada
    function checkAccountingEquation() {
        const totalAssets = 526900;
        const totalLiabilities = 333650;
        const totalEquity = 433250;
        const liabilitiesEquity = totalLiabilities + totalEquity;
        
        const equationElement = document.querySelector('.equation-content');
        const errorElement = document.querySelector('.equation-error');
        
        if (Math.abs(totalAssets - liabilitiesEquity) < 1) {
            equationElement.innerHTML = `RD$ ${totalAssets.toLocaleString('en-US', {minimumFractionDigits: 2})} = RD$ ${totalLiabilities.toLocaleString('en-US', {minimumFractionDigits: 2})} + RD$ ${totalEquity.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            errorElement.innerHTML = '✓';
            errorElement.classList.remove('equation-error');
            errorElement.classList.add('equation-success');
        } else {
            const totalLiabilitiesEquity = totalLiabilities + totalEquity;
            equationElement.innerHTML = `RD$ ${totalAssets.toLocaleString('en-US', {minimumFractionDigits: 2})} = RD$ ${totalLiabilities.toLocaleString('en-US', {minimumFractionDigits: 2})} + RD$ ${totalEquity.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            errorElement.innerHTML = '✗';
            errorElement.classList.remove('equation-success');
            errorElement.classList.add('equation-error');
        }
    }
    
    // Verificar la ecuación al cargar
    checkAccountingEquation();
});
