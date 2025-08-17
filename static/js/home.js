'use strict';

// Elementos del DOM
const floatingToggle = document.getElementById('floatingToggle');
const menuToggle     = document.getElementById('menuToggle');
const sidebar        = document.getElementById('sidebar');
const appContainer   = document.getElementById('appContainer') || document.getElementById('main-content');
const userBtn        = document.getElementById('userBtn');
const dropdownMenu   = document.getElementById('dropdownMenu');
const accountingBtn  = document.getElementById('accountingBtn');
const accountingDropdown = document.getElementById('accountingDropdown');
const sidebarOverlay = document.querySelector('.sidebar-overlay');

// Estado del sidebar
let sidebarCollapsed = false;

// Función para alternar el sidebar
function toggleSidebar() {
  if (!sidebar) return;
  
  // Para móviles
  if (window.innerWidth <= 992) {
    sidebar.classList.toggle('mobile-open');
    return;
  }
  
  // Para escritorio
  sidebarCollapsed = !sidebarCollapsed;

  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    sidebar.classList.remove('expanded');
    if (appContainer) appContainer.classList.add('expanded-content');
  } else {
    sidebar.classList.remove('collapsed');
    sidebar.classList.add('expanded');
    if (appContainer) appContainer.classList.remove('expanded-content');
  }

  // Actualizar icono del botón de menú
  const menuIcon = menuToggle && menuToggle.querySelector('i');
  if (menuIcon) {
    menuIcon.className = sidebarCollapsed ? 'fas fa-bars' : 'fas fa-times';
  }
}

// Listeners para toggles
if (floatingToggle) floatingToggle.addEventListener('click', toggleSidebar);
if (menuToggle)     menuToggle.addEventListener('click', toggleSidebar);

// Dropdown de usuario
if (userBtn && dropdownMenu) {
  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
  });
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', (e) => {
  // Dropdown de usuario
  if (dropdownMenu && dropdownMenu.classList.contains('show') &&
      !e.target.closest('#userBtn') && !e.target.closest('.dropdown-menu')) {
    dropdownMenu.classList.remove('show');
  }
  
  // Sidebar en móviles
  if (sidebar && sidebar.classList.contains('mobile-open') && 
      !e.target.closest('#sidebar') && 
      e.target !== floatingToggle && 
      e.target !== menuToggle) {
    sidebar.classList.remove('mobile-open');
  }
});

// Cerrar sidebar al hacer clic en el overlay
if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', function() {
    sidebar.classList.remove('mobile-open');
  });
}

// Menu items -> actualizar título y active
const menuItems = document.querySelectorAll('.menu-item');
const pageTitle = document.querySelector('.content-title');

if (menuItems && menuItems.length) {
  menuItems.forEach(item => {
    item.addEventListener('click', function (e) {
      // Remover clase activa de todos
      menuItems.forEach(i => i.classList.remove('active'));
      // Añadir al clicado
      this.classList.add('active');

      // Actualizar título si existe
      if (pageTitle) {
        const span = this.querySelector('span');
        pageTitle.textContent = span ? span.textContent : this.textContent;
      }
    });
  });
}

// Gráfico
document.addEventListener('DOMContentLoaded', () => {
  const bars = document.querySelectorAll('.bar');
  const chartBtns = document.querySelectorAll('.chart-btn');
  const monthlyData = [
    12500, 18750, 25000, 33300,
    27100, 31250, 37500, 41670,
    35420, 39580, 29170, 25000
  ];

  // Animación inicial de las barras
  if (bars && bars.length) {
    bars.forEach((bar, index) => {
      const height = bar.style.height || bar.getAttribute('data-height') || '50px';
      bar.style.height = '0';
      setTimeout(() => {
        bar.style.height = height;
      }, 200 + (index * 50));
    });
  }

  // Cambiar rango de tiempo
  if (chartBtns && chartBtns.length) {
    chartBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        chartBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const range = this.dataset.range || 'month';
        updateChart(range);
      });
    });
  }

  function updateChart(range) {
    if (!bars || !bars.length) return;
    bars.forEach((bar, index) => {
      const amount = monthlyData[index] || 0;
      let displayAmount = amount;
      if (range === 'quarter') displayAmount = amount * 3;
      if (range === 'year')    displayAmount = amount * 12;

      const formattedAmount = new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'USD'
      }).format(displayAmount);

      const tooltip = bar.querySelector('.bar-tooltip');
      const month = bar.dataset.month || `Mes ${index + 1}`;
      if (tooltip) tooltip.textContent = `${month}: ${formattedAmount}`;
    });
  }

  updateChart('month');
});

// Dropdowns de contabilidad / impuestos / reportes / configuración
if (accountingBtn && accountingDropdown) {
  accountingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    accountingBtn.classList.toggle('active');
    accountingDropdown.classList.toggle('show');
  });
}

// taxesBtn y taxesDropdown
const taxesBtn = document.querySelector('#accountingDropdown .accounting-dropdown .dropdown-trigger');
const taxesDropdown = document.querySelector('#accountingDropdown .accounting-dropdown .accounting-menu');
if (taxesBtn && taxesDropdown) {
  taxesBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    taxesDropdown.classList.toggle('show');
  });
}

