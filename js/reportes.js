/**
 * SMARTSTOCK CONTABLE — Reportes
 * Generación y exportación PDF/Excel de reportes
 */

const Reportes = (() => {

  const REPORT_TYPES = [
    { id: 'inventario', title: 'Inventario', icon: 'fa-box', color: '#2563eb', desc: 'Listado completo de productos con stock y valoración' },
    { id: 'compras', title: 'Compras', icon: 'fa-shopping-cart', color: '#f59e0b', desc: 'Historial de compras realizadas' },
    { id: 'ventas', title: 'Ventas', icon: 'fa-cash-register', color: '#10b981', desc: 'Historial de ventas y utilidades' },
    { id: 'utilidades', title: 'Utilidades', icon: 'fa-chart-line', color: '#8b5cf6', desc: 'Análisis de rentabilidad por producto' },
    { id: 'kardex', title: 'Kardex', icon: 'fa-book', color: '#06b6d4', desc: 'Movimientos valorados de inventario' },
    { id: 'contabilidad', title: 'Contabilidad', icon: 'fa-calculator', color: '#ef4444', desc: 'Libro Diario, Mayor, Balance General y Estado de Resultados' }
  ];

  function render() {
    const container = document.getElementById('module-reportes');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Reportes</h2>
          <p>Generación y exportación de reportes del sistema</p>
        </div>
      </div>

      <div class="reportes-grid">
        ${REPORT_TYPES.map(r => `
          <div class="reporte-card" data-report="${r.id}">
            <div class="reporte-card-icon" style="background:${r.color}15;color:${r.color}">
              <i class="fas ${r.icon}"></i>
            </div>
            <h4>${r.title}</h4>
            <p>${r.desc}</p>
            <div class="reporte-actions">
              <button class="btn btn-sm btn-secondary btn-preview" data-report="${r.id}"><i class="fas fa-eye"></i> Ver</button>
              <button class="btn btn-sm btn-primary btn-export-pdf" data-report="${r.id}"><i class="fas fa-file-pdf"></i> PDF</button>
              <button class="btn btn-sm btn-success btn-export-excel" data-report="${r.id}"><i class="fas fa-file-excel"></i> Excel</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div id="reportPreviewArea"></div>
    `;

    bindEvents();
  }

  function bindEvents() {
    document.querySelectorAll('.btn-preview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPreview(btn.dataset.report);
      });
    });

    document.querySelectorAll('.btn-export-pdf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportPDF(btn.dataset.report);
      });
    });

    document.querySelectorAll('.btn-export-excel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportExcel(btn.dataset.report);
      });
    });
  }

  /** Genera reporte contable completo con todas las secciones */
  function getContabilidadReport() {
    const asientos = Contabilidad.getLibroDiario();
    const mayor = Contabilidad.getLibroMayor();
    const balance = Contabilidad.getBalanceGeneral();
    const estado = Contabilidad.getEstadoResultados();

    // Libro Diario — detalle línea por línea
    const diarioRows = [];
    asientos.forEach(a => {
      a.debe.forEach(d => {
        diarioRows.push([a.fecha, a.descripcion, d.codigo, d.cuenta, d.monto, '', a.tipo]);
      });
      a.haber.forEach(h => {
        diarioRows.push([a.fecha, a.descripcion, h.codigo, h.cuenta, '', h.monto, a.tipo]);
      });
    });

    // Libro Mayor — movimientos por cuenta
    const mayorRows = [];
    mayor.forEach(c => {
      mayorRows.push(['', `— ${c.codigo} ${c.cuenta} —`, '', '', '', '']);
      c.movimientos.forEach(m => {
        mayorRows.push([m.fecha, m.descripcion, '', '', m.debe || '', m.haber || '']);
      });
      mayorRows.push(['', 'SALDO CUENTA', '', '', c.debe, c.haber]);
      mayorRows.push(['', '', '', '', '', '']);
    });

    return {
      title: 'Reporte Contable Integral',
      multiSection: true,
      sections: [
        {
          id: 'diario',
          title: '1. Libro Diario',
          headers: ['Fecha', 'Descripción', 'Código', 'Cuenta', 'Debe', 'Haber', 'Tipo'],
          rows: diarioRows
        },
        {
          id: 'mayor',
          title: '2. Libro Mayor',
          headers: ['Fecha', 'Descripción', 'Código', 'Cuenta', 'Debe', 'Haber'],
          rows: mayorRows
        },
        {
          id: 'balance',
          title: '3. Balance General',
          headers: ['Sección', 'Cuenta', 'Monto'],
          rows: [
            ['ACTIVO', '', ''],
            ...balance.activos.map(a => ['Activo', a.cuenta, a.monto]),
            ['ACTIVO', 'TOTAL ACTIVO', balance.totalActivos],
            ['', '', ''],
            ['PASIVO', '', ''],
            ...balance.pasivos.map(p => ['Pasivo', p.cuenta, p.monto]),
            ['PASIVO', 'TOTAL PASIVO', balance.totalPasivos],
            ['', '', ''],
            ['PATRIMONIO', '', ''],
            ...balance.patrimonio.map(p => ['Patrimonio', p.cuenta, p.monto]),
            ['PATRIMONIO', 'TOTAL PATRIMONIO', balance.totalPatrimonio]
          ]
        },
        {
          id: 'resultados',
          title: '4. Estado de Resultados',
          headers: ['Tipo', 'Cuenta', 'Monto'],
          rows: [
            ['INGRESO', '', ''],
            ...estado.ingresos.map(i => ['Ingreso', i.cuenta, i.monto]),
            ['INGRESO', 'TOTAL INGRESOS', estado.totalIngresos],
            ['', '', ''],
            ['COSTO/GASTO', '', ''],
            ...estado.costos.map(c => ['Costo', c.cuenta, c.monto]),
            ...estado.gastos.map(g => ['Gasto', g.cuenta, g.monto]),
            ['', 'TOTAL COSTOS Y GASTOS', estado.totalCostos],
            ['', '', ''],
            ['', 'UTILIDAD BRUTA', estado.utilidadBruta],
            ['', 'UTILIDAD NETA', estado.utilidadNeta]
          ]
        }
      ]
    };
  }

  /** Genera datos del reporte según tipo */
  function getReportData(type) {
    switch (type) {
      case 'inventario':
        return {
          title: 'Reporte de Inventario',
          headers: ['Código', 'Producto', 'Categoría', 'Stock', 'Mínimo', 'P.Compra', 'P.Venta', 'Valor', 'Estado'],
          rows: Storage.getProductos().map(p => {
            const status = Storage.getStockStatus(p);
            return [p.codigo, p.nombre, p.categoria, p.stock, p.stockMinimo, p.precioCompra, p.precioVenta, p.stock * p.precioCompra, status];
          })
        };

      case 'compras':
        return {
          title: 'Reporte de Compras',
          headers: ['Fecha', 'Factura', 'Proveedor', 'Productos', 'Total'],
          rows: Storage.getCompras().map(c => [c.fecha, c.factura, c.proveedor, c.items.length, c.total])
        };

      case 'ventas':
        return {
          title: 'Reporte de Ventas',
          headers: ['Fecha', 'Cliente', 'Productos', 'Total', 'Utilidad'],
          rows: Storage.getVentas().map(v => [v.fecha, v.cliente, v.items.length, v.total, v.utilidad || 0])
        };

      case 'utilidades':
        const utilidades = {};
        Storage.getVentas().forEach(v => {
          v.items.forEach(item => {
            if (!utilidades[item.productoNombre]) {
              utilidades[item.productoNombre] = { vendido: 0, ingreso: 0, costo: 0 };
            }
            utilidades[item.productoNombre].vendido += item.cantidad;
            utilidades[item.productoNombre].ingreso += item.cantidad * item.precio;
            utilidades[item.productoNombre].costo += item.cantidad * (item.costo || 0);
          });
        });
        return {
          title: 'Reporte de Utilidades',
          headers: ['Producto', 'Unidades Vendidas', 'Ingresos', 'Costos', 'Utilidad', 'Margen %'],
          rows: Object.entries(utilidades).map(([nombre, d]) => {
            const util = d.ingreso - d.costo;
            const margen = d.ingreso > 0 ? ((util / d.ingreso) * 100).toFixed(1) : 0;
            return [nombre, d.vendido, d.ingreso, d.costo, util, margen + '%'];
          })
        };

      case 'kardex':
        const movs = Storage.getMovimientos();
        return {
          title: 'Reporte Kardex — Movimientos',
          headers: ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Observaciones'],
          rows: movs.map(m => [m.fecha, m.productoNombre, m.tipo, m.cantidad, m.observaciones])
        };

      case 'contabilidad':
        return getContabilidadReport();

      default:
        return { title: 'Reporte', headers: [], rows: [] };
    }
  }

  function formatCell(cell, header) {
    if (typeof cell === 'number' && cell !== 0 && (
      header?.includes('Monto') || header?.includes('Debe') || header?.includes('Haber') ||
      header?.includes('Total') || header?.includes('UTILIDAD')
    )) {
      return Storage.formatMoney(cell);
    }
    return cell === 0 || cell === '' ? (cell === 0 ? Storage.formatMoney(0) : '') : cell;
  }

  function showPreview(type) {
    const data = getReportData(type);
    const area = document.getElementById('reportPreviewArea');

    // Reporte contable con múltiples secciones
    if (data.multiSection) {
      area.innerHTML = `
        <div class="report-preview">
          <div class="report-preview-header">
            <h2>${data.title}</h2>
            <p>${Storage.getConfig().empresa} — Generado: ${Storage.formatDateTime(new Date().toISOString())}</p>
          </div>
          ${data.sections.map(section => `
            <div class="report-section" style="margin-bottom:32px">
              <h3 style="font-size:16px;font-weight:700;padding:12px 16px;background:var(--gray-800);color:white;border-radius:var(--radius) var(--radius) 0 0;margin:0">${section.title}</h3>
              <div class="table-wrapper" style="border:1px solid var(--gray-200);border-top:none;border-radius:0 0 var(--radius) var(--radius)">
                <table>
                  <thead><tr>${section.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                  <tbody>
                    ${section.rows.length === 0 ? `<tr><td colspan="${section.headers.length}">Sin datos</td></tr>` :
                    section.rows.map(row => {
                      const isTotal = String(row[1] || '').includes('TOTAL') || String(row[1] || '').includes('UTILIDAD') || String(row[1] || '').includes('SALDO');
                      return `<tr style="${isTotal ? 'font-weight:700;background:var(--gray-50)' : ''}">${row.map((cell, i) =>
                        `<td>${formatCell(cell, section.headers[i])}</td>`
                      ).join('')}</tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('')}
        </div>`;
      area.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    area.innerHTML = `
      <div class="report-preview">
        <div class="report-preview-header">
          <h2>${data.title}</h2>
          <p>${Storage.getConfig().empresa} — Generado: ${Storage.formatDateTime(new Date().toISOString())}</p>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
              ${data.rows.length === 0 ? `<tr><td colspan="${data.headers.length}">Sin datos</td></tr>` :
              data.rows.map(row => {
                return `<tr>${row.map((cell, i) => {
                  // Semáforo en columna estado del inventario
                  if (type === 'inventario' && i === 8) {
                    const cls = cell === 'saludable' ? 'saludable' : cell === 'bajo' ? 'bajo' : 'critico';
                    return `<td><span class="stock-badge ${cls}">${cell === 'saludable' ? '🟢 Saludable' : cell === 'bajo' ? '🟡 Bajo' : '🔴 Crítico'}</span></td>`;
                  }
                  if (typeof cell === 'number' && (data.headers[i]?.includes('Total') || data.headers[i]?.includes('Precio') || data.headers[i]?.includes('Valor') || data.headers[i]?.includes('Ingreso') || data.headers[i]?.includes('Costo') || data.headers[i]?.includes('Utilidad') || data.headers[i]?.includes('Debe') || data.headers[i]?.includes('Haber'))) {
                    return `<td>${Storage.formatMoney(cell)}</td>`;
                  }
                  return `<td>${cell}</td>`;
                }).join('')}</tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    area.scrollIntoView({ behavior: 'smooth' });
  }

  /** Exporta reporte a PDF con jsPDF */
  function exportPDF(type) {
    const data = getReportData(type);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    if (data.multiSection) {
      data.sections.forEach((section, idx) => {
        if (idx > 0) doc.addPage();
        doc.setFontSize(14);
        doc.text(data.title, 14, 18);
        doc.setFontSize(11);
        doc.text(section.title, 14, 26);
        doc.setFontSize(9);
        doc.text(`${Storage.getConfig().empresa} — ${Storage.formatDateTime(new Date().toISOString())}`, 14, 32);

        doc.autoTable({
          head: [section.headers],
          body: section.rows.map(row => row.map((cell, i) => formatCell(cell, section.headers[i]))),
          startY: 38,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [37, 99, 235] }
        });
      });
    } else {
      doc.setFontSize(16);
      doc.text(data.title, 14, 20);
      doc.setFontSize(10);
      doc.text(`${Storage.getConfig().empresa} — ${Storage.formatDateTime(new Date().toISOString())}`, 14, 28);

      doc.autoTable({
        head: [data.headers],
        body: data.rows.map(row => row.map((cell, i) => formatCell(cell, data.headers[i]))),
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] }
      });
    }

    doc.save(`ContaVI_${type}_${Storage.today()}.pdf`);
    App.toast('PDF exportado correctamente', 'success');
  }

  /** Exporta reporte a Excel con SheetJS */
  function exportExcel(type) {
    const data = getReportData(type);
    const wb = XLSX.utils.book_new();

    if (data.multiSection) {
      data.sections.forEach(section => {
        const wsData = [section.headers, ...section.rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const sheetName = section.title.replace(/^\d+\.\s*/, '').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
    } else {
      const wsData = [data.headers, ...data.rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, data.title.substring(0, 31));
    }

    XLSX.writeFile(wb, `ContaVI_${type}_${Storage.today()}.xlsx`);
    App.toast('Excel exportado correctamente', 'success');
  }

  return { render, getReportData, exportPDF, exportExcel };
})();
