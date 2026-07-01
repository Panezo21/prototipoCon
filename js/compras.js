/**
 * SMARTSTOCK CONTABLE — Módulo de Compras
 * Registra compras, incrementa stock, movimientos y asientos contables
 */

const Compras = (() => {

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function guardarCompra(datos) {
    const total = datos.items.reduce((s, i) => s + i.cantidad * i.costo, 0);
    const compraId = Storage.generateId();

    const compra = {
      id: compraId,
      proveedor: datos.proveedor,
      factura: datos.factura,
      fecha: datos.fecha || Storage.today(),
      items: datos.items,
      total,
      origen: datos.origen || 'manual',
      facturaImagen: datos.facturaImagen || null
    };

    const compras = Storage.getCompras();
    compras.unshift(compra);
    Storage.setCompras(compras);

    compra.items.forEach(item => {
      Storage.updateProductoStock(item.productoId, item.cantidad, 'add');
      Movimientos.registrarEntrada(item.productoId, item.productoNombre, item.cantidad, compraId, `Compra ${compra.factura}`);
    });

    Contabilidad.asientoCompra(compra);
    return compra;
  }

  function render() {
    const container = document.getElementById('module-compras');
    const compras = Storage.getCompras();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Registro de Compras</h2>
          <p>${compras.length} compras registradas</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btnImportarFactura"><i class="fas fa-file-excel"></i> Importar Excel</button>
          <button class="btn btn-primary" id="btnNuevaCompra"><i class="fas fa-plus"></i> Nueva Compra</button>
        </div>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Factura</th>
                <th>Proveedor</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${compras.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-shopping-cart"></i><h4>Sin compras</h4></div></td></tr>` :
              compras.map(c => `
                <tr>
                  <td>${Storage.formatDate(c.fecha)}</td>
                  <td><span class="product-code">${c.factura}</span></td>
                  <td>${c.proveedor}</td>
                  <td>${c.items.length} producto(s)</td>
                  <td><strong>${Storage.formatMoney(c.total)}</strong></td>
                  <td>
                    <button class="btn-icon btn-view-compra" data-id="${c.id}" title="Ver detalle"><i class="fas fa-eye"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btnNuevaCompra')?.addEventListener('click', showForm);
    document.getElementById('btnImportarFactura')?.addEventListener('click', showImportModal);
    document.querySelectorAll('.btn-view-compra').forEach(btn => {
      btn.addEventListener('click', () => viewCompra(btn.dataset.id));
    });
  }

  function showImportModal() {
    App.showModal('Importar Factura Excel', `
      <p class="compra-import-intro">
        Suba un <strong>Excel (.xlsx)</strong> con la factura de compra.
        Si el proveedor o los productos son nuevos, el sistema los <strong>registrará automáticamente</strong>.
      </p>
      <div class="import-zone" id="facturaImportZone">
        <i class="fas fa-file-excel"></i>
        <p>Arrastre su archivo Excel o haga clic para seleccionar</p>
        <small>Proveedor, Factura, Fecha, Código, Producto, Cantidad, Costo — opcional: Categoría, Precio Venta</small>
        <input type="file" id="facturaImportFile" accept=".xlsx,.xls" style="display:none">
      </div>
      <p class="compra-import-plantilla">
        <button type="button" class="btn btn-sm btn-secondary" id="btnPlantillaCompra">
          <i class="fas fa-download"></i> Descargar plantilla Excel
        </button>
      </p>
      <div id="facturaImportStatus"></div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
    `, 'modal-lg');

    const zone = document.getElementById('facturaImportZone');
    const fileInput = document.getElementById('facturaImportFile');
    const status = document.getElementById('facturaImportStatus');

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) procesarImport(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) procesarImport(e.target.files[0]);
    });

    document.getElementById('btnPlantillaCompra')?.addEventListener('click', () => {
      FacturaImport.descargarPlantilla();
      App.toast('Plantilla descargada', 'success');
    });

    async function procesarImport(file) {
      status.innerHTML = '<p class="compra-import-loading"><i class="fas fa-spinner fa-spin"></i> Leyendo Excel...</p>';
      zone.style.opacity = '0.5';
      zone.style.pointerEvents = 'none';

      try {
        const datos = await FacturaImport.procesarArchivo(file);
        App.closeModal();
        showImportReview(datos);
      } catch (err) {
        zone.style.opacity = '1';
        zone.style.pointerEvents = '';
        status.innerHTML = `<p class="compra-import-error"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(err.message)}</p>`;
      }
    }
  }

  function showImportReview(datos) {
    const categorias = Storage.getCategorias();

    const itemsHtml = datos.items.length ? datos.items.map((item) => {
      const hintVinculado = item.vinculado
        ? `<small class="import-item-hint import-item-vinculado">✓ Código ${escapeHtml(item.codigoExcel)} ya existe — se sumará stock al producto actual</small>`
        : `<small class="import-item-hint">Se creará como producto nuevo en inventario</small>`;

      return `
      <tr class="import-row-nuevo" data-vinculado="${item.vinculado ? '1' : '0'}" data-producto-id="${item.productoId || ''}">
        <td>
          <span class="import-badge-nuevo">${item.vinculado ? 'Producto existente' : 'Producto nuevo'}</span>
          <div class="import-nuevo-fields">
            <input type="text" class="form-control import-nuevo-codigo" value="${escapeHtml(item.codigoExcel)}" placeholder="Código" title="Código">
            <input type="text" class="form-control import-nuevo-nombre" value="${escapeHtml(item.descripcion)}" placeholder="Nombre del producto" title="Nombre">
            <input type="text" class="form-control import-nuevo-cat" value="${escapeHtml(item.categoria)}" placeholder="Categoría" list="importCats" title="Categoría">
            <input type="number" step="0.01" class="form-control import-nuevo-pventa" value="${item.precioVenta}" placeholder="P. venta" title="Precio venta">
          </div>
          ${hintVinculado}
        </td>
        <td><input type="number" class="form-control import-item-cant" value="${item.cantidad}" min="1"></td>
        <td><input type="number" step="0.01" class="form-control import-item-costo" value="${item.costo}"></td>
        <td class="import-item-sub">${Storage.formatMoney(item.cantidad * item.costo)}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" class="import-empty">No se detectaron productos en el Excel.</td></tr>`;

    const proveedorBadge = datos.proveedorEsNuevo
      ? '<span class="import-badge-nuevo import-badge-proveedor">Proveedor nuevo</span>' : '';

    const warnHtml = (datos.advertencias || []).length
      ? `<div class="compra-import-warn">${datos.advertencias.map(w => `<span>${escapeHtml(w)}</span>`).join('')}</div>` : '';

    App.showModal('Revisar factura importada', `
      ${warnHtml}
      <p class="compra-import-badge"><i class="fas fa-file-excel"></i> Importado desde Excel</p>
      <datalist id="importCats">${categorias.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
      <div class="form-row">
        <div class="form-group">
          <label>Proveedor ${proveedorBadge}</label>
          <input type="text" class="form-control" id="importProveedor" value="${escapeHtml(datos.proveedor)}" placeholder="Proveedor">
          ${datos.proveedorEsNuevo ? '<small class="import-item-hint">Se guardará como proveedor nuevo</small>' : ''}
        </div>
        <div class="form-group">
          <label>N° Factura</label>
          <input type="text" class="form-control" id="importFactura" value="${escapeHtml(datos.factura)}" placeholder="FC-0001">
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" class="form-control" id="importFecha" value="${datos.fecha || Storage.today()}">
        </div>
      </div>
      <div class="table-wrapper compra-import-table">
        <table>
          <thead><tr><th>Producto</th><th>Cant.</th><th>Costo</th><th>Subtotal</th></tr></thead>
          <tbody id="importItemsBody">${itemsHtml}</tbody>
        </table>
      </div>
      <div class="compra-totals">
        <div class="total-label">Total importado</div>
        <div class="total-value" id="importTotalDisplay">${Storage.formatMoney(datos.total)}</div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btnRegistrarImport" ${!datos.items.length ? 'disabled' : ''}><i class="fas fa-save"></i> Registrar Compra</button>
    `, 'modal-lg');

    const tbody = document.getElementById('importItemsBody');

    function updateImportTotal() {
      let total = 0;
      tbody.querySelectorAll('tr').forEach(row => {
        const cant = parseFloat(row.querySelector('.import-item-cant')?.value) || 0;
        const costo = parseFloat(row.querySelector('.import-item-costo')?.value) || 0;
        const sub = cant * costo;
        const subCell = row.querySelector('.import-item-sub');
        if (subCell) subCell.textContent = Storage.formatMoney(sub);
        total += sub;
      });
      document.getElementById('importTotalDisplay').textContent = Storage.formatMoney(total);
    }

    tbody.addEventListener('input', updateImportTotal);

    document.getElementById('btnRegistrarImport')?.addEventListener('click', () => {
      const proveedor = document.getElementById('importProveedor').value.trim();
      const factura = document.getElementById('importFactura').value.trim();
      const fecha = document.getElementById('importFecha').value;

      const { items, nuevos } = resolverItemsImport(tbody);

      if (!proveedor || !factura) {
        App.toast('Complete proveedor y número de factura', 'error');
        return;
      }
      if (!items.length) {
        App.toast('Agregue al menos un producto con nombre válido', 'error');
        return;
      }

      Storage.ensureProveedor(proveedor);
      guardarCompra({ proveedor, factura, fecha, items, origen: 'import-excel' });
      App.closeModal();

      let msg = 'Compra registrada correctamente';
      if (nuevos > 0) msg += ` — ${nuevos} producto(s) nuevo(s) en inventario`;
      if (datos.proveedorEsNuevo) msg += ' — proveedor nuevo registrado';
      App.toast(msg, 'success');
      render();
      App.updateAlerts();
    });
  }

  function resolverItemsImport(tbody) {
    const items = [];
    let nuevos = 0;

    tbody.querySelectorAll('tr.import-row-nuevo').forEach(row => {
      const cantidad = parseInt(row.querySelector('.import-item-cant')?.value) || 1;
      const costo = parseFloat(row.querySelector('.import-item-costo')?.value) || 0;
      const codigo = row.querySelector('.import-nuevo-codigo')?.value.trim() || '';
      const nombre = row.querySelector('.import-nuevo-nombre')?.value.trim() || '';
      const categoria = row.querySelector('.import-nuevo-cat')?.value.trim() || 'General';
      const precioVenta = parseFloat(row.querySelector('.import-nuevo-pventa')?.value) || costo * 1.3;

      if (!nombre) return;

      const existente = codigo
        ? Storage.getProductos().find(p => p.codigo.toLowerCase() === codigo.toLowerCase())
        : null;

      if (existente) {
        items.push({
          productoId: existente.id,
          productoNombre: existente.nombre,
          codigo: existente.codigo,
          cantidad,
          costo
        });
        return;
      }

      const producto = Storage.crearProducto({
        codigo,
        nombre,
        categoria,
        precioCompra: costo,
        precioVenta,
        stock: 0,
        stockMinimo: 5
      });
      nuevos++;
      items.push({
        productoId: producto.id,
        productoNombre: producto.nombre,
        codigo: producto.codigo,
        cantidad,
        costo
      });
    });

    return { items, nuevos };
  }

  function showForm() {
    const productos = Storage.getProductos();
    const proveedores = Storage.getProveedores();

    App.showModal('Nueva Compra', `
      <form id="formCompra">
        <div class="form-row">
          <div class="form-group">
            <label>Proveedor</label>
            <input type="text" class="form-control" id="compraProveedor" required placeholder="Nombre del proveedor" list="listaProveedores">
            <datalist id="listaProveedores">${proveedores.map(p => `<option value="${p.replace(/"/g, '&quot;')}">`).join('')}</datalist>
          </div>
          <div class="form-group">
            <label>N° Factura</label>
            <input type="text" class="form-control" id="compraFactura" required placeholder="FC-0001">
          </div>
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" class="form-control" id="compraFecha" value="${Storage.today()}" required>
          </div>
        </div>

        <div class="compra-items-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h4 style="font-size:14px">Productos</h4>
            <button type="button" class="btn btn-sm btn-secondary" id="btnAddItem"><i class="fas fa-plus"></i> Agregar</button>
          </div>
          <div id="compraItems">
            ${renderItemRow(productos)}
          </div>
          <div class="compra-totals">
            <div class="total-label">Total de la compra</div>
            <div class="total-value" id="compraTotalDisplay">${Storage.formatMoney(0)}</div>
          </div>
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btnSaveCompra"><i class="fas fa-save"></i> Registrar Compra</button>
    `, 'modal-lg');

    bindFormEvents(productos);
  }

  function renderItemRow(productos, selectedId = '', cantidad = 1, costo = '') {
    return `
      <div class="item-row">
        <div class="form-group" style="margin:0">
          <select class="form-control item-producto" required>
            <option value="">Producto...</option>
            ${productos.map(p => `<option value="${p.id}" data-costo="${p.precioCompra}" data-nombre="${p.nombre}" data-codigo="${p.codigo}" ${p.id === selectedId ? 'selected' : ''}>${p.codigo} — ${p.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <input type="number" class="form-control item-cantidad" value="${cantidad}" min="1" placeholder="Cant." required>
        </div>
        <div class="form-group" style="margin:0">
          <input type="number" step="0.01" class="form-control item-costo" value="${costo}" placeholder="Costo unit." required>
        </div>
        <div class="form-group" style="margin:0">
          <input type="text" class="form-control item-subtotal" readonly placeholder="Subtotal">
        </div>
        <button type="button" class="btn-icon btn-remove-item" title="Eliminar"><i class="fas fa-times"></i></button>
      </div>`;
  }

  function bindFormEvents(productos) {
    const itemsContainer = document.getElementById('compraItems');

    function updateTotals() {
      let total = 0;
      itemsContainer.querySelectorAll('.item-row').forEach(row => {
        const cant = parseFloat(row.querySelector('.item-cantidad').value) || 0;
        const costo = parseFloat(row.querySelector('.item-costo').value) || 0;
        const sub = cant * costo;
        row.querySelector('.item-subtotal').value = Storage.formatMoney(sub);
        total += sub;
      });
      document.getElementById('compraTotalDisplay').textContent = Storage.formatMoney(total);
    }

    itemsContainer.addEventListener('change', (e) => {
      if (e.target.classList.contains('item-producto')) {
        const opt = e.target.selectedOptions[0];
        const row = e.target.closest('.item-row');
        if (opt?.dataset.costo) {
          row.querySelector('.item-costo').value = opt.dataset.costo;
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

    document.getElementById('btnAddItem')?.addEventListener('click', () => {
      itemsContainer.insertAdjacentHTML('beforeend', renderItemRow(productos));
    });

    document.getElementById('btnSaveCompra')?.addEventListener('click', () => {
      const proveedor = document.getElementById('compraProveedor').value.trim();
      const factura = document.getElementById('compraFactura').value.trim();
      const fecha = document.getElementById('compraFecha').value;

      const items = [];
      itemsContainer.querySelectorAll('.item-row').forEach(row => {
        const select = row.querySelector('.item-producto');
        const opt = select.selectedOptions[0];
        if (!select.value) return;
        items.push({
          productoId: select.value,
          productoNombre: opt.dataset.nombre,
          codigo: opt.dataset.codigo,
          cantidad: parseInt(row.querySelector('.item-cantidad').value),
          costo: parseFloat(row.querySelector('.item-costo').value)
        });
      });

      if (!proveedor || !factura || items.length === 0) {
        App.toast('Complete todos los campos y agregue productos', 'error');
        return;
      }

      Storage.ensureProveedor(proveedor);
      guardarCompra({ proveedor, factura, fecha, items });
      App.closeModal();
      App.toast('Compra registrada correctamente', 'success');
      render();
      App.updateAlerts();
    });

    updateTotals();
  }

  function viewCompra(id) {
    const compra = Storage.getCompras().find(c => c.id === id);
    if (!compra) return;

    const imagenHtml = compra.facturaImagen
      ? `<div class="compra-factura-imagen"><h4 style="font-size:13px;margin-bottom:10px"><i class="fas fa-image"></i> Imagen de factura</h4><img src="${compra.facturaImagen}" alt="Factura ${escapeHtml(compra.factura)}"></div>`
      : '';

    App.showModal(`Compra ${compra.factura}`, `
      <div class="compra-detail-header">
        <div class="compra-detail-item"><label>Proveedor</label><span>${compra.proveedor}</span></div>
        <div class="compra-detail-item"><label>Factura</label><span>${compra.factura}</span></div>
        <div class="compra-detail-item"><label>Fecha</label><span>${Storage.formatDate(compra.fecha)}</span></div>
        <div class="compra-detail-item"><label>Total</label><span>${Storage.formatMoney(compra.total)}</span></div>
      </div>
      ${imagenHtml}
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Código</th><th>Producto</th><th>Cantidad</th><th>Costo</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${compra.items.map(i => `
              <tr>
                <td>${i.codigo}</td>
                <td>${i.productoNombre}</td>
                <td>${i.cantidad}</td>
                <td>${Storage.formatMoney(i.costo)}</td>
                <td>${Storage.formatMoney(i.cantidad * i.costo)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `, `<button class="btn btn-secondary" onclick="App.closeModal()">Cerrar</button>`, 'modal-lg');
  }

  return { render, guardarCompra };
})();
