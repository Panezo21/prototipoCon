/**
 * SMARTSTOCK CONTABLE — Importación de facturas de compra (Excel)
 */

const FacturaImport = (() => {

  const COL = {
    proveedor: ['proveedor', 'emisor', 'razon social', 'razón social', 'nombre proveedor', 'supplier'],
    factura: ['factura', 'n factura', 'n° factura', 'no factura', 'numero factura', 'número factura', 'folio', 'serie', 'comprobante', 'nro factura'],
    fecha: ['fecha', 'fecha emision', 'fecha emisión', 'fecha compra', 'issue date'],
    codigo: ['codigo', 'código', 'sku', 'cod', 'cod producto', 'código producto'],
    producto: ['producto', 'descripcion', 'descripción', 'detalle', 'item', 'nombre producto', 'articulo', 'artículo'],
    cantidad: ['cantidad', 'cant', 'cant.', 'qty', 'unidades', 'und'],
    costo: ['costo', 'precio unitario', 'p unitario', 'p. unitario', 'valor unitario', 'precio compra', 'p compra', 'unitario', 'precio'],
    categoria: ['categoria', 'categoría', 'rubro', 'familia'],
    precioVenta: ['precio venta', 'p venta', 'p. venta', 'precio de venta', 'venta'],
    total: ['total', 'importe total', 'monto total', 'total factura']
  };

  function normKey(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function pick(row, group) {
    const map = {};
    Object.keys(row).forEach(k => { map[normKey(k)] = row[k]; });
    for (const alias of COL[group]) {
      if (map[alias] !== undefined && map[alias] !== null && String(map[alias]).trim() !== '') {
        return map[alias];
      }
    }
    for (const key of Object.keys(map)) {
      for (const alias of COL[group]) {
        if (key.includes(alias) && String(map[key]).trim() !== '') return map[key];
      }
    }
    return '';
  }

  function parseFecha(val) {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val)) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const excelSerial = parseFloat(s);
    if (!isNaN(excelSerial) && excelSerial > 30000 && excelSerial < 60000) {
      const d = new Date((excelSerial - 25569) * 86400 * 1000);
      return d.toISOString().slice(0, 10);
    }
    const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      let y = m[3]; if (y.length === 2) y = '20' + y;
      return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return '';
  }

  function parseNum(val) {
    if (typeof val === 'number') return val;
    let s = String(val || '').trim();
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s.replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function filaEsVacia(row) {
    return !Object.values(row).some(v => String(v ?? '').trim() !== '');
  }

  /** Lee cabecera tipo "Proveedor: ABC" en filas superiores del Excel */
  function extraerCabeceraDesdeAoA(aoa) {
    let proveedor = '', factura = '', fecha = '';
    aoa.forEach(row => {
      row.forEach((cell, j) => {
        const label = normKey(cell);
        const valor = row[j + 1] ?? row[j + 2] ?? '';
        if (!label) return;
        if (COL.proveedor.some(a => label.includes(a))) proveedor = String(valor).trim() || proveedor;
        if (COL.factura.some(a => label.includes(a))) factura = String(valor).trim() || factura;
        if (COL.fecha.some(a => label.includes(a))) fecha = parseFecha(valor) || fecha;
      });
    });
    return { proveedor, factura, fecha };
  }

  function sheetToRows(sheet) {
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!aoa.length) return { rows: [], cabecera: {} };

    let headerIdx = aoa.findIndex(row =>
      row.some(cell => {
        const n = normKey(cell);
        return COL.producto.some(a => n.includes(a)) || COL.codigo.some(a => n.includes(a));
      })
    );

    if (headerIdx === -1) {
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      return { rows, cabecera: {} };
    }

    const cabecera = extraerCabeceraDesdeAoA(aoa.slice(0, headerIdx));
    const headers = aoa[headerIdx].map(h => String(h ?? '').trim());
    const rows = [];

    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const rowArr = aoa[i];
      if (!rowArr.some(v => String(v ?? '').trim() !== '')) continue;
      const row = {};
      headers.forEach((h, j) => {
        if (h) row[h] = rowArr[j] ?? '';
      });
      rows.push(row);
    }

    return { rows, cabecera };
  }

  function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const { rows, cabecera } = sheetToRows(sheet);

    if (!rows.length) {
      throw new Error('El Excel está vacío o no tiene el formato esperado. Use la plantilla descargable.');
    }

    let proveedor = cabecera.proveedor || '';
    let factura = cabecera.factura || '';
    let fecha = cabecera.fecha || '';
    const items = [];
    let totalDeclarado = 0;

    rows.forEach(row => {
      if (filaEsVacia(row)) return;

      proveedor = String(pick(row, 'proveedor') || proveedor).trim();
      factura = String(pick(row, 'factura') || factura).trim();
      const f = pick(row, 'fecha');
      if (f) fecha = parseFecha(f) || fecha;

      const codigo = String(pick(row, 'codigo')).trim();
      const descripcion = String(pick(row, 'producto')).trim();
      const cantidadRaw = pick(row, 'cantidad');
      const costoRaw = pick(row, 'costo');
      const categoria = String(pick(row, 'categoria')).trim();
      const precioVentaRaw = pick(row, 'precioVenta');
      const totalFila = parseNum(pick(row, 'total'));

      if (totalFila > 0 && !descripcion && !codigo) {
        totalDeclarado = totalFila;
        return;
      }

      if (!descripcion && !codigo) return;

      const cantidad = Math.max(1, Math.round(parseNum(cantidadRaw) || 1));
      let costo = parseNum(costoRaw);
      if (costo <= 0 && totalFila > 0 && cantidad > 0) costo = totalFila / cantidad;

      items.push({
        descripcion: descripcion || codigo,
        codigo,
        cantidad,
        costo,
        categoria: categoria || 'General',
        precioVenta: parseNum(precioVentaRaw) || Math.round(costo * 1.3 * 100) / 100
      });
    });

    if (!proveedor) throw new Error('Falta la columna Proveedor (o celda de cabecera). Revise la plantilla.');
    if (!factura) throw new Error('Falta la columna Factura (o celda de cabecera). Revise la plantilla.');
    if (!items.length) {
      throw new Error('No se encontraron productos. Use columnas: Código, Producto, Cantidad y Costo.');
    }

    const total = totalDeclarado || items.reduce((s, i) => s + i.cantidad * i.costo, 0);

    return normalizar({
      proveedor,
      factura,
      fecha,
      total,
      items,
      metodo: 'excel',
      advertencias: ['Los productos nuevos se crearán en inventario al registrar. Revise datos antes de guardar.']
    });
  }

  function normalizar(datos) {
    if (!datos.fecha) datos.fecha = Storage.today();
    datos.items = (datos.items || []).filter(i => i.descripcion || i.codigo);
    if (!datos.total) datos.total = datos.items.reduce((s, i) => s + i.cantidad * i.costo, 0);
    return datos;
  }

  function normCodigo(c) {
    return normKey(c).replace(/[^a-z0-9]/g, '');
  }

  function nameScore(descripcion, nombre) {
    const d = normKey(descripcion);
    const n = normKey(nombre);
    if (!d || !n) return 0;
    if (n === d || n.includes(d) || d.includes(n)) return 1;
    const words = d.split(/\s+/).filter(w => w.length > 2);
    if (!words.length) return 0;
    return words.filter(w => n.includes(w)).length / words.length;
  }

  function buscarProducto(descripcion, codigo, productos) {
    const desc = String(descripcion || '').trim();
    const cod = String(codigo || '').trim();

    if (cod) {
      const nc = normCodigo(cod);
      let match = productos.find(p => normCodigo(p.codigo) === nc);
      if (match) return match;

      match = productos.find(p => normKey(p.codigo) === normKey(cod));
      if (match) return match;

      const numMatch = cod.match(/(\d+)\s*$/);
      if (numMatch) {
        const num = numMatch[1];
        const porNumero = productos.filter(p =>
          normCodigo(p.codigo).endsWith(num) || p.codigo.replace(/\D/g, '').endsWith(num)
        );
        if (porNumero.length === 1) {
          if (!desc || nameScore(desc, porNumero[0].nombre) >= 0.2) return porNumero[0];
        }
        if (porNumero.length > 1 && desc) {
          let best = null, bestScore = 0;
          porNumero.forEach(p => {
            const s = nameScore(desc, p.nombre);
            if (s > bestScore) { bestScore = s; best = p; }
          });
          if (bestScore >= 0.25) return best;
        }
      }
    }

    if (desc) {
      let best = null, bestScore = 0;
      productos.forEach(p => {
        const s = nameScore(desc, p.nombre);
        if (s > bestScore) { bestScore = s; best = p; }
      });
      if (bestScore >= 0.5) return best;
    }

    return null;
  }

  function emparejarItems(datos) {
    const productos = Storage.getProductos();
    datos.proveedorEsNuevo = datos.proveedor
      ? !Storage.getProveedores().some(p =>
          p.toLowerCase() === String(datos.proveedor).trim().toLowerCase())
      : false;

    datos.items = datos.items.map(item => {
      const codigoExcel = String(item.codigo || '').trim();
      const matchExacto = codigoExcel
        ? productos.find(p => normCodigo(p.codigo) === normCodigo(codigoExcel))
        : null;

      return {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        costo: item.costo,
        categoria: item.categoria || 'General',
        precioVenta: item.precioVenta || Math.round(item.costo * 1.3 * 100) / 100,
        productoId: matchExacto?.id || '',
        productoNombre: matchExacto?.nombre || item.descripcion,
        codigo: codigoExcel,
        codigoExcel,
        vinculado: !!matchExacto,
        esNuevo: !matchExacto
      };
    });
    return datos;
  }

  function procesarArchivo(file) {
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      throw new Error('Solo se aceptan archivos Excel (.xlsx o .xls). Descargue la plantilla.');
    }
    return file.arrayBuffer().then(buffer => emparejarItems(parseExcel(buffer)));
  }

  function descargarPlantilla() {
    const wb = XLSX.utils.book_new();
    const data = [
      ['Proveedor', 'Factura', 'Fecha', 'Código', 'Producto', 'Cantidad', 'Costo', 'Categoría', 'Precio Venta'],
      ['Distribuidora XYZ Ltda.', 'F002-550', '2025-06-15', 'CMP-001', 'Mouse inalámbrico', 20, 12.50, 'Tecnología', 18.00],
      ['Distribuidora XYZ Ltda.', 'F002-550', '2025-06-15', 'CMP-002', 'Teclado mecánico', 10, 35.00, 'Tecnología', 49.00],
      ['Distribuidora XYZ Ltda.', 'F002-550', '2025-06-15', 'CMP-003', 'Webcam HD 1080p', 8, 45.00, 'Tecnología', 65.00]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Factura Compra');
    XLSX.writeFile(wb, 'plantilla_compra_contavi.xlsx');
  }

  const formatoLabel = { excel: 'Excel' };

  return { procesarArchivo, descargarPlantilla, formatoLabel };
})();
