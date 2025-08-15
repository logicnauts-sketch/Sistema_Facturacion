
document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos
    const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
    const filtersContainer = document.getElementById('filtersContainer');
    const newEntryBtn = document.getElementById('newEntryBtn');
    const floatingBtn = document.getElementById('floatingBtn');
    const exportBtn = document.getElementById('exportBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Estado de los filtros
    let filtersVisible = false;
    
    // Toggle para mostrar/ocultar filtros
    toggleFiltersBtn.addEventListener('click', function() {
        filtersVisible = !filtersVisible;
        
        if (filtersVisible) {
            filtersContainer.classList.add('show');
            toggleFiltersBtn.innerHTML = '<i class="fas fa-filter"></i> Ocultar Filtros';
            toggleFiltersBtn.innerHTML = '<i class="fas fa-times"></i> Ocultar Filtros';
        } else {
            filtersContainer.classList.remove('show');
            toggleFiltersBtn.innerHTML = '<i class="fas fa-filter"></i> Mostrar Filtros';
        }
    });
    
    // Nuevo asiento
    newEntryBtn.addEventListener('click', function() {
        showNotification('Preparando formulario para nuevo asiento...', 'info');
    });
    
    floatingBtn.addEventListener('click', function() {
        showNotification('Preparando formulario para nuevo asiento...', 'info');
    });
    
    // Exportar funcionalidad
    exportBtn.addEventListener('click', function() {
        showNotification('Exportando datos... por favor espere', 'info');
        setTimeout(() => {
            showNotification('Datos exportados exitosamente', 'success');
        }, 1500);
    });
    
    // Actualizar funcionalidad
    refreshBtn.addEventListener('click', function() {
        showNotification('Actualizando datos...', 'info');
        setTimeout(() => {
            showNotification('Datos actualizados correctamente', 'success');
        }, 1200);
    });
    
    // Mostrar notificación
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Eliminar notificación después de la animación
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
    
    // Botones de acción para asientos
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const entryId = this.closest('.journal-entry').querySelector('.entry-id').textContent;
            showNotification(`Editando asiento: ${entryId}`, 'info');
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const entryId = this.closest('.journal-entry').querySelector('.entry-id').textContent;
            showNotification(`Eliminando asiento: ${entryId}`, 'warning');
        });
    });
    
    document.querySelectorAll('.print-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const entryId = this.closest('.journal-entry').querySelector('.entry-id').textContent;
            showNotification(`Imprimiendo asiento: ${entryId}`, 'info');
        });
    });
});
