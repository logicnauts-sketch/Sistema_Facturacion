// Estado de la aplicación
const appState = {
  selectedDevice: null,
  devices: [],
  defaultPort: null
};

// Elementos del DOM
const elements = {
  searchBtn: document.getElementById('searchBtn'),
  testBtn: document.getElementById('testBtn'),
  clearBtn: document.getElementById('clearBtn'),
  deviceInfo: document.getElementById('deviceInfo'),
  searchResults: document.getElementById('searchResults'),
  resultsContainer: document.getElementById('resultsContainer'),
  loading: document.getElementById('loading'),
  noDevicesMessage: document.getElementById('noDevicesMessage'),
  testResult: document.getElementById('testResult'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  deviceName: document.getElementById('deviceName'),
  devicePort: document.getElementById('devicePort'),
  deviceManufacturer: document.getElementById('deviceManufacturer'),
  deviceStatus: document.getElementById('deviceStatus'),
};

// 1) Buscar dispositivos vía API Flask
async function searchDevices() {
  elements.searchResults.classList.remove('hidden');
  elements.loading.classList.remove('hidden');
  elements.resultsContainer.innerHTML = '';
  elements.noDevicesMessage.classList.add('hidden');

  try {
    const resp = await fetch('/verifone/detectar');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dispositivos = await resp.json();

    appState.devices = dispositivos;

    // Si hay un default guardado, auto-selecciónalo y sal del flujo
    if (appState.defaultPort) {
      const def = dispositivos.find(d => d.port === appState.defaultPort);
      if (def) {
        selectDevice(def);
        return;
      }
    }

    renderDevices(dispositivos);
    if (dispositivos.length === 0) {
      elements.noDevicesMessage.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
    elements.noDevicesMessage.textContent = 'Error al buscar dispositivos.';
    elements.noDevicesMessage.classList.remove('hidden');
  } finally {
    elements.loading.classList.add('hidden');
  }
}

// 2) Renderizar lista de dispositivos
function renderDevices(devices) {
  elements.resultsContainer.innerHTML = '';
  devices.forEach(dev => {
    const div = document.createElement('div');
    div.className = 'device-item';
    div.innerHTML = `
      <div class="device-icon"><i class="fas fa-credit-card"></i></div>
      <div class="device-title">${dev.description || dev.port}</div>
      <div class="device-props">
        <div><span class="prop-name">Puerto:</span> <span class="prop-value">${dev.port}</span></div>
      </div>`;
    div.addEventListener('click', () => selectDevice(dev));
    elements.resultsContainer.appendChild(div);
  });
}

// 3) Seleccionar dispositivo
function selectDevice(device) {
  appState.selectedDevice = device;
  // Guardar como default
  localStorage.setItem('defaultVerifone', JSON.stringify(device));
  appState.defaultPort = device.port;

  elements.deviceInfo.classList.remove('hidden');
  elements.testBtn.disabled = false;
  elements.clearBtn.disabled = false;
  elements.statusIndicator.classList.add('connected');
  elements.statusText.textContent = `Seleccionado: ${device.port}`;
  elements.deviceName.textContent = device.description || '–';
  elements.devicePort.textContent = device.port;
  elements.deviceManufacturer.textContent = device.manufacturer || 'Desconocido';
  elements.deviceStatus.textContent = 'Desconectado';
  elements.searchResults.classList.add('hidden');
}

// 4) Probar conexión vía API Flask
async function testDevice() {
  if (!appState.selectedDevice) return;
  elements.testResult.className = 'notification info';
  elements.testResult.classList.remove('hidden');
  elements.testResult.innerHTML = `<i class="fas fa-sync fa-spin"></i> Probando...`;

  try {
    const resp = await fetch('/verifone/probar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port: appState.selectedDevice.port })
    });
    const result = await resp.json();

    if (result.success) {
      elements.testResult.className = 'notification success';
      elements.testResult.innerHTML = `<i class="fas fa-check-circle"></i> ¡Conexión exitosa!`;
      elements.deviceStatus.textContent = 'Conectado';
    } else {
      throw new Error(result.error || 'Desconocido');
    }
  } catch (err) {
    elements.testResult.className = 'notification error';
    elements.testResult.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <div><strong>Error:</strong> ${err.message}</div>
    `;
    elements.deviceStatus.textContent = 'Error de conexión';
  }
}

// 5) Limpiar selección
function clearSelection() {
  appState.selectedDevice = null;
  appState.defaultPort = null;
  localStorage.removeItem('defaultVerifone');

  elements.deviceInfo.classList.add('hidden');
  elements.clearBtn.disabled = true;
  elements.testBtn.disabled = true;
  elements.testResult.classList.add('hidden');
  elements.statusIndicator.classList.remove('connected');
  elements.statusText.textContent = 'No se ha seleccionado ningún dispositivo';
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  elements.searchBtn.addEventListener('click', searchDevices);
  elements.testBtn.addEventListener('click', testDevice);
  elements.clearBtn.addEventListener('click', clearSelection);

  // Estado inicial de botones
  elements.testBtn.disabled = true;
  elements.clearBtn.disabled = true;

  // Recuperar default y lanzar búsqueda automática
  const saved = localStorage.getItem('defaultVerifone');
  if (saved) {
    try {
      appState.defaultPort = JSON.parse(saved).port;
      searchDevices();
    } catch {}
  }
});