// reports
const reportsBtn = document.querySelector('.accounting-dropdown + .accounting-dropdown .dropdown-trigger');
const reportsDropdown = document.querySelector('.accounting-dropdown + .accounting-dropdown .accounting-menu');
if (reportsBtn && reportsDropdown) {
  reportsBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    reportsDropdown.classList.toggle('show');
  });
}

// configuracion
const configuracionBtn = document.getElementById('configuracionBtn');
const configuracionDropdown = document.getElementById('configuracionDropdown');
if (configuracionBtn && configuracionDropdown) {
  configuracionBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    configuracionDropdown.classList.toggle('show');
  });
}

// Cerrar todos los dropdowns con clic fuera
document.addEventListener('click', (e) => {
  // contabilidad
  if (accountingBtn && accountingDropdown && accountingDropdown.classList.contains('show')) {
    if (!accountingBtn.contains(e.target) && !accountingDropdown.contains(e.target)) {
      accountingBtn.classList.remove('active');
      accountingDropdown.classList.remove('show');
    }
  }
  // impuestos
  if (taxesBtn && taxesDropdown && taxesDropdown.classList.contains('show')) {
    if (!taxesBtn.contains(e.target) && !taxesDropdown.contains(e.target)) {
      taxesBtn.classList.remove('active');
      taxesDropdown.classList.remove('show');
    }
  }
  // reportes
  if (reportsBtn && reportsDropdown && reportsDropdown.classList.contains('show')) {
    if (!reportsBtn.contains(e.target) && !reportsDropdown.contains(e.target)) {
      reportsBtn.classList.remove('active');
      reportsDropdown.classList.remove('show');
    }
  }
  // configuracion
  if (configuracionBtn && configuracionDropdown && configuracionDropdown.classList.contains('show')) {
    if (!configuracionBtn.contains(e.target) && !configuracionDropdown.contains(e.target)) {
      configuracionBtn.classList.remove('active');
      configuracionDropdown.classList.remove('show');
    }
  }
});

// --- ROLE-based behaviour ---
(function handleRoleBehaviour() {
  const body = document.getElementById('appBody') || document.body;
  const role = body ? (body.dataset.rol || '') : '';
  const isAdmin = (role === 'admin' || role === '1');

  const toggleBtn = document.getElementById('sidebar-toggle');
  const main = document.getElementById('main-content') || document.getElementById('appContainer');

  if (!sidebar) return;

  if (isAdmin) {
    // admin: expandir por defecto y permitir toggle
    sidebar.classList.remove('collapsed');
    sidebar.classList.add('expanded');
    if (main) main.classList.add('expanded-content');

    if (toggleBtn) {
      toggleBtn.removeAttribute('aria-disabled');
      toggleBtn.style.pointerEvents = '';
      toggleBtn.title = '';
      if (!toggleBtn.dataset.initialized) {
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleSidebar();
        });
        toggleBtn.dataset.initialized = 'true';
      }
    }

  } else {
    // usuario normal: forzar collapsed y deshabilitar toggle
    sidebar.classList.add('collapsed');
    sidebar.classList.remove('expanded');
    if (main) main.classList.remove('expanded-content');

    if (toggleBtn) {
      toggleBtn.setAttribute('aria-disabled', 'true');
      toggleBtn.style.pointerEvents = 'none';
      toggleBtn.title = 'Acceso restringido';
    }

    // deshabilitar enlaces marcados con data-role-restricted
    document.querySelectorAll('[data-role-restricted]').forEach(el => {
      el.setAttribute('aria-disabled', 'true');
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.5';
      el.setAttribute('tabindex', '-1');
    });
  }
})();

// Función para actualizar datos del dashboard
function updateDashboardData() {
    fetch('/api/dashboard-data')
        .then(response => response.json())
        .then(data => {
            // Actualizar proveedores
            document.getElementById('totalProveedores').textContent = data.total_proveedores;
            
            // Actualizar ingresos
            document.getElementById('totalIngresos').textContent = 
                '$' + data.total_ingresos.toLocaleString('es-ES', {minimumFractionDigits: 2});
            
            // Actualizar pagos pendientes
            document.getElementById('cuentasPendientes').textContent = data.cuentas_pendientes;
            
            // Actualizar vencidas
            const vencidasElement = document.getElementById('cuentasVencidas');
            vencidasElement.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.cuentas_vencidas} vencidas`;
            
            // Cambiar clase según cantidad de vencidas
            if (data.cuentas_vencidas > 0) {
                vencidasElement.classList.add('negative');
                vencidasElement.classList.remove('positive');
            } else {
                vencidasElement.classList.add('positive');
                vencidasElement.classList.remove('negative');
            }
        })
        .catch(error => console.error('Error al actualizar datos:', error));
}

// Actualizar datos cada 5 minutos
setInterval(updateDashboardData, 300000);

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', updateDashboardData);