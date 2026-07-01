/**
 * SMARTSTOCK CONTABLE — Predicción Inteligente de Stock
 * Analiza ventas históricas y proyecta agotamiento
 */

const Prediccion = (() => {

  /**
   * Calcula predicción de agotamiento para un producto
   * Basado en consumo promedio diario de los últimos 30 días
   */
  function analizarProducto(producto) {
    const ventas = Storage.getVentas();
    const ahora = new Date();
    const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalVendido = 0;
    ventas.forEach(v => {
      const fecha = new Date(v.fecha);
      if (fecha >= hace30) {
        v.items.forEach(item => {
          if (item.productoId === producto.id) {
            totalVendido += item.cantidad;
          }
        });
      }
    });

    const consumoDiario = totalVendido / 30;
    const diasRestantes = consumoDiario > 0 ? Math.ceil(producto.stock / consumoDiario) : Infinity;
    const status = Storage.getStockStatus(producto);

    let mensaje, recomendacion;
    if (producto.stock <= 0) {
      mensaje = 'Producto agotado. Requiere reposición inmediata.';
      recomendacion = `Solicitar ${Math.max(Math.ceil(consumoDiario * 15), producto.stockMinimo)} unidades al proveedor.`;
    } else if (diasRestantes <= 7) {
      mensaje = `Se agotará aproximadamente en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}.`;
      recomendacion = `Reponer ${Math.max(Math.ceil(consumoDiario * 30), producto.stockMinimo)} unidades antes de ${new Date(ahora.getTime() + diasRestantes * 86400000).toLocaleDateString('es-ES')}.`;
    } else if (diasRestantes <= 30) {
      mensaje = `Stock suficiente por ${diasRestantes} días aproximadamente.`;
      recomendacion = 'Programar reposición en las próximas 2 semanas.';
    } else {
      mensaje = 'Stock saludable. No requiere acción inmediata.';
      recomendacion = consumoDiario > 0 ? `Consumo promedio: ${consumoDiario.toFixed(1)} unidades/día.` : 'Sin ventas recientes registradas.';
    }

    return {
      producto,
      stock: producto.stock,
      consumoDiario: consumoDiario.toFixed(1),
      diasRestantes: diasRestantes === Infinity ? '∞' : diasRestantes,
      status,
      mensaje,
      recomendacion
    };
  }

  /** Analiza todos los productos y genera alertas preventivas */
  function analizarTodos() {
    return Storage.getProductos()
      .map(p => analizarProducto(p))
      .sort((a, b) => {
        const order = { critico: 0, bajo: 1, saludable: 2 };
        return order[a.status] - order[b.status];
      });
  }

  function render() {
    const container = document.getElementById('module-prediccion');
    const predicciones = analizarTodos();
    const criticos = predicciones.filter(p => p.status === 'critico').length;
    const bajos = predicciones.filter(p => p.status === 'bajo').length;
    const saludables = predicciones.filter(p => p.status === 'saludable').length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Predicción Inteligente de Stock</h2>
          <p>Análisis basado en ventas históricas y consumo promedio</p>
        </div>
      </div>

      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card green">
          <div class="stat-icon"><i class="fas fa-check"></i></div>
          <div class="stat-info"><h4>Stock Saludable</h4><div class="stat-value">${saludables} 🟢</div></div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-icon"><i class="fas fa-exclamation"></i></div>
          <div class="stat-info"><h4>Stock Bajo</h4><div class="stat-value">${bajos} 🟡</div></div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon"><i class="fas fa-times"></i></div>
          <div class="stat-info"><h4>Stock Crítico</h4><div class="stat-value">${criticos} 🔴</div></div>
        </div>
      </div>

      <div class="prediccion-grid">
        ${predicciones.map(p => {
          const emoji = p.status === 'saludable' ? '🟢' : p.status === 'bajo' ? '🟡' : '🔴';
          return `
            <div class="prediccion-card ${p.status}">
              <h4>${emoji} ${p.producto.nombre}</h4>
              <div class="prediccion-stat"><span>Stock actual</span><strong>${p.stock} unidades</strong></div>
              <div class="prediccion-stat"><span>Consumo diario prom.</span><strong>${p.consumoDiario} u/día</strong></div>
              <div class="prediccion-stat"><span>Días restantes</span><strong>${p.diasRestantes}</strong></div>
              <div class="prediccion-stat"><span>Stock mínimo</span><strong>${p.producto.stockMinimo}</strong></div>
              <div class="prediccion-message ${p.status}">${p.mensaje}</div>
              <div class="recomendacion"><i class="fas fa-lightbulb"></i> ${p.recomendacion}</div>
            </div>`;
        }).join('')}
      </div>
    `;
  }

  return { analizarProducto, analizarTodos, render };
})();
