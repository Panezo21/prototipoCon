/**
 * SMARTSTOCK CONTABLE — Kardex Automático
 * Implementa PEPS (FIFO) y Promedio Ponderado
 */

const Kardex = (() => {

  /**
   * Construye el kardex de un producto usando el método especificado
   * @param {string} productoId
   * @param {'peps'|'promedio'} metodo
   */
  function calcular(productoId, metodo) {
    const producto = Storage.getProductos().find(p => p.id === productoId);
    if (!producto) return null;

    const movimientos = Storage.getMovimientos()
      .filter(m => m.productoId === productoId)
      .sort((a, b) => {
        const dateA = new Date(a.fecha + 'T' + (a.hora || '00:00:00'));
        const dateB = new Date(b.fecha + 'T' + (b.hora || '00:00:00'));
        return dateA - dateB;
      });

    if (metodo === 'peps') {
      return calcularPEPS(producto, movimientos);
    }
    return calcularPromedio(producto, movimientos);
  }

  /** Método PEPS (FIFO) — Primero en entrar, primero en salir */
  function calcularPEPS(producto, movimientos) {
    const lotes = []; // Cola de lotes: { cantidad, costoUnitario }
    const registros = [];
    let saldoCantidad = 0;
    let saldoTotal = 0;

    movimientos.forEach(mov => {
      const compra = Storage.getCompras().find(c => c.id === mov.referenciaId);
      let costoUnitario = producto.precioCompra;

      if (compra) {
        const item = compra.items.find(i => i.productoId === producto.id);
        if (item) costoUnitario = item.costo;
      }

      if (mov.tipo === 'entrada' || mov.tipo === 'ajuste') {
        const cant = mov.tipo === 'ajuste' ? Math.abs(mov.cantidad) : mov.cantidad;
        if (mov.tipo === 'ajuste' && mov.cantidad < 0) return;

        lotes.push({ cantidad: cant, costoUnitario });
        saldoCantidad += cant;
        saldoTotal += cant * costoUnitario;

        registros.push({
          fecha: mov.fecha,
          hora: mov.hora,
          tipo: 'entrada',
          detalle: mov.observaciones,
          entradaCant: cant,
          entradaCosto: costoUnitario,
          entradaTotal: cant * costoUnitario,
          salidaCant: 0,
          salidaCosto: 0,
          salidaTotal: 0,
          saldoCant: saldoCantidad,
          saldoCosto: saldoCantidad > 0 ? saldoTotal / saldoCantidad : 0,
          saldoTotal: saldoTotal
        });
      } else if (mov.tipo === 'salida') {
        let porSalir = mov.cantidad;
        let costoSalida = 0;

        while (porSalir > 0 && lotes.length > 0) {
          const lote = lotes[0];
          const tomar = Math.min(porSalir, lote.cantidad);
          costoSalida += tomar * lote.costoUnitario;
          lote.cantidad -= tomar;
          porSalir -= tomar;
          if (lote.cantidad <= 0) lotes.shift();
        }

        saldoCantidad -= mov.cantidad;
        saldoTotal -= costoSalida;

        registros.push({
          fecha: mov.fecha,
          hora: mov.hora,
          tipo: 'salida',
          detalle: mov.observaciones,
          entradaCant: 0,
          entradaCosto: 0,
          entradaTotal: 0,
          salidaCant: mov.cantidad,
          salidaCosto: mov.cantidad > 0 ? costoSalida / mov.cantidad : 0,
          salidaTotal: costoSalida,
          saldoCant: saldoCantidad,
          saldoCosto: saldoCantidad > 0 ? saldoTotal / saldoCantidad : 0,
          saldoTotal: saldoTotal
        });
      }
    });

    return { producto, metodo: 'PEPS (FIFO)', registros };
  }

  /** Método Promedio Ponderado */
  function calcularPromedio(producto, movimientos) {
    let saldoCantidad = 0;
    let saldoTotal = 0;
    let costoPromedio = producto.precioCompra;
    const registros = [];

    movimientos.forEach(mov => {
      let costoUnitario = producto.precioCompra;
      const compra = Storage.getCompras().find(c => c.id === mov.referenciaId);
      if (compra) {
        const item = compra.items.find(i => i.productoId === producto.id);
        if (item) costoUnitario = item.costo;
      }

      if (mov.tipo === 'entrada' || (mov.tipo === 'ajuste' && mov.cantidad > 0)) {
        const cant = mov.tipo === 'ajuste' ? mov.cantidad : mov.cantidad;
        saldoTotal += cant * costoUnitario;
        saldoCantidad += cant;
        costoPromedio = saldoCantidad > 0 ? saldoTotal / saldoCantidad : costoUnitario;

        registros.push({
          fecha: mov.fecha,
          hora: mov.hora,
          tipo: 'entrada',
          detalle: mov.observaciones,
          entradaCant: cant,
          entradaCosto: costoUnitario,
          entradaTotal: cant * costoUnitario,
          salidaCant: 0,
          salidaCosto: 0,
          salidaTotal: 0,
          saldoCant: saldoCantidad,
          saldoCosto: costoPromedio,
          saldoTotal: saldoTotal
        });
      } else if (mov.tipo === 'salida') {
        const costoSalida = mov.cantidad * costoPromedio;
        saldoCantidad -= mov.cantidad;
        saldoTotal -= costoSalida;

        registros.push({
          fecha: mov.fecha,
          hora: mov.hora,
          tipo: 'salida',
          detalle: mov.observaciones,
          entradaCant: 0,
          entradaCosto: 0,
          entradaTotal: 0,
          salidaCant: mov.cantidad,
          salidaCosto: costoPromedio,
          salidaTotal: costoSalida,
          saldoCant: saldoCantidad,
          saldoCosto: saldoCantidad > 0 ? costoPromedio : 0,
          saldoTotal: saldoTotal
        });
      }
    });

    return { producto, metodo: 'Promedio Ponderado', registros };
  }

  /** Compara ambos métodos y detecta diferencias */
  function compararMetodos(productoId) {
    const peps = calcular(productoId, 'peps');
    const promedio = calcular(productoId, 'promedio');
    if (!peps || !promedio) return null;

    const saldoPeps = peps.registros.length ? peps.registros[peps.registros.length - 1].saldoTotal : 0;
    const saldoProm = promedio.registros.length ? promedio.registros[promedio.registros.length - 1].saldoTotal : 0;
    const diferencia = Math.abs(saldoPeps - saldoProm);

    // Filas de salida con costo distinto entre métodos
    const filasDiferentes = [];
    peps.registros.forEach((r, i) => {
      const rp = promedio.registros[i];
      if (r.tipo === 'salida' && rp && Math.abs(r.salidaCosto - rp.salidaCosto) > 0.001) {
        filasDiferentes.push(i);
      }
    });

    return { peps, promedio, saldoPeps, saldoProm, diferencia, filasDiferentes, hayDiferencia: diferencia > 0.01 };
  }

  /** Renderiza el módulo Kardex */
  function render() {
    const container = document.getElementById('module-kardex');
    const productos = Storage.getProductos();
    const config = Storage.getConfig();
    const metodo = config.metodoKardex || 'peps';

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Kardex Automático</h2>
          <p>Control de existencias con valoración de inventario</p>
        </div>
      </div>

      <div class="kardex-controls">
        <select class="form-control" id="kardexProducto" style="min-width:280px">
          <option value="">Seleccionar producto...</option>
          ${productos.map(p => `<option value="${p.id}">${p.codigo} — ${p.nombre}</option>`).join('')}
        </select>
        <div class="kardex-method-toggle">
          <button class="${metodo === 'peps' ? 'active' : ''}" data-method="peps">PEPS (FIFO)</button>
          <button class="${metodo === 'promedio' ? 'active' : ''}" data-method="promedio">Promedio Ponderado</button>
        </div>
      </div>

      <div id="kardexContent">
        <div class="kardex-empty">
          <i class="fas fa-book"></i>
          <h4>Seleccione un producto</h4>
          <p>El kardex se generará automáticamente a partir de los movimientos registrados</p>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    document.getElementById('kardexProducto')?.addEventListener('change', (e) => {
      if (e.target.value) renderKardex(e.target.value);
    });

    document.querySelectorAll('.kardex-method-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.kardex-method-toggle button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const config = Storage.getConfig();
        config.metodoKardex = btn.dataset.method;
        Storage.setConfig(config);
        const productoId = document.getElementById('kardexProducto')?.value;
        if (productoId) renderKardex(productoId);
      });
    });
  }

  function renderKardex(productoId) {
    const metodo = document.querySelector('.kardex-method-toggle button.active')?.dataset.method || 'peps';
    const kardex = calcular(productoId, metodo);
    const comparacion = compararMetodos(productoId);
    const content = document.getElementById('kardexContent');

    if (!kardex || kardex.registros.length === 0) {
      content.innerHTML = `
        <div class="kardex-empty">
          <i class="fas fa-book-open"></i>
          <h4>Sin movimientos</h4>
          <p>Este producto no tiene movimientos registrados aún</p>
        </div>`;
      return;
    }

    const { producto, registros } = kardex;
    const ultimo = registros[registros.length - 1];
    const otroMetodo = metodo === 'peps' ? comparacion.promedio : comparacion.peps;

    // Banner comparativo entre métodos
    const bannerComparacion = comparacion ? `
      <div class="kardex-comparison ${comparacion.hayDiferencia ? 'has-diff' : 'no-diff'}">
        <div class="kardex-comparison-title">
          <i class="fas fa-balance-scale"></i> Comparación de métodos de valoración
        </div>
        <div class="kardex-comparison-grid">
          <div class="kardex-comparison-item ${metodo === 'peps' ? 'active' : ''}">
            <label>PEPS (FIFO)</label>
            <span>${Storage.formatMoney(comparacion.saldoPeps)}</span>
            <small>Saldo valorado final</small>
          </div>
          <div class="kardex-comparison-item ${metodo === 'promedio' ? 'active' : ''}">
            <label>Promedio Ponderado</label>
            <span>${Storage.formatMoney(comparacion.saldoProm)}</span>
            <small>Saldo valorado final</small>
          </div>
          <div class="kardex-comparison-item diff">
            <label>Diferencia</label>
            <span>${Storage.formatMoney(comparacion.diferencia)}</span>
            <small>${comparacion.hayDiferencia ? comparacion.filasDiferentes.length + ' salida(s) con costo distinto' : 'Métodos coinciden'}</small>
          </div>
        </div>
        ${comparacion.hayDiferencia
          ? `<p class="kardex-comparison-note"><i class="fas fa-info-circle"></i> Las filas resaltadas en <strong>amarillo</strong> muestran costos de salida diferentes entre FIFO y Promedio. FIFO consume primero los lotes más antigos; Promedio usa el costo promedio acumulado.</p>`
          : `<p class="kardex-comparison-note"><i class="fas fa-info-circle"></i> Los métodos coinciden cuando todas las entradas tienen el mismo costo unitario. Registre compras a distintos precios para ver la diferencia.</p>`
        }
      </div>
    ` : '';

    content.innerHTML = `
      ${bannerComparacion}
      <div class="kardex-sheet">
        <div class="kardex-sheet-header">
          <div>
            <h3>KARDEX VALORADO — ${kardex.metodo}</h3>
            <span>${Storage.getConfig().empresa}</span>
          </div>
          <span>Generado: ${Storage.formatDateTime(new Date().toISOString())}</span>
        </div>
        <div class="kardex-product-info">
          <div class="kardex-info-item"><label>Código</label><span>${producto.codigo}</span></div>
          <div class="kardex-info-item"><label>Producto</label><span>${producto.nombre}</span></div>
          <div class="kardex-info-item"><label>Unidad</label><span>${producto.unidad}</span></div>
          <div class="kardex-info-item"><label>Stock Actual</label><span>${producto.stock}</span></div>
          <div class="kardex-info-item"><label>Saldo Valorado</label><span>${Storage.formatMoney(ultimo.saldoTotal)}</span></div>
        </div>
        <div class="table-wrapper">
          <table class="kardex-table">
            <thead>
              <tr>
                <th rowspan="2">Fecha</th>
                <th rowspan="2">Detalle</th>
                <th colspan="3" class="col-entrada">Entradas</th>
                <th colspan="3" class="col-salida">Salidas</th>
                <th colspan="3" class="col-saldo">Saldo</th>
                ${comparacion?.hayDiferencia ? '<th rowspan="2">Otro método</th>' : ''}
              </tr>
              <tr>
                <th class="col-entrada">Cant.</th>
                <th class="col-entrada">C.U.</th>
                <th class="col-entrada">Total</th>
                <th class="col-salida">Cant.</th>
                <th class="col-salida">C.U.</th>
                <th class="col-salida">Total</th>
                <th class="col-saldo">Cant.</th>
                <th class="col-saldo">C.U.</th>
                <th class="col-saldo">Total</th>
              </tr>
            </thead>
            <tbody>
              ${registros.map((r, idx) => {
                const esDiferente = comparacion?.filasDiferentes.includes(idx);
                const regOtro = otroMetodo?.registros[idx];
                const celdaOtro = esDiferente && regOtro?.tipo === 'salida'
                  ? `<td class="col-diff"><small>${metodo === 'peps' ? 'Prom.' : 'FIFO'}</small><br>${regOtro.salidaCosto.toFixed(2)}</td>`
                  : (comparacion?.hayDiferencia ? '<td></td>' : '');

                return `
                <tr class="${esDiferente ? 'row-diff' : ''}">
                  <td>${Storage.formatDate(r.fecha)}</td>
                  <td style="text-align:left;font-size:11px">${r.detalle || r.tipo}</td>
                  <td class="col-entrada">${r.entradaCant || ''}</td>
                  <td class="col-entrada">${r.entradaCosto ? r.entradaCosto.toFixed(2) : ''}</td>
                  <td class="col-entrada">${r.entradaTotal ? r.entradaTotal.toFixed(2) : ''}</td>
                  <td class="col-salida ${esDiferente ? 'highlight-diff' : ''}">${r.salidaCant || ''}</td>
                  <td class="col-salida ${esDiferente ? 'highlight-diff' : ''}">${r.salidaCosto ? r.salidaCosto.toFixed(2) : ''}</td>
                  <td class="col-salida ${esDiferente ? 'highlight-diff' : ''}">${r.salidaTotal ? r.salidaTotal.toFixed(2) : ''}</td>
                  <td class="col-saldo">${r.saldoCant}</td>
                  <td class="col-saldo">${r.saldoCosto.toFixed(2)}</td>
                  <td class="col-saldo">${r.saldoTotal.toFixed(2)}</td>
                  ${celdaOtro}
                </tr>`;
              }).join('')}
              <tr class="totals-row">
                <td colspan="2">SALDO FINAL</td>
                <td colspan="3"></td>
                <td colspan="3"></td>
                <td class="col-saldo">${ultimo.saldoCant}</td>
                <td class="col-saldo">${ultimo.saldoCosto.toFixed(2)}</td>
                <td class="col-saldo">${ultimo.saldoTotal.toFixed(2)}</td>
                ${comparacion?.hayDiferencia ? `<td class="col-diff">${Storage.formatMoney(metodo === 'peps' ? comparacion.saldoProm : comparacion.saldoPeps)}</td>` : ''}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return { calcular, compararMetodos, render, renderKardex };
})();
