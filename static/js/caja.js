// Estado inicial vacío
const state = {
    open: false,
    start: null,
    end: null,
    cashier: '',
    initialCash: 0,
    movements: [],
    facturas: 0,
    totalFacturado: 0,
    ultimaFactura: null,
    turnoId: null  // Nuevo campo para almacenar el ID del turno
};

// Utilidades
const $ = (id) => document.getElementById(id);
const fmt = (n) => 'RD$\u00A0' + (Number(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nowStr = () => new Date().toLocaleString('es-DO');

// Inicializar notyf
const notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' }
});

// Métodos para calcular totales
const getTotalByMethod = (method) => {
    return state.movements
        .filter(m => (m.metodo_pago || '').toString() === method)
        .reduce((sum, m) => {
            const monto = Number(m.monto) || 0;
            return sum + (m.tipo === 'venta' ? monto : -monto);
        }, 0);
};

const getExpectedCash = () => {
    const initial = Number(state.initialCash) || 0;
    return state.movements
        .filter(m => (m.metodo_pago || '') === 'efectivo')
        .reduce((sum, m) => {
            const monto = Number(m.monto) || 0;
            return sum + (m.tipo === 'venta' ? monto : -monto);
        }, initial);
};

// Actualizar UI
function setStatus() {
    const statusEl = $('statusChip');
    if (!statusEl) return;

    statusEl.innerHTML = `
        <span class="status-indicator ${state.open ? 'status-open' : 'status-closed'}"></span>
        Estado: ${state.open ? 'Abierto' : 'Cerrado'}
    `;

    const btnCerrar = $('btnCerrarTurno');
    if (btnCerrar) btnCerrar.disabled = !state.open;

    const estadoVal = $('estadoVal');
    if (estadoVal) estadoVal.innerText = state.open ? 'Abierto' : 'Cerrado';

    const inicioVal = $('inicioVal');
    if (inicioVal) {
        inicioVal.innerText = state.start 
            ? new Date(state.start).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) 
            : '—';
    }

    const finVal = $('finVal');
    if (finVal) {
        finVal.innerText = state.end 
            ? new Date(state.end).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) 
            : '—';
    }

    const btnAbrir = $('btnAbrir');
    if (btnAbrir) btnAbrir.disabled = state.open;

    const inputInicial = $('inputInicial');
    if (inputInicial) {
        inputInicial.disabled = state.open || state.start;
        if (state.initialCash && state.initialCash > 0) {
            inputInicial.value = state.initialCash.toFixed(2);
        }
    }
}

function renderMovs() {
    const tbody = $('tbodyMovs');
    if (!tbody) return;
    
    if (state.loadingMovements) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="spinner"></div>
                    <p>Cargando movimientos...</p>
                </td>
            </tr>
        `;
        return;
    }

    if (state.movements.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No hay movimientos registrados</p>
                </td>
            </tr>
        `;
        updateExpectedUI();
        return;
    }

    tbody.innerHTML = '';
    state.movements.forEach((mov, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.dataset.idx = idx;

        let pillClass = '';
        if ((mov.metodo_pago || '') === 'efectivo') pillClass = 'cash';
        else if ((mov.metodo_pago || '') === 'tarjeta') pillClass = 'card';
        else pillClass = 'transfer';

        if (mov.tipo === 'gasto') pillClass += ' expense';

        const metodoLabel = (mov.metodo_pago || '').charAt(0).toUpperCase() + (mov.metodo_pago || '').slice(1);
        const montoNumber = Number(mov.monto) || 0;
        const montoDisplay = mov.tipo === 'venta' ? fmt(montoNumber) : fmt(-montoNumber);
        const hora = mov.fecha ? new Date(mov.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '—';
        const factura = mov.factura_id ? '#' + mov.factura_id : '—';

        tr.innerHTML = `
            <td><span class="pill ${pillClass}">${mov.tipo === 'venta' ? 'Venta' : 'Gasto'}</span></td>
            <td>${mov.descripcion || '—'}</td>
            <td>${metodoLabel || '—'}</td>
            <td>${montoDisplay}</td>
            <td>${hora}</td>
            <td>${factura}</td>
        `;
        tbody.appendChild(tr);
    });

    updateExpectedUI();
}

function updateFacturacionStats() {
    const elFact = $('facturasRegistradas');
    const elUlt = $('ultimaFactura');
    const elTotal = $('totalFacturado');

    if (elFact) elFact.innerText = Number(state.facturas) || 0;
    if (elUlt) elUlt.innerText = state.ultimaFactura ? '#' + state.ultimaFactura : '—';
    if (elTotal) elTotal.innerText = fmt(state.totalFacturado || 0);
}

