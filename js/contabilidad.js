/**
 * SMARTSTOCK CONTABLE — Contabilidad Automatizada
 * Libro Diario, Mayor, Balance General y Estado de Resultados
 */

const Contabilidad = (() => {

  /** Plan de cuentas simplificado */
  const PLAN_CUENTAS = {
    '1.1.1': { nombre: 'Caja', tipo: 'activo' },
    '1.1.4': { nombre: 'Inventario', tipo: 'activo' },
    '2.1.1': { nombre: 'Proveedores', tipo: 'pasivo' },
    '3.1.1': { nombre: 'Capital Social', tipo: 'patrimonio' },
    '4.1.1': { nombre: 'Ventas', tipo: 'ingreso' },
    '5.1.1': { nombre: 'Costo de Ventas', tipo: 'gasto' },
    '5.2.1': { nombre: 'Gastos Operativos', tipo: 'gasto' }
  };

  /** Crea asiento contable automático */
  function crearAsiento(datos) {
    const asientos = Storage.getAsientos();
    const asiento = {
      id: Storage.generateId(),
      fecha: datos.fecha || Storage.today(),
      descripcion: datos.descripcion,
      referencia: datos.referencia || null,
      tipo: datos.tipo,
      debe: datos.debe,
      haber: datos.haber
    };
    asientos.unshift(asiento);
    Storage.setAsientos(asientos);
    return asiento;
  }

  /** Asiento por compra: Debe Inventario / Haber Caja */
  function asientoCompra(compra) {
    return crearAsiento({
      fecha: compra.fecha,
      descripcion: `Compra ${compra.factura} — ${compra.proveedor}`,
      referencia: compra.id,
      tipo: 'compra',
      debe: [{ cuenta: 'Inventario', codigo: '1.1.4', monto: compra.total }],
      haber: [{ cuenta: 'Caja/Bancos', codigo: '1.1.1', monto: compra.total }]
    });
  }

  /** Asiento por venta: Debe Caja / Haber Ventas */
  function asientoVenta(venta) {
    return crearAsiento({
      fecha: venta.fecha,
      descripcion: `Venta — ${venta.cliente}`,
      referencia: venta.id,
      tipo: 'venta',
      debe: [{ cuenta: 'Caja', codigo: '1.1.1', monto: venta.total }],
      haber: [{ cuenta: 'Ventas', codigo: '4.1.1', monto: venta.total }]
    });
  }

  /** Genera Libro Diario */
  function getLibroDiario() {
    return Storage.getAsientos().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }

  /** Genera Libro Mayor agrupado por cuenta */
  function getLibroMayor() {
    const asientos = getLibroDiario();
    const cuentas = {};

    asientos.forEach(asiento => {
      asiento.debe.forEach(linea => {
        const key = linea.codigo || linea.cuenta;
        if (!cuentas[key]) cuentas[key] = { cuenta: linea.cuenta, codigo: linea.codigo, debe: 0, haber: 0, movimientos: [] };
        cuentas[key].debe += linea.monto;
        cuentas[key].movimientos.push({ fecha: asiento.fecha, descripcion: asiento.descripcion, debe: linea.monto, haber: 0 });
      });
      asiento.haber.forEach(linea => {
        const key = linea.codigo || linea.cuenta;
        if (!cuentas[key]) cuentas[key] = { cuenta: linea.cuenta, codigo: linea.codigo, debe: 0, haber: 0, movimientos: [] };
        cuentas[key].haber += linea.monto;
        cuentas[key].movimientos.push({ fecha: asiento.fecha, descripcion: asiento.descripcion, debe: 0, haber: linea.monto });
      });
    });

    return Object.values(cuentas);
  }

  /** Calcula valor total del inventario */
  function getValorInventario() {
    return Storage.getProductos().reduce((sum, p) => sum + (p.stock * p.precioCompra), 0);
  }

  /** Genera Balance General */
  function getBalanceGeneral() {
    const mayor = getLibroMayor();
    const valorInventario = getValorInventario();

    let caja = 0, ventas = 0, compras = 0;
    mayor.forEach(c => {
      if (c.codigo === '1.1.1') caja = c.debe - c.haber;
      if (c.codigo === '4.1.1') ventas = c.haber;
      if (c.codigo === '1.1.4') compras = c.debe;
    });

    const ventasData = Storage.getVentas();
    const totalVentas = ventasData.reduce((s, v) => s + v.total, 0);
    const totalCompras = Storage.getCompras().reduce((s, c) => s + c.total, 0);
    const utilidad = ventasData.reduce((s, v) => s + (v.utilidad || 0), 0);

    // Caja = ventas - compras + capital inicial demo
    const capitalInicial = 10000;
    const cajaCalculada = capitalInicial + totalVentas - totalCompras;

    return {
      activos: [
        { cuenta: 'Caja y Bancos', monto: Math.max(cajaCalculada, 0) },
        { cuenta: 'Inventario', monto: valorInventario }
      ],
      pasivos: [
        { cuenta: 'Proveedores', monto: 0 }
      ],
      patrimonio: [
        { cuenta: 'Capital Social', monto: capitalInicial },
        { cuenta: 'Utilidades Acumuladas', monto: utilidad }
      ],
      totalActivos: Math.max(cajaCalculada, 0) + valorInventario,
      totalPasivos: 0,
      totalPatrimonio: capitalInicial + utilidad
    };
  }

  /** Genera Estado de Resultados */
  function getEstadoResultados() {
    const ventas = Storage.getVentas();
    const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
    const totalCosto = ventas.reduce((s, v) => s + (v.costo || 0), 0);
    const utilidadBruta = totalVentas - totalCosto;
    const gastosOperativos = 0;
    const utilidadNeta = utilidadBruta - gastosOperativos;

    return {
      ingresos: [{ cuenta: 'Ventas de Mercadería', monto: totalVentas }],
      costos: [{ cuenta: 'Costo de Ventas', monto: totalCosto }],
      gastos: [{ cuenta: 'Gastos Operativos', monto: gastosOperativos }],
      utilidadBruta,
      utilidadNeta,
      totalIngresos: totalVentas,
      totalCostos: totalCosto + gastosOperativos
    };
  }

  /** Renderiza módulo de contabilidad */
  function render() {
    const container = document.getElementById('module-contabilidad');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Contabilidad Automatizada</h2>
          <p>Libros contables generados automáticamente desde operaciones</p>
        </div>
      </div>

      <div class="contabilidad-tabs">
        <button class="contab-tab active" data-tab="diario">Libro Diario</button>
        <button class="contab-tab" data-tab="mayor">Libro Mayor</button>
        <button class="contab-tab" data-tab="balance">Balance General</button>
        <button class="contab-tab" data-tab="resultados">Estado de Resultados</button>
      </div>

      <div class="contab-section active" id="tab-diario"></div>
      <div class="contab-section" id="tab-mayor"></div>
      <div class="contab-section" id="tab-balance"></div>
      <div class="contab-section" id="tab-resultados"></div>
    `;

    renderDiario();
    renderMayor();
    renderBalance();
    renderResultados();
    bindTabs();
  }

  function bindTabs() {
    document.querySelectorAll('.contab-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.contab-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.contab-section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });
  }

  function renderDiario() {
    const asientos = getLibroDiario();
    document.getElementById('tab-diario').innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Libro Diario — ${asientos.length} asientos</h3></div>
        <div class="card-body">
          ${asientos.length === 0 ? '<div class="empty-state"><i class="fas fa-book"></i><h4>Sin asientos</h4></div>' :
          asientos.map(a => `
            <div class="asiento-row">
              <div class="asiento-header">
                <span><strong>${Storage.formatDate(a.fecha)}</strong> — ${a.descripcion}</span>
                <span>${a.tipo || ''}</span>
              </div>
              <div class="asiento-lines">
                ${a.debe.map(d => `<div class="asiento-line debe"><span><span class="cuenta-code">${d.codigo}</span>${d.cuenta}</span><span>${Storage.formatMoney(d.monto)}</span></div>`).join('')}
                ${a.haber.map(h => `<div class="asiento-line haber"><span><span class="cuenta-code">${h.codigo}</span>${h.cuenta}</span><span>${Storage.formatMoney(h.monto)}</span></div>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function renderMayor() {
    const cuentas = getLibroMayor();
    document.getElementById('tab-mayor').innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Libro Mayor</h3></div>
        <div class="card-body">
          ${cuentas.map(c => `
            <div style="margin-bottom:24px">
              <h4 style="margin-bottom:8px"><span class="cuenta-code">${c.codigo}</span> ${c.cuenta}</h4>
              <div class="table-wrapper">
                <table>
                  <thead><tr><th>Fecha</th><th>Descripción</th><th>Debe</th><th>Haber</th></tr></thead>
                  <tbody>
                    ${c.movimientos.map(m => `
                      <tr>
                        <td>${Storage.formatDate(m.fecha)}</td>
                        <td>${m.descripcion}</td>
                        <td>${m.debe ? Storage.formatMoney(m.debe) : '-'}</td>
                        <td>${m.haber ? Storage.formatMoney(m.haber) : '-'}</td>
                      </tr>
                    `).join('')}
                    <tr style="font-weight:700;background:var(--gray-50)">
                      <td colspan="2">SALDO</td>
                      <td>${Storage.formatMoney(c.debe)}</td>
                      <td>${Storage.formatMoney(c.haber)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function renderBalance() {
    const balance = getBalanceGeneral();
    document.getElementById('tab-balance').innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Balance General — ${Storage.getConfig().empresa}</h3></div>
        <div class="card-body">
          <div class="balance-grid">
            <div>
              <div class="balance-section">
                <h4>ACTIVO</h4>
                <div class="balance-items">
                  ${balance.activos.map(a => `<div class="balance-item"><span>${a.cuenta}</span><span>${Storage.formatMoney(a.monto)}</span></div>`).join('')}
                  <div class="balance-item total"><span>TOTAL ACTIVO</span><span>${Storage.formatMoney(balance.totalActivos)}</span></div>
                </div>
              </div>
            </div>
            <div>
              <div class="balance-section">
                <h4>PASIVO</h4>
                <div class="balance-items">
                  ${balance.pasivos.map(p => `<div class="balance-item"><span>${p.cuenta}</span><span>${Storage.formatMoney(p.monto)}</span></div>`).join('')}
                  <div class="balance-item total"><span>TOTAL PASIVO</span><span>${Storage.formatMoney(balance.totalPasivos)}</span></div>
                </div>
              </div>
              <div class="balance-section" style="margin-top:16px">
                <h4>PATRIMONIO</h4>
                <div class="balance-items">
                  ${balance.patrimonio.map(p => `<div class="balance-item"><span>${p.cuenta}</span><span>${Storage.formatMoney(p.monto)}</span></div>`).join('')}
                  <div class="balance-item total"><span>TOTAL PATRIMONIO</span><span>${Storage.formatMoney(balance.totalPatrimonio)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderResultados() {
    const estado = getEstadoResultados();
    document.getElementById('tab-resultados').innerHTML = `
      <div class="card estado-resultados">
        <div class="card-header"><h3>Estado de Resultados</h3></div>
        <div class="card-body">
          <div class="balance-section">
            <h4>INGRESOS</h4>
            <div class="balance-items">
              ${estado.ingresos.map(i => `<div class="balance-item ingreso"><span>${i.cuenta}</span><span>${Storage.formatMoney(i.monto)}</span></div>`).join('')}
            </div>
          </div>
          <div class="balance-section" style="margin-top:16px">
            <h4>COSTOS Y GASTOS</h4>
            <div class="balance-items">
              ${estado.costos.map(c => `<div class="balance-item gasto"><span>${c.cuenta}</span><span>${Storage.formatMoney(c.monto)}</span></div>`).join('')}
              ${estado.gastos.map(g => `<div class="balance-item gasto"><span>${g.cuenta}</span><span>${Storage.formatMoney(g.monto)}</span></div>`).join('')}
            </div>
          </div>
          <div class="balance-items" style="margin-top:16px;border:1px solid var(--gray-200);border-radius:var(--radius)">
            <div class="balance-item"><span>Utilidad Bruta</span><span>${Storage.formatMoney(estado.utilidadBruta)}</span></div>
            <div class="balance-item utilidad"><span>UTILIDAD NETA</span><span>${Storage.formatMoney(estado.utilidadNeta)}</span></div>
          </div>
        </div>
      </div>`;
  }

  return {
    crearAsiento, asientoCompra, asientoVenta,
    getLibroDiario, getLibroMayor, getBalanceGeneral, getEstadoResultados,
    getValorInventario, render
  };
})();
