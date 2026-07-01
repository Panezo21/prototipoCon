/**
 * CONTA PyME — Aplicación Principal
 * Navegación SPA, modales, toasts y coordinación de módulos
 */

const APP_BRAND = {
  name: 'ContaVI',
  slogan: 'Inventario, ventas y contabilidad para pequeños negocios',
  short: 'Contabilidad · VI Semestre',
  academic: 'Prototipo académico · Carrera de Contabilidad'
};

const App = (() => {
  const MODULES = {
    dashboard: { title: 'Dashboard', render: () => Dashboard.render() },
    productos: { title: 'Productos', render: () => Productos.render() },
    compras: { title: 'Compras', render: () => Compras.render() },
    ventas: { title: 'Ventas', render: () => Ventas.render() },
    movimientos: { title: 'Movimientos', render: () => Movimientos.render() },
    kardex: { title: 'Kardex', render: () => Kardex.render() },
    contabilidad: { title: 'Contabilidad', render: () => Contabilidad.render() },
    reportes: { title: 'Reportes', render: () => Reportes.render() },
    prediccion: { title: 'Predicción IA', render: () => Prediccion.render() },
    configuracion: { title: 'Configuración', render: () => Configuracion.render() }
  };

  let currentModule = 'dashboard';

  /** Inicializa la aplicación */
  function init() {
    Storage.initDemoData();
    bindNavigation();
    bindSidebar();
    bindModal();
    bindAlerts();
    bindGlobalSearch();
    Chatbot.init();
    navigateTo('dashboard');
    updateAlerts();
  }

  /** Navega a un módulo específico */
  function navigateTo(moduleName) {
    if (!MODULES[moduleName]) return;

    currentModule = moduleName;

    // Actualizar nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.module === moduleName);
    });

    // Mostrar módulo
    document.querySelectorAll('.module').forEach(mod => mod.classList.remove('active'));
    document.getElementById('module-' + moduleName)?.classList.add('active');

    // Actualizar título
    document.getElementById('pageTitle').textContent = MODULES[moduleName].title;

    // Renderizar módulo
    MODULES[moduleName].render();

    // Cerrar sidebar en móvil
    closeSidebar();

    // Actualizar hash
    window.location.hash = moduleName;
  }

  function bindNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.module);
      });
    });

    // Navegación por hash
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (MODULES[hash] && hash !== currentModule) {
        navigateTo(hash);
      }
    });

    // Hash inicial
    const initialHash = window.location.hash.replace('#', '');
    if (MODULES[initialHash]) {
      currentModule = initialHash;
    }
  }

  function bindSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.getElementById('mainWrapper');
    const overlay = document.getElementById('sidebarOverlay');

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      } else {
        sidebar.classList.toggle('collapsed');
        mainWrapper.classList.toggle('expanded');
      }
    });

    document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click', closeSidebar);
  }

  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
  }

  function bindModal() {
    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  /** Muestra modal genérico */
  function showModal(title, body, footer, sizeClass) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalFooter').innerHTML = footer || '';

    modal.className = 'modal' + (sizeClass ? ' ' + sizeClass : '');
    document.getElementById('modalOverlay').classList.add('active');
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  }

  /** Toast notifications */
  function toast(message, type = 'info', durationMs = 3500) {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(div);

    setTimeout(() => {
      div.style.opacity = '0';
      div.style.transform = 'translateX(40px)';
      setTimeout(() => div.remove(), 300);
    }, durationMs);
  }

  /** Panel de alertas de inventario */
  function bindAlerts() {
    document.getElementById('notificationBtn')?.addEventListener('click', () => {
      document.getElementById('alertPanel').classList.toggle('open');
    });
    document.getElementById('alertPanelClose')?.addEventListener('click', () => {
      document.getElementById('alertPanel').classList.remove('open');
    });
  }

  function updateAlerts() {
    const productos = Storage.getProductos();
    const alertas = productos.filter(p => Storage.getStockStatus(p) !== 'saludable');

    document.getElementById('alertBadge').textContent = alertas.length;

    const panelBody = document.getElementById('alertPanelBody');
    if (!panelBody) return;

    if (alertas.length === 0) {
      panelBody.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px"><i class="fas fa-check-circle" style="color:var(--success);font-size:24px;display:block;margin-bottom:8px"></i>Sin alertas de inventario</p>';
      return;
    }

    panelBody.innerHTML = alertas.map(p => {
      const status = Storage.getStockStatus(p);
      const pred = Prediccion.analizarProducto(p);
      return `
        <div class="alert-item ${status}">
          <strong>${status === 'critico' ? '🔴' : '🟡'} ${p.nombre}</strong>
          <small>Stock: ${p.stock} / Mín: ${p.stockMinimo}</small>
          <small style="display:block;margin-top:4px">${pred.mensaje}</small>
        </div>`;
    }).join('');
  }

  /** Búsqueda global de productos */
  function bindGlobalSearch() {
    document.getElementById('globalSearch')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
          navigateTo('productos');
          setTimeout(() => {
            const searchInput = document.getElementById('prodSearch');
            if (searchInput) {
              searchInput.value = query;
              searchInput.dispatchEvent(new Event('input'));
            }
          }, 100);
        }
      }
    });
  }

  // Iniciar cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', init);

  return {
    init, navigateTo, showModal, closeModal, toast, updateAlerts, closeSidebar
  };
})();
