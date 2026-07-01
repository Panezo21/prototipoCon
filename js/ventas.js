/**
 * SMARTSTOCK CONTABLE — Módulo de Ventas
 * Registra ventas, reduce stock, calcula utilidad y crea asientos contables
 */

const Ventas = (() => {

  function render() {
    const container = document.getElementById('module-ventas');
    const ventas = Storage.getVentas();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Registro de Ventas</h2>
          <p>${ventas.length} ventas registradas</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="btnNuevaVenta"><i class="fas fa-plus"></i> Nueva Venta</button>
        </div>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Utilidad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${ventas.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-cash-register"></i><h4>Sin ventas</h4></div></td></tr>` :
              ventas.map(v => `
                <tr>
                  <td>${Storage.formatDate(v.fecha)}</td>
                  <td>${v.cliente}</td>
                  <td>${v.items.length} producto(s)</td>
                  <td><strong>${Storage.formatMoney(v.total)}</strong></td>
                  <td><span class="utilidad-badge"><i class="fas fa-arrow-up"></i> ${Storage.formatMoney(v.utilidad || 0)}</span></td>
                  <td>
                    <button class="btn-icon btn-view-venta" data-id="${v.id}" title="Ver detalle"><i class="fas fa-eye"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btnNuevaVenta')?.addEventListener('click', showForm);
    document.querySelectorAll('.btn-view-venta').forEach(btn => {
      btn.addEventListener('click', () => viewVenta(btn.dataset.id));
    });
  }

  function showForm() {
    const productos = Storage.getProductos().filter(p => p.stock > 0);

    App.showModal('Nueva Venta', `
      <form id="formVenta">
        <div class="form-row">
          <div class="form-group">
            <label>Cliente</label>
            <input type="text" class="form-control" id="ventaCliente" required placeholder="Nombre del cliente">
          </div>
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" class="form-control" id="ventaFecha" value="${Storage.today()}" required>
          </div>
        </div>

        <div class="compra-items-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h4 style="font-size:14px">Productos</h4>
            <button type="button" class="btn btn-sm btn-secondary" id="btnAddVentaItem"><i class="fas fa-plus"></i> Agregar</button>
          </div>
          <div id="ventaItems">
            ${renderItemRow(productos)}
          </div>
          <div class="venta-summary">
            <div class="summary-box subtotal">
              <label>Subtotal</label>
              <span id="ventaSubtotal">${Storage.formatMoney(0)}</span>
            </div>
            <div class="summary-box utilidad">
              <label>Utilidad Est.</label>
              <span id="ventaUtilidad">${Storage.formatMoney(0)}</span>
            </div>
            <div class="summary-box total">
              <label>Total Venta</label>
              <span id="ventaTotal">${Storage.formatMoney(0)}</span>
            </div>
          </div>
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-success" id="btnSaveVenta"><i class="fas fa-check"></i> Registrar Venta</button>
    `, 'modal-lg');

    bindFormEvents(productos);
  }

  function renderItemRow(productos, selectedId = '', cantidad = 1, precio = '') {
    return `
      <div class="item-row">
        <div class="form-group" style="margin:0">
          <select class="form-control item-producto" required>
            <option value="">Producto...</option>
            ${productos.map(p => `<option value="${p.id}" data-precio="${p.precioVenta}" data-costo="${p.precioCompra}" data-nombre="${p.nombre}" data-codigo="${p.codigo}" data-stock="${p.stock}" ${p.id === selectedId ? 'selected' : ''}>${p.codigo} — ${p.nombre} (Stock: ${p.stock})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <input type="number" class="form-control item-cantidad" value="${cantidad}" min="1" placeholder="Cant." required>
        </div>
        <div class="form-group" style="margin:0">
          <input type="number" step="0.01" class="form-control item-precio" value="${precio}" placeholder="Precio" required>
        </div>
        <div class="form-group" style="margin:0">
          <input type="text" class="form-control item-subtotal" readonly placeholder="Subtotal">
        </div>
        <button type="button" class="btn-icon btn-remove-item" title="Eliminar"><i class="fas fa-times"></i></button>
      </div>`;
  }

  function bindFormEvents(productos) {
    const itemsContainer = document.getElementById('ventaItems');

    function updateTotals() {
      let total = 0, costo = 0;
      itemsContainer.querySelectorAll('.item-row').forEach(row => {
        const cant = parseFloat(row.querySelector('.item-cantidad').value) || 0;
        const precio = parseFloat(row.querySelector('.item-precio').value) || 0;
        const select = row.querySelector('.item-producto');
        const opt = select.selectedOptions[0];
        const costoUnit = parseFloat(opt?.dataset.costo) || 0;
        const sub = cant * precio;
        row.querySelector('.item-subtotal').value = Storage.formatMoney(sub);
        total += sub;
        costo += cant * costoUnit;
      });
      document.getElementById('ventaSubtotal').textContent = Storage.formatMoney(total);
      document.getElementById('ventaTotal').textContent = Storage.formatMoney(total);
      document.getElementById('ventaUtilidad').textContent = Storage.formatMoney(total - costo);
    }

    itemsContainer.addEventListener('change', (e) => {
      if (e.target.classList.contains('item-producto')) {
        const opt = e.target.selectedOptions[0];
        const row = e.target.closest('.item-row');
        if (opt?.dataset.precio) {
          row.querySelector('.item-precio').value = opt.dataset.precio;
        }
        updateTotals();
      }
    });

    itemsContainer.addEventListener('input', updateTotals);

    itemsContainer.addEventListener('click', (e) => {
      if (e.target.closest('.btn-remove-item')) {
        const rows = itemsContainer.querySelectorAll('.item-row');
        if (rows.length > 1) {
          e.target.closest('.item-row').remove();
          updateTotals();
        }
      }
    });

    document.getElementById('btnAddVentaItem')?.addEventListener('click', () => {
      itemsContainer.insertAdjacentHTML('beforeend', renderItemRow(productos));
    });

    document.getElementById('btnSaveVenta')?.addEventListener('click', () => {
      const cliente = document.getElementById('ventaCliente').value.trim();
      const fecha = document.getElementById('ventaFecha').value;

      const items = [];
      let hasStockError = false;

      itemsContainer.querySelectorAll('.item-row').forEach(row => {
        const select = row.querySelector('.item-producto');
        const opt = select.selectedOptions[0];
        if (!select.value) return;

        const cantidad = parseInt(row.querySelector('.item-cantidad').value);
        const stock = parseInt(opt.dataset.stock);
        if (cantidad > stock) {
          App.toast(`Stock insuficiente para ${opt.dataset.nombre}`, 'error');
          hasStockError = true;
          return;
        }

        items.push({
          productoId: select.value,
          productoNombre: opt.dataset.nombre,
          codigo: opt.dataset.codigo,
          cantidad,
          precio: parseFloat(row.querySelector('.item-precio').value),
          costo: parseFloat(opt.dataset.costo)
        });
      });

      if (hasStockError) return;
      if (!cliente || items.length === 0) {
        App.toast('Complete todos los campos', 'error');
        return;
      }

      const total = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
      const costo = items.reduce((s, i) => s + i.cantidad * i.costo, 0);
      const utilidad = total - costo;
      const ventaId = Storage.generateId();

      const venta = { id: ventaId, cliente, fecha, items, total, costo, utilidad };

      const ventas = Storage.getVentas();
      ventas.unshift(venta);
      Storage.setVentas(ventas);

      // Reducir stock y registrar movimientos
      items.forEach(item => {
        Storage.updateProductoStock(item.productoId, item.cantidad, 'subtract');
        Movimientos.registrarSalida(item.productoId, item.productoNombre, item.cantidad, ventaId, `Venta a ${cliente}`);
      });

      // Asiento contable: Debe Caja / Haber Ventas
      Contabilidad.asientoVenta(venta);

      App.closeModal();
      App.toast('Venta registrada correctamente', 'success');
      render();
      App.updateAlerts();
    });

    updateTotals();
  }

  function viewVenta(id) {
    const venta = Storage.getVentas().find(v => v.id === id);
    if (!venta) return;

    App.showModal(`Venta — ${venta.cliente}`, `
      <div class="compra-detail-header">
        <div class="compra-detail-item"><label>Cliente</label><span>${venta.cliente}</span></div>
        <div class="compra-detail-item"><label>Fecha</label><span>${Storage.formatDate(venta.fecha)}</span></div>
        <div class="compra-detail-item"><label>Total</label><span>${Storage.formatMoney(venta.total)}</span></div>
        <div class="compra-detail-item"><label>Utilidad</label><span style="color:var(--success)">${Storage.formatMoney(venta.utilidad)}</span></div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Código</th><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${venta.items.map(i => `
              <tr>
                <td>${i.codigo}</td>
                <td>${i.productoNombre}</td>
                <td>${i.cantidad}</td>
                <td>${Storage.formatMoney(i.precio)}</td>
                <td>${Storage.formatMoney(i.cantidad * i.precio)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `, `<button class="btn btn-secondary" onclick="App.closeModal()">Cerrar</button>`, 'modal-lg');
  }

  return { render };
})();
