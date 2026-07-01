/**
 * SMARTSTOCK CONTABLE — Configuración Global
 * Categorías, unidades de medida y datos de empresa (cualquier rubro)
 */

const Configuracion = (() => {

  function render() {
    const container = document.getElementById('module-configuracion');
    const config = Storage.getConfig();
    const categorias = Storage.getCategorias();
    const unidades = Storage.getUnidades();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Configuración</h2>
          <p>Catálogos globales para cualquier tipo de negocio o inventario</p>
        </div>
      </div>

      <div class="config-grid">
        <!-- Empresa -->
        <div class="card">
          <div class="card-header"><h3><i class="fas fa-building"></i> Datos de la Empresa</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label>Nombre de la empresa</label>
              <input type="text" class="form-control" id="cfgEmpresa" value="${config.empresa || ''}" placeholder="Ej: Mi Empresa S.A.">
            </div>
            <div class="form-group">
              <label>Moneda</label>
              <select class="form-control" id="cfgMoneda">
                <option value="USD" ${config.moneda === 'USD' ? 'selected' : ''}>USD — Dólar</option>
                <option value="EUR" ${config.moneda === 'EUR' ? 'selected' : ''}>EUR — Euro</option>
                <option value="PEN" ${config.moneda === 'PEN' ? 'selected' : ''}>PEN — Sol peruano</option>
                <option value="MXN" ${config.moneda === 'MXN' ? 'selected' : ''}>MXN — Peso mexicano</option>
                <option value="COP" ${config.moneda === 'COP' ? 'selected' : ''}>COP — Peso colombiano</option>
                <option value="ARS" ${config.moneda === 'ARS' ? 'selected' : ''}>ARS — Peso argentino</option>
                <option value="CLP" ${config.moneda === 'CLP' ? 'selected' : ''}>CLP — Peso chileno</option>
                <option value="GTQ" ${config.moneda === 'GTQ' ? 'selected' : ''}>GTQ — Quetzal</option>
              </select>
            </div>
            <button class="btn btn-primary" id="btnSaveEmpresa"><i class="fas fa-save"></i> Guardar</button>
          </div>
        </div>

        <!-- Categorías -->
        <div class="card">
          <div class="card-header"><h3><i class="fas fa-tags"></i> Categorías de Productos</h3></div>
          <div class="card-body">
            <p class="config-hint">Cree las categorías de su rubro: farmacia, ferretería, ropa, alimentos, etc.</p>
            <div class="config-add-row">
              <input type="text" class="form-control" id="newCategoria" placeholder="Nueva categoría...">
              <button class="btn btn-primary" id="btnAddCategoria"><i class="fas fa-plus"></i></button>
            </div>
            <ul class="config-list" id="listaCategorias">
              ${categorias.length === 0 ? '<li class="config-empty">Sin categorías. Agregue la primera arriba.</li>' :
              categorias.map(c => `
                <li>
                  <span><i class="fas fa-tag"></i> ${c}</span>
                  <button class="btn-icon btn-del-cat" data-cat="${c.replace(/"/g, '&quot;')}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>

        <!-- Unidades -->
        <div class="card">
          <div class="card-header"><h3><i class="fas fa-ruler"></i> Unidades de Medida</h3></div>
          <div class="card-body">
            <p class="config-hint">Unidades para medir stock: kg, litros, cajas, servicios, etc.</p>
            <div class="config-add-row">
              <input type="text" class="form-control" id="newUnidad" placeholder="Nueva unidad...">
              <button class="btn btn-primary" id="btnAddUnidad"><i class="fas fa-plus"></i></button>
            </div>
            <ul class="config-list" id="listaUnidades">
              ${unidades.map(u => `
                <li>
                  <span><i class="fas fa-cube"></i> ${u}</span>
                  <button class="btn-icon btn-del-uni" data-uni="${u.replace(/"/g, '&quot;')}" title="Eliminar"><i class="fas fa-trash"></i></button>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    document.getElementById('btnSaveEmpresa')?.addEventListener('click', () => {
      const config = Storage.getConfig();
      config.empresa = document.getElementById('cfgEmpresa').value.trim() || 'Mi Empresa';
      config.moneda = document.getElementById('cfgMoneda').value;
      Storage.setConfig(config);
      App.toast('Datos de empresa guardados', 'success');
    });

    document.getElementById('btnAddCategoria')?.addEventListener('click', () => {
      const nombre = document.getElementById('newCategoria').value.trim();
      if (!nombre) { App.toast('Escriba un nombre de categoría', 'warning'); return; }
      Storage.addCategoria(nombre);
      document.getElementById('newCategoria').value = '';
      App.toast('Categoría agregada', 'success');
      render();
    });

    document.getElementById('newCategoria')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('btnAddCategoria').click();
    });

    document.querySelectorAll('.btn-del-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = Storage.removeCategoria(btn.dataset.cat);
        if (!r.ok) App.toast(r.error, 'error');
        else { App.toast('Categoría eliminada', 'success'); render(); }
      });
    });

    document.getElementById('btnAddUnidad')?.addEventListener('click', () => {
      const nombre = document.getElementById('newUnidad').value.trim();
      if (!nombre) { App.toast('Escriba una unidad', 'warning'); return; }
      Storage.addUnidad(nombre);
      document.getElementById('newUnidad').value = '';
      App.toast('Unidad agregada', 'success');
      render();
    });

    document.getElementById('newUnidad')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('btnAddUnidad').click();
    });

    document.querySelectorAll('.btn-del-uni').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = Storage.removeUnidad(btn.dataset.uni);
        if (!r.ok) App.toast(r.error, 'error');
        else { App.toast('Unidad eliminada', 'success'); render(); }
      });
    });

  }

  return { render };
})();
