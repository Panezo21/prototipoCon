/**
 * SMARTSTOCK CONTABLE — Dashboard
 * Estadísticas, gráficos y alertas de inventario
 */

const Dashboard = (() => {
  let charts = {};

  function getStats() {
    const productos = Storage.getProductos();
    const compras = Storage.getCompras();
    const ventas = Storage.getVentas();

    const activos = productos.filter(p => p.stock > 0).length;
    const agotados = productos.filter(p => p.stock <= 0).length;
    const stockTotal = productos.reduce((s, p) => s + p.stock, 0);

    const comprasMes = compras.filter(c => Storage.isCurrentMonth(c.fecha)).reduce((s, c) => s + c.total, 0);
    const ventasMes = ventas.filter(v => Storage.isCurrentMonth(v.fecha)).reduce((s, v) => s + v.total, 0);
    const utilidadMes = ventas.filter(v => Storage.isCurrentMonth(v.fecha)).reduce((s, v) => s + (v.utilidad || 0), 0);

    const alertas = productos.filter(p => Storage.getStockStatus(p) !== 'saludable');

    return { productos, activos, agotados, stockTotal, comprasMes, ventasMes, utilidadMes, alertas, compras, ventas };
  }

  function getMonthlyData(compras, ventas) {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        month: d.getMonth(),
        year: d.getFullYear()
      });
    }

    const ventasData = months.map(m => {
      return ventas.filter(v => {
        const d = new Date(v.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      }).reduce((s, v) => s + v.total, 0);
    });

    const comprasData = months.map(m => {
      return compras.filter(c => {
        const d = new Date(c.fecha);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      }).reduce((s, c) => s + c.total, 0);
    });

    return { labels: months.map(m => m.label), ventasData, comprasData };
  }

  function getTopProductos(ventas) {
    const counts = {};
    ventas.forEach(v => {
      v.items.forEach(item => {
        counts[item.productoNombre] = (counts[item.productoNombre] || 0) + item.cantidad;
      });
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { labels: sorted.map(s => s[0]), data: sorted.map(s => s[1]) };
  }

  function getCategorias(productos) {
    const counts = {};
    productos.forEach(p => {
      counts[p.categoria] = (counts[p.categoria] || 0) + 1;
    });
    return { labels: Object.keys(counts), data: Object.values(counts) };
  }

  function render() {
    const container = document.getElementById('module-dashboard');
    const stats = getStats();
    const monthly = getMonthlyData(stats.compras, stats.ventas);
    const topProd = getTopProductos(stats.ventas);
    const categorias = getCategorias(stats.productos);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Resumen general del inventario y contabilidad</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon"><i class="fas fa-box"></i></div>
          <div class="stat-info">
            <h4>Total Productos</h4>
            <div class="stat-value">${stats.productos.length}</div>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
          <div class="stat-info">
            <h4>Productos Activos</h4>
            <div class="stat-value">${stats.activos}</div>
          </div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon"><i class="fas fa-exclamation-circle"></i></div>
          <div class="stat-info">
            <h4>Productos Agotados</h4>
            <div class="stat-value">${stats.agotados}</div>
          </div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon"><i class="fas fa-warehouse"></i></div>
          <div class="stat-info">
            <h4>Stock Total</h4>
            <div class="stat-value">${stats.stockTotal.toLocaleString()}</div>
          </div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-icon"><i class="fas fa-shopping-cart"></i></div>
          <div class="stat-info">
            <h4>Compras del Mes</h4>
            <div class="stat-value">${Storage.formatMoney(stats.comprasMes)}</div>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><i class="fas fa-cash-register"></i></div>
          <div class="stat-info">
            <h4>Ventas del Mes</h4>
            <div class="stat-value">${Storage.formatMoney(stats.ventasMes)}</div>
          </div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
          <div class="stat-info">
            <h4>Utilidad Estimada</h4>
            <div class="stat-value">${Storage.formatMoney(stats.utilidadMes)}</div>
          </div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon"><i class="fas fa-bell"></i></div>
          <div class="stat-info">
            <h4>Alertas Inventario</h4>
            <div class="stat-value">${stats.alertas.length}</div>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3><i class="fas fa-chart-bar"></i> Ventas Mensuales</h3>
          <div class="chart-container"><canvas id="chartVentas"></canvas></div>
        </div>
        <div class="chart-card">
          <h3><i class="fas fa-chart-bar"></i> Compras Mensuales</h3>
          <div class="chart-container"><canvas id="chartCompras"></canvas></div>
        </div>
        <div class="chart-card">
          <h3><i class="fas fa-trophy"></i> Productos Más Vendidos</h3>
          <div class="chart-container"><canvas id="chartTopProd"></canvas></div>
        </div>
        <div class="chart-card">
          <h3><i class="fas fa-tags"></i> Categorías</h3>
          <div class="chart-container"><canvas id="chartCategorias"></canvas></div>
        </div>
      </div>

      <div class="quick-stats-row">
        <div class="dashboard-alerts">
          <h3><i class="fas fa-traffic-light"></i> Semáforo de Inventario</h3>
          ${stats.alertas.length === 0 ?
            '<p style="color:var(--success);padding:12px"><i class="fas fa-check"></i> Todos los productos tienen stock saludable</p>' :
            stats.alertas.map(p => {
              const status = Storage.getStockStatus(p);
              const emoji = status === 'critico' ? '🔴' : '🟡';
              return `
                <div class="alert-list-item">
                  <span>${emoji}</span>
                  <div>
                    <strong>${p.nombre}</strong>
                    <small>Stock: ${p.stock} / Mínimo: ${p.stockMinimo} — ${status === 'critico' ? 'Stock Crítico' : 'Stock Bajo'}</small>
                  </div>
                </div>`;
            }).join('')}
        </div>
        <div class="dashboard-alerts">
          <h3><i class="fas fa-info-circle"></i> Resumen Contable</h3>
          <div class="alert-list-item">
            <i class="fas fa-wallet" style="color:var(--primary)"></i>
            <div><strong>Valor Inventario</strong><small>${Storage.formatMoney(Contabilidad.getValorInventario())}</small></div>
          </div>
          <div class="alert-list-item">
            <i class="fas fa-book" style="color:var(--success)"></i>
            <div><strong>Asientos Contables</strong><small>${Storage.getAsientos().length} registrados</small></div>
          </div>
          <div class="alert-list-item">
            <i class="fas fa-exchange-alt" style="color:var(--warning)"></i>
            <div><strong>Movimientos</strong><small>${Storage.getMovimientos().length} registrados</small></div>
          </div>
        </div>
      </div>
    `;

    renderCharts(monthly, topProd, categorias);
  }

  function renderCharts(monthly, topProd, categorias) {
    // Destruir gráficos anteriores
    Object.values(charts).forEach(c => c?.destroy());
    charts = {};

    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    };

    const ctxVentas = document.getElementById('chartVentas');
    if (ctxVentas) {
      charts.ventas = new Chart(ctxVentas, {
        type: 'bar',
        data: {
          labels: monthly.labels,
          datasets: [{
            label: 'Ventas',
            data: monthly.ventasData,
            backgroundColor: 'rgba(37, 99, 235, 0.7)',
            borderRadius: 6
          }]
        },
        options: { ...chartDefaults, scales: { y: { beginAtZero: true } } }
      });
    }

    const ctxCompras = document.getElementById('chartCompras');
    if (ctxCompras) {
      charts.compras = new Chart(ctxCompras, {
        type: 'bar',
        data: {
          labels: monthly.labels,
          datasets: [{
            label: 'Compras',
            data: monthly.comprasData,
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderRadius: 6
          }]
        },
        options: { ...chartDefaults, scales: { y: { beginAtZero: true } } }
      });
    }

    const ctxTop = document.getElementById('chartTopProd');
    if (ctxTop) {
      charts.topProd = new Chart(ctxTop, {
        type: 'bar',
        data: {
          labels: topProd.labels,
          datasets: [{
            data: topProd.data,
            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
            borderRadius: 6
          }]
        },
        options: { ...chartDefaults, indexAxis: 'y', scales: { x: { beginAtZero: true } } }
      });
    }

    const ctxCat = document.getElementById('chartCategorias');
    if (ctxCat) {
      charts.categorias = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: categorias.labels,
          datasets: [{
            data: categorias.data,
            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
        }
      });
    }
  }

  return { render, getStats };
})();