function updateExpectedUI() {
    const expCash = getExpectedCash();
    const expCard = getTotalByMethod('tarjeta');
    const total = expCash + expCard;

    const elExpCash = $('modalExpCash');
    const elExpCard = $('modalExpCard');
    const elExpTotal = $('modalExpTotal');

    elExpCash && (elExpCash.innerText = fmt(expCash));
    elExpCard && (elExpCard.innerText = fmt(expCard));
    elExpTotal && (elExpTotal.innerText = fmt(total));
}

// Acciones principales
async function openShift() {
    const initial = Number($('inputInicial').value || 0);
    if (initial <= 0) {
        notyf.error('Ingrese un monto inicial válido');
        return;
    }

    try {
        const response = await fetch('/api/caja/abrir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto_inicial: initial })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Error al abrir turno');
        }

        // Recargar estado desde el backend
        await loadState();
        notyf.success('Turno abierto con éxito');

    } catch (error) {
        notyf.error(error.message || 'Error al abrir turno');
        console.error('Error en openShift:', error);
    }
}

async function closeShift() {
    if (!state.open) return;

    const cntCash = Number($('modalCntCash').value || 0);
    const cntCard = Number($('modalCntCard').value || 0);
    const cntTotal = cntCash + cntCard;

    if (cntCash === 0 && cntCard === 0) {
        const result = await Swal.fire({
            title: '¿Cerrar turno sin ingresar conteo?',
            text: "No se ha ingresado ningún monto para efectivo o tarjeta.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, cerrar',
            cancelButtonText: 'Cancelar'
        });
        if (!result.isConfirmed) return;
    }

    try {
        const response = await fetch('/api/caja/cerrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                observaciones: ($('modalObservaciones') ? $('modalObservaciones').value.trim() : ''),
                monto_efectivo: cntCash,
                monto_tarjeta: cntCard,
                monto_total: cntTotal
            })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Error al cerrar turno');
        }

        // Guardar el ID del turno en el estado
        state.turnoId = data.turno_id;

        // Actualizar estadísticas con los datos recibidos del backend
        if (data.estadisticas) {
            state.facturas = data.estadisticas.total_facturas || 0;
            state.totalFacturado = data.estadisticas.total_facturado || 0;
            state.ultimaFactura = data.estadisticas.ultima_factura_id || null;
        }

        // Actualizar estado local
        state.open = false;
        state.end = new Date().toISOString();
        
        // Actualizar UI
        setStatus();
        updateFacturacionStats();
        
        // Mostrar reporte
        buildReport();
        closeModal('closeModal');
        openModal('reportModal');

        notyf.success('Turno cerrado con éxito');

    } catch (error) {
        notyf.error(error.message || 'Error al cerrar turno');
        console.error('Error en closeShift:', error);
    }
}

async function resetAll() {
    if (state.open) {
        const result = await Swal.fire({
            title: '¿Está seguro de reiniciar?',
            text: "Se perderán todos los datos del turno actual.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, reiniciar',
            cancelButtonText: 'Cancelar'
        });
        if (!result.isConfirmed) return;
    }

    try {
        // Simulamos un reset cerrando y abriendo el turno
        if (state.open) {
            await fetch('/api/caja/cerrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Recargar estado
        await loadState();
        notyf.success('Sistema reiniciado');

    } catch (error) {
        notyf.error('Error al reiniciar: ' + (error.message || ''));
    }
}

// Esta función se llama desde el sistema de facturación
async function registrarFactura(tipo, metodo, monto, descripcion, facturaId) {
    if (!state.open) {
        notyf.error('El turno no está abierto');
        return;
    }

    try {
        const response = await fetch('/api/caja/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo: tipo,
                metodo_pago: metodo,
                monto: Number(monto) || 0,
                descripcion: descripcion,
                factura_id: facturaId
            })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Error registrando movimiento');
        }

        // Recargar SOLO estadísticas de facturación, no todo el estado
        await updateFacturacionStatsFromServer();
        notyf.success('Movimiento registrado');

    } catch (error) {
        notyf.error('Error registrando factura: ' + (error.message || ''));
    }
}

// Nueva función para actualizar solo estadísticas
async function updateFacturacionStatsFromServer() {
    try {
        const response = await fetch('/api/caja/estadisticas-facturacion');
        const data = await response.json();
        
        if (data.success) {
            state.facturas = data.data.total_facturas || 0;
            state.totalFacturado = data.data.total_facturado || 0;
            state.ultimaFactura = data.data.ultima_factura_id || null;
            
            updateFacturacionStats();
        }
    } catch (error) {
        console.error('Error actualizando estadísticas:', error);
    }
}

