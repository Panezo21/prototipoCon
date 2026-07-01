/**
 * SMARTSTOCK CONTABLE — Gestión de Productos
 * CRUD, búsqueda, filtros, paginación, ordenamiento e importación Excel
 */

const Productos = (() => {
  let state = {
    page: 1,
    perPage: 10,
    sortField: 'nombre',
    sortDir: 'asc',
    search: '',
    categoria: ''
  };

  function getCategorias() {
    return Storage.getCategorias();
  }

  function getUnidades() {
    return Storage.getUnidades();
  }

  function getFiltered() {
    let productos = Storage.getProductos();

    if (state.search) {
      const q = state.search.toLowerCase();
      productos = productos.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
      );
    }
    if (state.categoria) {
      productos = productos.filter(p => p.categoria === state.categoria);
    }

    productos.sort((a, b) => {
      let valA = a[state.sortField];
      let valB = b[state.sortField];
      if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
      if (valA < valB) return state.sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return state.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return productos;
  }

  function render() {
    const container = document.getElementById('module-productos');
    const categorias = getCategorias();
    const productos = getFiltered();
    const total = productos.length;
    const start = (state.page - 1) * state.perPage;
    const pageItems = productos.slice(start, start + state.perPage);
    const totalPages = Math.ceil(total / state.perPage) || 1;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Gestión de Productos</h2>
          <p>${Storage.getProductos().length} productos registrados</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btnImportar"><i class="fas fa-file-excel"></i> Importar Excel</button>
          <button class="btn btn-primary" id="btnNuevoProducto"><i class="fas fa-plus"></i> Nuevo Producto</button>
        </div>
      </div>

      <div class="productos-toolbar">
        <div class="productos-search">
          <i class="fas fa-search"></i>
          <input type="text" id="prodSearch" placeholder="Buscar por código, nombre o categoría..." value="${state.search}">
        </div>
        <select class="form-control" id="prodCategoria" style="width:auto">
          <option value="">Todas las categorías</option>
          ${categorias.map(c => `<option value="${c}" ${state.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <a href="#configuracion" class="btn btn-sm btn-secondary" id="btnGestionarCats" title="Gestionar categorías"><i class="fas fa-cog"></i></a>
      </div>

      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th data-sort="codigo">Código <i class="fas fa-sort"></i></th>
                <th data-sort="nombre">Producto <i class="fas fa-sort"></i></th>
                <th data-sort="categoria">Categoría</th>
                <th data-sort="precioCompra">P. Compra</th>
                <th data-sort="precioVenta">P. Venta</th>
                <th data-sort="stock">Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.length === 0 ? `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-box-open"></i><h4>Sin productos</h4></div></td></tr>` :
              pageItems.map(p => {
                const status = Storage.getStockStatus(p);
                return `
                  <tr>
                    <td><span class="product-code">${p.codigo}</span></td>
                    <td><strong>${p.nombre}</strong><br><small style="color:var(--gray-400)">${p.unidad}</small></td>
                    <td><span class="category-tag">${p.categoria}</span></td>
                    <td class="price-cell price-compra">${Storage.formatMoney(p.precioCompra)}</td>
                    <td class="price-cell price-venta">${Storage.formatMoney(p.precioVenta)}</td>
                    <td><strong>${p.stock}</strong> / min: ${p.stockMinimo}</td>
                    <td><span class="stock-badge ${status}"><span class="stock-dot ${status}"></span>${status === 'saludable' ? 'Saludable' : status === 'bajo' ? 'Stock Bajo' : 'Crítico'}</span></td>
                    <td>
                      <div class="table-actions">
                        <button class="btn-icon btn-edit" data-id="${p.id}" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" data-id="${p.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="pagination" style="padding:16px 20px">
          <span class="pagination-info">Mostrando ${start + 1}-${Math.min(start + state.perPage, total)} de ${total}</span>
          <div class="pagination-controls">
            <button ${state.page <= 1 ? 'disabled' : ''} data-page="${state.page - 1}"><i class="fas fa-chevron-left"></i></button>
            ${Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1;
              return `<button class="${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`;
            }).join('')}
            <button ${state.page >= totalPages ? 'disabled' : ''} data-page="${state.page + 1}"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnGestionarCats')?.addEventListener('click', (e) => {
      e.preventDefault();
      App.navigateTo('configuracion');
    });

    bindEvents();
  }

  function bindEvents() {
    document.getElementById('prodSearch')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      state.page = 1;
      render();
    });

    document.getElementById('prodCategoria')?.addEventListener('change', (e) => {
      state.categoria = e.target.value;
      state.page = 1;
      render();
    });

    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (state.sortField === field) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortField = field;
          state.sortDir = 'asc';
        }
        render();
      });
    });

    document.querySelectorAll('.pagination-controls button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.page = parseInt(btn.dataset.page);
        render();
      });
    });

    document.getElementById('btnNuevoProducto')?.addEventListener('click', () => showForm());
    document.getElementById('btnImportar')?.addEventListener('click', showImportModal);

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => showForm(btn.dataset.id));
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteProducto(btn.dataset.id));
    });
  }

  function showForm(id) {
    const producto = id ? Storage.getProductos().find(p => p.id === id) : null;
    const isEdit = !!producto;
    const categorias = getCategorias();
    const unidades = getUnidades();
    const catVal = producto?.categoria || (categorias[0] || 'General');
    const uniVal = producto?.unidad || 'Unidad';

    App.showModal(isEdit ? 'Editar Producto' : 'Nuevo Producto', `
      <form id="formProducto">
        <div class="form-row">
          <div class="form-group">
            <label>Código</label>
            <input type="text" class="form-control" id="prodCodigo" value="${producto?.codigo || ''}" required placeholder="Ej: PRD-001, SKU-A12">
          </div>
          <div class="form-group">
            <label>Nombre</label>
            <input type="text" class="form-control" id="prodNombre" value="${producto?.nombre || ''}" required placeholder="Nombre del producto o servicio">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Categoría <small style="font-weight:400;text-transform:none">(seleccione o escriba nueva)</small></label>
            <input type="text" class="form-control" id="prodCat" list="datalistCategorias" value="${catVal}" required placeholder="Ej: Tecnología, Papelería...">
            <datalist id="datalistCategorias">${Storage.datalistOptions(categorias)}</datalist>
          </div>
          <div class="form-group">
            <label>Unidad de medida <small style="font-weight:400;text-transform:none">(seleccione o escriba nueva)</small></label>
            <input type="text" class="form-control" id="prodUnidad" list="datalistUnidades" value="${uniVal}" placeholder="Ej: Unidad, Kg, Caja...">
            <datalist id="datalistUnidades">${Storage.datalistOptions(unidades)}</datalist>
          </div>
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea class="form-control" id="prodDesc">${producto?.descripcion || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Precio Compra</label>
            <input type="number" step="0.01" class="form-control" id="prodPCompra" value="${producto?.precioCompra || ''}" required>
          </div>
          <div class="form-group">
            <label>Precio Venta</label>
            <input type="number" step="0.01" class="form-control" id="prodPVenta" value="${producto?.precioVenta || ''}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Stock Actual</label>
            <input type="number" class="form-control" id="prodStock" value="${producto?.stock ?? 0}" required>
          </div>
          <div class="form-group">
            <label>Stock Mínimo</label>
            <input type="number" class="form-control" id="prodStockMin" value="${producto?.stockMinimo ?? 10}" required>
          </div>
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btnSaveProducto">${isEdit ? 'Actualizar' : 'Guardar'}</button>
    `, isEdit ? '' : 'modal-lg');

    document.getElementById('btnSaveProducto').addEventListener('click', () => {
      const categoria = Storage.ensureCategoria(document.getElementById('prodCat').value.trim());
      const unidad = Storage.ensureUnidad(document.getElementById('prodUnidad').value.trim() || 'Unidad');

      const data = {
        codigo: document.getElementById('prodCodigo').value.trim(),
        nombre: document.getElementById('prodNombre').value.trim(),
        categoria: categoria || 'General',
        descripcion: document.getElementById('prodDesc').value.trim(),
        precioCompra: parseFloat(document.getElementById('prodPCompra').value),
        precioVenta: parseFloat(document.getElementById('prodPVenta').value),
        stock: parseInt(document.getElementById('prodStock').value),
        stockMinimo: parseInt(document.getElementById('prodStockMin').value),
        unidad
      };

      if (!data.codigo || !data.nombre || !data.categoria || isNaN(data.precioCompra) || isNaN(data.precioVenta)) {
        App.toast('Complete los campos obligatorios', 'error');
        return;
      }

      const productos = Storage.getProductos();
      const dup = productos.find(p => p.codigo === data.codigo && p.id !== id);
      if (dup) {
        App.toast('Ya existe un producto con ese código', 'error');
        return;
      }

      if (isEdit) {
        const idx = productos.findIndex(p => p.id === id);
        productos[idx] = { ...productos[idx], ...data };
      } else {
        productos.push({
          id: Storage.generateId(),
          ...data,
          fechaCreacion: new Date().toISOString()
        });
      }

      Storage.setProductos(productos);
      App.closeModal();
      App.toast(isEdit ? 'Producto actualizado' : 'Producto creado', 'success');
      render();
      App.updateAlerts();
    });
  }

  function deleteProducto(id) {
    const producto = Storage.getProductos().find(p => p.id === id);
    if (!producto) return;

    App.showModal('Eliminar Producto', `
      <p>¿Está seguro de eliminar <strong>${producto.nombre}</strong> (${producto.codigo})?</p>
      <p style="color:var(--gray-500);margin-top:8px">Esta acción no se puede deshacer.</p>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="btnConfirmDelete">Eliminar</button>
    `);

    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
      const productos = Storage.getProductos().filter(p => p.id !== id);
      Storage.setProductos(productos);
      App.closeModal();
      App.toast('Producto eliminado', 'success');
      render();
      App.updateAlerts();
    });
  }

  /** Modal de importación masiva con SheetJS */
  function showImportModal() {
    App.showModal('Importación Masiva de Productos', `
      <div class="import-zone" id="importZone">
        <i class="fas fa-cloud-upload-alt"></i>
        <p>Arrastre un archivo Excel (.xlsx) o haga clic para seleccionar</p>
        <small>Columnas: Código, Producto, Precio Compra, Precio Venta, Stock — opcionales: Categoría, Unidad</small>
        <input type="file" id="importFile" accept=".xlsx,.xls" style="display:none">
      </div>
      <div id="importPreview"></div>
    `, `
      <button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btnConfirmImport" disabled>Importar Productos</button>
    `, 'modal-lg');

    let previewData = [];

    const zone = document.getElementById('importZone');
    const fileInput = document.getElementById('importFile');

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) processFile(e.target.files[0]);
    });

    function processFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const productos = Storage.getProductos();
        previewData = rows.map(row => {
          const codigo = String(row['Código'] || row['Codigo'] || row['codigo'] || '').trim();
          const nombre = String(row['Producto'] || row['producto'] || row['Nombre'] || '').trim();
          const precioCompra = parseFloat(row['Precio Compra'] || row['precioCompra'] || 0);
          const precioVenta = parseFloat(row['Precio Venta'] || row['precioVenta'] || 0);
          const stock = parseInt(row['Stock'] || row['stock'] || 0);
          const categoria = String(row['Categoría'] || row['Categoria'] || row['categoria'] || 'General').trim();
          const unidad = String(row['Unidad'] || row['unidad'] || 'Unidad').trim();

          const existing = productos.find(p => p.codigo === codigo);
          return {
            codigo, nombre, precioCompra, precioVenta, stock, categoria, unidad,
            status: existing ? 'update' : 'new',
            existingId: existing?.id
          };
        }).filter(r => r.codigo && r.nombre);

        const newCount = previewData.filter(r => r.status === 'new').length;
        const updateCount = previewData.filter(r => r.status === 'update').length;

        document.getElementById('importPreview').innerHTML = `
          <div class="import-stats">
            <span class="import-stat new">${newCount} nuevos</span>
            <span class="import-stat update">${updateCount} actualizaciones</span>
            <span class="import-stat duplicate">${previewData.length} total</span>
          </div>
          <div class="import-preview table-wrapper">
            <table>
              <thead><tr><th>Estado</th><th>Código</th><th>Producto</th><th>Categoría</th><th>P. Compra</th><th>P. Venta</th><th>Stock</th></tr></thead>
              <tbody>
                ${previewData.map(r => `
                  <tr>
                    <td><span class="import-stat ${r.status}">${r.status === 'new' ? 'Nuevo' : 'Actualizar'}</span></td>
                    <td>${r.codigo}</td>
                    <td>${r.nombre}</td>
                    <td>${r.categoria}</td>
                    <td>${Storage.formatMoney(r.precioCompra)}</td>
                    <td>${Storage.formatMoney(r.precioVenta)}</td>
                    <td>${r.stock}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;

        document.getElementById('btnConfirmImport').disabled = previewData.length === 0;
      };
      reader.readAsArrayBuffer(file);
    }

    document.getElementById('btnConfirmImport').addEventListener('click', () => {
      const productos = Storage.getProductos();

      previewData.forEach(row => {
        Storage.ensureCategoria(row.categoria);
        Storage.ensureUnidad(row.unidad);

        if (row.status === 'update') {
          const idx = productos.findIndex(p => p.id === row.existingId);
          if (idx !== -1) {
            productos[idx] = {
              ...productos[idx],
              nombre: row.nombre,
              precioCompra: row.precioCompra,
              precioVenta: row.precioVenta,
              stock: row.stock,
              categoria: row.categoria,
              unidad: row.unidad
            };
          }
        } else {
          productos.push({
            id: Storage.generateId(),
            codigo: row.codigo,
            nombre: row.nombre,
            categoria: row.categoria || 'General',
            descripcion: '',
            precioCompra: row.precioCompra,
            precioVenta: row.precioVenta,
            stock: row.stock,
            stockMinimo: 10,
            unidad: row.unidad || 'Unidad',
            fechaCreacion: new Date().toISOString()
          });
        }
      });

      Storage.setProductos(productos);
      App.closeModal();
      App.toast(`${previewData.length} productos importados`, 'success');
      render();
      App.updateAlerts();
    });
  }

  return { render, getFiltered, getCategorias, getUnidades };
})();
