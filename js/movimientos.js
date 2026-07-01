/**
 * SMARTSTOCK CONTABLE — Movimientos de Inventario
 * Registra entradas, salidas, ajustes y correcciones automáticamente
 */

const Movimientos = (() => {

  /** Registra un nuevo movimiento de inventario */
  function registrar(datos) {
    const movimientos = Storage.getMovimientos();
    const now = new Date();

    const movimiento = {
      id: Storage.generateId(),
      fecha: datos.fecha || Storage.today(),
      hora: datos.hora || now.toTimeString().split(' ')[0],
      productoId: datos.productoId,
      productoNombre: datos.productoNombre,
      tipo: datos.tipo, // entrada | salida | ajuste | correccion
      cantidad: datos.cantidad,
      observaciones: datos.observaciones || '',
      referenciaId: datos.referenciaId || null
    };

    movimientos.unshift(movimiento);
    Storage.setMovimientos(movimientos);
    return movimiento;
  }

  /** Registra entrada por compra */
  function registrarEntrada(productoId, productoNombre, cantidad, referenciaId, obs) {
    return registrar({
      productoId, productoNombre, cantidad,
      tipo: 'entrada',
      referenciaId,
      observaciones: obs || 'Entrada por compra'
    });
  }

  /** Registra salida por venta */
  function registrarSalida(productoId, productoNombre, cantidad, referenciaId, obs) {
    return registrar({
      productoId, productoNombre, cantidad,
      tipo: 'salida',
      referenciaId,
      observaciones: obs || 'Salida por venta'
    });
  }

  /** Registra ajuste manual de inventario */
  function registrarAjuste(productoId, productoNombre, cantidad, observaciones) {
    Storage.updateProductoStock(productoId, cantidad, 'add');
    return registrar({
      productoId, productoNombre, cantidad,
      tipo: 'ajuste',
      observaciones: observaciones || 'Ajuste manual de inventario'
    });
  }

  /** Obtiene movimientos filtrados */
  function filtrar(filtros = {}) {
    let movimientos = Storage.getMovimientos();

    if (filtros.tipo) {
      movimientos = movimientos.filter(m => m.tipo === filtros.tipo);
    }
    if (filtros.productoId) {
      movimientos = movimientos.filter(m => m.productoId === filtros.productoId);
    }
    if (filtros.fechaDesde) {
      movimientos = movimientos.filter(m => m.fecha >= filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
      movimientos = movimientos.filter(m => m.fecha <= filtros.fechaHasta);
    }
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase();
      movimientos = movimientos.filter(m =>
        m.productoNombre.toLowerCase().includes(q) ||
        m.observaciones.toLowerCase().includes(q)
      );
    }

    return movimientos;
  }

  /** Obtiene movimientos de un producto específico */
  function getByProducto(productoId) {
    return Storage.getMovimientos().filter(m => m.productoId === productoId);
  }

  /** Etiqueta legible del tipo de movimiento */
  function getTipoLabel(tipo) {
    const labels = {
      entrada: { text: 'Entrada', icon: 'fa-arrow-down', color: 'success' },
      salida: { text: 'Salida', icon: 'fa-arrow-up', color: 'danger' },
      ajuste: { text: 'Ajuste', icon: 'fa-wrench', color: 'warning' },
      correccion: { text: 'Corrección', icon: 'fa-edit', color: 'primary' }
    };
    return labels[tipo] || { text: tipo, icon: 'fa-circle', color: 'secondary' };
  }

  /** Renderiza el módulo de movimientos */
  function render() {
    const container = document.getElementById('module-movimientos');
    const productos = Storage.getProductos();
    const movimientos = filtrar();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Movimientos de Inventario</h2>
          <p>Registro automático de entradas, salidas y ajustes</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btnAjusteManual"><i class="fas fa-wrench"></i> Ajuste Manual</button>
        </div>
      </div>

      <div class="filters-bar">
        <input type="text" class="form-control" id="movBusqueda" placeholder="Buscar producto...">
        <select class="form-control" id="movTipo">
          <option value="">Todos los tipos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
          <option value="ajuste">Ajustes</option>
          <option value="correccion">Correcciones</option>
        </select>
        <select class="form-control" id="movProducto">
          <option value="">Todos los productos</option>
          ${productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
        </select>
        <input type="date" class="form-control" id="movFechaDesde" placeholder="Desde">
        <input type="date" class="form-control" id="movFechaHasta" placeholder="Hasta">
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody id="movimientosTableBody">
              ${renderTableRows(movimientos)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindEvents();
  }

  function renderTableRows(movimientos) {
    if (movimientos.length === 0) {
      return `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exchange-alt"></i><h4>Sin movimientos</h4><p>No hay movimientos registrados con los filtros actuales</p></div></td></tr>`;
    }

    return movimientos.map(m => {
      const tipoInfo = getTipoLabel(m.tipo);
      return `
        <tr>
          <td>${Storage.formatDate(m.fecha)}</td>
          <td>${m.hora || '-'}</td>
          <td><strong>${m.productoNombre}</strong></td>
          <td><span class="stock-badge ${tipoInfo.color === 'success' ? 'saludable' : tipoInfo.color === 'danger' ? 'critico' : 'bajo'}"><i class="fas ${tipoInfo.icon}"></i> ${tipoInfo.text}</span></td>
          <td><strong>${m.cantidad}</strong></td>
          <td>${m.observaciones || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  function bindEvents() {
    const filtros = ['movBusqueda', 'movTipo', 'movProducto', 'movFechaDesde', 'movFechaHasta'];
    filtros.forEach(id => {
      document.getElementById(id)?.addEventListener('change', applyFilters);
      document.getElementById(id)?.addEventListener('input', applyFilters);
    });

    document.getElementById('btnAjusteManual')?.addEventListener('click', showAjusteModal);
  }

  function applyFilters() {
    const filtros = {
      busqueda: document.getElementById('movBusqueda')?.value,
      tipo: document.getElementById('movTipo')?.value,
      productoId: document.getElementById('movProducto')?.value,
      fechaDesde: document.getElementById('movFechaDesde')?.value,
      fechaHasta: document.getElementById('movFechaHasta')?.value
    };
    const movimientos = filtrar(filtros);
    document.getElementById('movimientosTableBody').innerHTML = renderTableRows(movimientos);
  }

  function showAjusteModal() {
    const productos = Storage.getProductos();
    App.showModal('Ajuste Manual de Inventario', `
      <form id="formAjuste">
        <div class="form-group">
          <label>Producto</label>
          <select class="form-control" id="ajusteProducto" required>
            <option value="">Seleccionar producto</option>
            ${productos.map(p => `<option value="${p.id}" data-nombre="${p.nombre}">${p.nombre} (Stock: ${p.stock})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Cantidad a ajustar (+/-)</label>
          <input type="number" class="form-control" id="ajusteCantidad" required placeholder="Ej: 10 o -5">
        </div>
        <div class="form-group">
          <label>Observaciones</label>
          <textarea class="form-control" id="ajusteObs" placeholder="Motivo del ajuste"></textarea>
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btnGuardarAjuste">Registrar Ajuste</button>
    `);

    document.getElementById('btnGuardarAjuste').addEventListener('click', () => {
      const select = document.getElementById('ajusteProducto');
      const productoId = select.value;
      const productoNombre = select.options[select.selectedIndex]?.dataset.nombre;
      const cantidad = parseInt(document.getElementById('ajusteCantidad').value);
      const obs = document.getElementById('ajusteObs').value;

      if (!productoId || isNaN(cantidad)) {
        App.toast('Complete todos los campos', 'error');
        return;
      }

      registrarAjuste(productoId, productoNombre, cantidad, obs);
      App.closeModal();
      App.toast('Ajuste registrado correctamente', 'success');
      render();
    });
  }

  return {
    registrar, registrarEntrada, registrarSalida, registrarAjuste,
    filtrar, getByProducto, getTipoLabel, render
  };
})();