function prefillModalCount() {
    const expCash = getExpectedCash();
    const expCard = getTotalByMethod('tarjeta');

    $('modalCntCash') && ($('modalCntCash').value = expCash.toFixed(2));
    $('modalCntCard') && ($('modalCntCard').value = expCard.toFixed(2));
    recalcModal();
}

function recalcModal() {
    const cntCash = Number($('modalCntCash').value || 0);
    const cntCard = Number($('modalCntCard').value || 0);

    const expCash = getExpectedCash();
    const expCard = getTotalByMethod('tarjeta');

    const difCash = cntCash - expCash;
    const difCard = cntCard - expCard;
    const difTotal = difCash + difCard;

    setModalDiff('modalDifCash', difCash);
    setModalDiff('modalDifCard', difCard);
    setModalDiff('modalDifTotal', difTotal);
}

function setModalDiff(id, value) {
    const el = $(id);
    if (!el) return;
    const absValue = Math.abs(value);
    let cls = '', text = '';

    if (absValue < 0.01) {
        cls = 'ok';
        text = 'Cuadrado';
    } else if (value > 0) {
        cls = 'warn';
        text = `+ ${fmt(value)}`;
    } else {
        cls = 'danger';
        text = `– ${fmt(absValue)}`;
    }

    el.className = cls;
    el.innerText = text;
}

function openCloseModal() {
    if (!state.open) return;

    // Resetear campos de conteo
    if ($('modalCntCash')) $('modalCntCash').value = '';
    if ($('modalCntCard')) $('modalCntCard').value = '';
    if ($('modalObservaciones')) $('modalObservaciones').value = '';

    // Actualizar valores esperados antes de abrir el modal
    updateExpectedUI();

    // Resetear diferencias
    ['modalDifCash', 'modalDifCard', 'modalDifTotal'].forEach(id => {
        const el = $(id);
        if (el) {
            el.innerText = '—';
            el.className = '';
        }
    });

    openModal('closeModal');
    recalcModal();
}

function buildReport() {
    const expCash = getExpectedCash();
    const expCard = getTotalByMethod('tarjeta');
    const total = expCash + expCard;

    const cntCash = Number($('modalCntCash').value || 0);
    const cntCard = Number($('modalCntCard').value || 0);

    const difCash = cntCash - expCash;
    const difCard = cntCard - expCard;
    const difTotal = difCash + difCard;

    const rowsMovs = state.movements.map((mov, i) => {
        const pillClass = (mov.metodo_pago === 'efectivo') ? 'cash' :
                         (mov.metodo_pago === 'tarjeta') ? 'card' :
                         'transfer';
        const montoNumber = Number(mov.monto) || 0;
        return `
            <tr>
                <td>${i + 1}</td>
                <td>${mov.tipo === 'venta' ? 'Venta' : 'Gasto'}</td>
                <td>${mov.descripcion || '—'}</td>
                <td><span class="pill ${pillClass}">${(mov.metodo_pago || '').charAt(0).toUpperCase() + (mov.metodo_pago || '').slice(1)}</span></td>
                <td style="text-align: right">${fmt(mov.tipo === 'venta' ? montoNumber : -montoNumber)}</td>
                <td>${mov.factura_id ? '#' + mov.factura_id : '—'}</td>
                <td>${mov.fecha ? new Date(mov.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="7" style="text-align: center; color: #94a3b8">Sin movimientos</td></tr>`;

    const startLabel = state.start ? new Date(state.start).toLocaleString('es-DO') : '—';
    const endLabel = state.end ? new Date(state.end).toLocaleString('es-DO') : '—';
    const cashierLabel = state.cashier || '—';

    const html = `
        <div class="flex-row" style="justify-content: space-between; flex-wrap: wrap">
            <div>
                <div class="chip">Cajero: <strong>${cashierLabel}</strong></div>
                <div class="chip">Inicio: ${startLabel}</div>
                <div class="chip">Fin: ${endLabel}</div>
            </div>
            <div class="chip">Monto Inicial: <strong>${fmt(state.initialCash || 0)}</strong></div>
        </div>

        <div class="divider"></div>

        <h3>Resumen de Cierre</h3>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Método</th>
                        <th>Esperado</th>
                        <th>Contado</th>
                        <th>Diferencia</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><span class="pill cash">Efectivo</span></td>
                        <td>${fmt(expCash)}</td>
                        <td>${fmt(cntCash)}</td>
                        <td>${fmt(difCash)}</td>
                    </tr>
                    <tr>
                        <td><span class="pill card">Tarjeta</span></td>
                        <td>${fmt(expCard)}</td>
                        <td>${fmt(cntCard)}</td>
                        <td>${fmt(difCard)}</td>
                    </tr>
                    <tr style="font-weight: bold">
                        <td>Total</td>
                        <td>${fmt(total)}</td>
                        <td>${fmt(cntCash + cntCard)}</td>
                        <td>${fmt(difTotal)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="divider"></div>

        <h3>Resumen de Facturación</h3>
        <div class="facturacion-stats">
            <div class="facturacion-stat">
                <div class="label">Total Facturas</div>
                <div class="value">${Number(state.facturas) || 0}</div>
            </div>
            <div class="facturacion-stat">
                <div class="label">Última Factura</div>
                <div class="value">${state.ultimaFactura ? '#' + state.ultimaFactura : '—'}</div>
            </div>
            <div class="facturacion-stat">
                <div class="label">Total Facturado</div>
                <div class="value">${fmt(state.totalFacturado)}</div>
            </div>
        </div>

        <div class="divider"></div>

        <h3>Detalle de Movimientos</h3>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Tipo</th>
                        <th>Descripción</th>
                        <th>Método</th>
                        <th>Monto</th>
                        <th>Factura</th>
                        <th>Hora</th>
                    </tr>
                </thead>
                <tbody>${rowsMovs}</tbody>
            </table>
        </div>

        ${$('modalObservaciones') && $('modalObservaciones').value ? (`
            <div class="divider"></div>
            <h3>Observaciones</h3>
            <p>${$('modalObservaciones').value}</p>
        `) : ''}
    `;

    const cont = $('reporteContenido');
    if (cont) cont.innerHTML = html;
}

// Funciones para controlar modales
function openModal(modalId) {
    const m = $(modalId);
    if (!m) return;
    m.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const m = $(modalId);
    if (!m) return;
    m.classList.remove('active');
    document.body.style.overflow = '';
}

// Cargar estado desde el backend
async function loadState() {
    try {
        // Mostrar indicador de carga
        $('statusChip').innerHTML = '<span class="status-indicator status-loading"></span> Estado: Cargando...';
        state.loadingMovements = true;
        renderMovs(); // Mostrar spinner de carga
        
        const response = await fetch('/api/caja/estado-actual');
        const data = await response.json();
        
        if (data.success) {
            // Asignar explícitamente cada propiedad
            state.open = data.data.open;
            state.start = data.data.start;
            state.end = data.data.end;
            state.cashier = data.data.cashier;
            state.initialCash = data.data.initialCash;
            state.movements = data.data.movements || [];
            state.facturas = data.data.facturas || 0;
            state.totalFacturado = data.data.totalFacturado || 0;
            state.ultimaFactura = data.data.ultimaFactura || null;
            
            // Actualizar UI
            setStatus();
            updateFacturacionStats();
            
            // Actualizar cajero en UI
            const cajeroVal = $('cajeroVal');
            if (cajeroVal) cajeroVal.innerText = state.cashier || 'admin@tienda';
            
            return true;
        } else {
            notyf.error('Error cargando estado: ' + (data.error || ''));
            return false;
        }
    } catch (error) {
        notyf.error('Error de conexión al cargar estado');
        console.error('Error cargando estado:', error);
        return false;
    } finally {
        state.loadingMovements = false;
        // Forzar renderizado después de cargar
        renderMovs();
    }
}

// Configuración inicial
function setupEventListeners() {
    const btnAbrir = $('btnAbrir');
    const btnCerrarTurno = $('btnCerrarTurno');
    const btnReset = $('btnReset');

    btnAbrir && btnAbrir.addEventListener('click', openShift);
    btnCerrarTurno && btnCerrarTurno.addEventListener('click', openCloseModal);
    btnReset && btnReset.addEventListener('click', resetAll);

    $('btnPrefill') && $('btnPrefill').addEventListener('click', prefillModalCount);
    $('btnCerrarModal') && $('btnCerrarModal').addEventListener('click', closeShift);

    // Modificado: Descarga el PDF en lugar de imprimir
    $('btnImprimir') && $('btnImprimir').addEventListener('click', () => {
        if (state.turnoId) {
            // Descargar el PDF
            window.location.href = `/api/caja/reporte-pdf/${state.turnoId}`;
        } else {
            notyf.error('No se encontró el ID del turno');
        }
    });
    
    $('btnAceptarReporte') && $('btnAceptarReporte').addEventListener('click', () => {
        closeModal('reportModal');
        location.reload(); // Recargar la página
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal && modal.id) closeModal(modal.id);
        });
    });

    ['modalCntCash', 'modalCntCard'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('input', recalcModal);
    });
}

// Al cargar la página
async function init() {
    // Inicializar estado
    state.cashier = "{{ session.get('nombre_completo', 'admin@tienda') }}";
    
    // Cargar estado desde el backend
    await loadState();
    
    // Configurar eventos
    setupEventListeners();

    // Hacer global la función para que la facturación pueda llamarla
    window.registrarFactura = registrarFactura;
}

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);