/**
 * SMARTSTOCK CONTABLE — Importación de facturas sin IA
 * Excel, XML, PDF con texto e imágenes (OCR local con Tesseract).
 */

const FacturaImport = (() => {

  let ocrWorker = null;
  let progressCallback = null;

  function normKey(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function pick(row, keys) {
    const map = {};
    Object.keys(row).forEach(k => { map[normKey(k)] = row[k]; });
    for (const k of keys) {
      const v = map[normKey(k)];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }

  function parseFecha(val) {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val)) {
      return val.toISOString().slice(0, 10);
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
    const s = String(val || '').replace(/[^\d.,\-]/g, '').replace(/,/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /** Excel: una fila por ítem; columnas de cabecera repetidas o en la primera fila */
  function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    if (!rows.length) throw new Error('El Excel está vacío');

    let proveedor = '';
    let factura = '';
    let fecha = '';
    const items = [];

    rows.forEach(row => {
      proveedor = pick(row, ['Proveedor', 'proveedor', 'Emisor', 'Razon Social', 'Razón Social']) || proveedor;
      factura = pick(row, ['Factura', 'factura', 'N° Factura', 'Numero', 'Número', 'Folio', 'Serie']) || factura;
      const f = pick(row, ['Fecha', 'fecha', 'IssueDate', 'Fecha Emision']);
      if (f) fecha = parseFecha(f) || fecha;

      const descripcion = String(pick(row, ['Producto', 'producto', 'Descripcion', 'Descripción', 'Item', 'Detalle']) || '').trim();
      const codigo = String(pick(row, ['Codigo', 'Código', 'codigo', 'SKU']) || '').trim();
      const cantidad = parseInt(pick(row, ['Cantidad', 'cantidad', 'Qty', 'Cant'])) || 0;
      const costo = parseNum(pick(row, ['Costo', 'costo', 'Precio Unitario', 'Precio', 'P. Unitario', 'Valor Unitario']));

      if (descripcion || codigo) {
        items.push({ descripcion: descripcion || codigo, codigo, cantidad: Math.max(1, cantidad || 1), costo });
      }
    });

    const total = parseNum(pick(rows[rows.length - 1], ['Total', 'total', 'Importe Total', 'Monto Total']))
      || items.reduce((s, i) => s + i.cantidad * i.costo, 0);

    return normalizar({ proveedor, factura, fecha, total, items, metodo: 'excel', advertencias: [] });
  }

  /** XML factura electrónica (UBL 2.x y variantes SUNAT/CFDI simplificadas) */
  function parseXML(text) {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML inválido o corrupto');

    const byName = (name) => [...doc.getElementsByTagName('*')].filter(el => el.localName === name);

    const proveedor =
      byName('RegistrationName')[0]?.textContent?.trim() ||
      byName('PartyName')[0]?.textContent?.trim() ||
      byName('nombre')[0]?.textContent?.trim() ||
      byName('razonSocial')[0]?.textContent?.trim() ||
      '';

    const factura =
      byName('ID').find(el => el.parentElement?.localName !== 'PartyIdentification')?.textContent?.trim() ||
      byName('numero')[0]?.textContent?.trim() ||
      byName('folio')[0]?.textContent?.trim() ||
      '';

    const fecha = parseFecha(
      byName('IssueDate')[0]?.textContent ||
      byName('fechaEmision')[0]?.textContent ||
      byName('FechaEmision')[0]?.textContent
    );

    const items = [];
    const lineNodes = byName('InvoiceLine').length ? byName('InvoiceLine')
      : byName('Detalle').length ? byName('Detalle')
      : byName('Linea').length ? byName('Linea') : [];

    lineNodes.forEach(line => {
      const desc =
        [...line.getElementsByTagName('*')].find(e => e.localName === 'Description' || e.localName === 'Descripcion')?.textContent?.trim() ||
        line.querySelector('Item')?.textContent?.trim() || '';
      const qty = parseNum(
        [...line.getElementsByTagName('*')].find(e => e.localName === 'InvoicedQuantity' || e.localName === 'Cantidad')?.textContent
      ) || 1;
      const costo = parseNum(
        [...line.getElementsByTagName('*')].find(e =>
          e.localName === 'PriceAmount' || e.localName === 'PrecioUnitario' || e.localName === 'ValorUnitario'
        )?.textContent
      );
      if (desc) items.push({ descripcion: desc, codigo: '', cantidad: Math.max(1, qty), costo });
    });

    const total = parseNum(
      byName('PayableAmount')[0]?.textContent ||
      (() => {
        const block = byName('LegalMonetaryTotal')[0];
        if (!block) return '';
        const el = [...block.getElementsByTagName('*')].find(e => e.localName === 'PayableAmount');
        return el?.textContent || '';
      })() ||
      byName('ImporteTotal')[0]?.textContent
    ) || items.reduce((s, i) => s + i.cantidad * i.costo, 0);

    if (!items.length) throw new Error('No se encontraron líneas de producto en el XML');

    return normalizar({ proveedor, factura, fecha, total, items, metodo: 'xml', advertencias: [] });
  }

  /** PDF con texto (facturas electrónicas impresas / exportadas) */
  async function parsePDF(buffer) {
    if (typeof pdfjsLib === 'undefined') throw new Error('Lector PDF no disponible');

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let texto = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      texto += content.items.map(i => i.str).join(' ') + '\n';
    }

    if (texto.replace(/\s/g, '').length < 40) {
      throw new Error('El PDF no tiene texto legible. Suba la factura como imagen (foto) o use XML/Excel.');
    }

    const datos = parseTextoFactura(texto);
    datos.metodo = 'pdf';
    return datos;
  }

  function isImageFile(file) {
    const name = (file.name || '').toLowerCase();
    return file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(name);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function comprimirImagen(dataUrl, maxWidth = 900) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(1, maxWidth / img.width);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function prepararImagenOCR(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1.5, 1600 / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
          d[i] = d[i + 1] = d[i + 2] = contrast;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function getOcrWorker() {
    if (ocrWorker) return ocrWorker;
    if (typeof Tesseract === 'undefined') throw new Error('Motor OCR no cargado. Recargue la página.');
    ocrWorker = await Tesseract.createWorker('spa', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && progressCallback) {
          const pct = 20 + Math.round((m.progress || 0) * 70);
          progressCallback(pct, `Reconociendo texto... ${Math.round((m.progress || 0) * 100)}%`);
        }
      }
    });
    return ocrWorker;
  }

  async function parseImagen(file) {
    if (progressCallback) progressCallback(5, 'Cargando imagen...');

    const dataUrl = await fileToDataUrl(file);
    const imagenGuardada = await comprimirImagen(dataUrl);
    const imagenOCR = await prepararImagenOCR(dataUrl);

    if (progressCallback) progressCallback(15, 'Iniciando OCR local...');
    const worker = await getOcrWorker();
    const { data: { text } } = await worker.recognize(imagenOCR);

    if (!text || text.replace(/\s/g, '').length < 15) {
      throw new Error('No se detectó texto en la imagen. Use una foto más nítida y bien iluminada.');
    }

    if (progressCallback) progressCallback(95, 'Extrayendo datos...');

    let datos;
    try {
      datos = parseTextoFactura(text);
    } catch {
      datos = normalizar({
        proveedor: '', factura: '', fecha: '', total: 0, items: [],
        metodo: 'imagen',
        advertencias: ['No se detectaron datos automáticamente. Complete proveedor, factura y productos.']
      });
    }
    datos.metodo = 'imagen';
    datos.imagenBase64 = imagenGuardada;
    datos.textoOcr = text.substring(0, 5000);
    if (!datos.advertencias) datos.advertencias = [];
    if (!datos.advertencias.length) {
      datos.advertencias.push('Datos leídos por OCR local — revise proveedor, productos y totales.');
    }
    return datos;
  }

  function parseTextoFactura(texto) {
    const advertencias = [];
    const t = texto.replace(/\s+/g, ' ');

    let proveedor = '';
    const provMatch = t.match(/(?:RAZ[ÓO]N\s*SOCIAL|EMISOR|PROVEEDOR)[:\s]+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s.&\-]{3,60})/i);
    if (provMatch) proveedor = provMatch[1].trim().substring(0, 80);

    let factura = '';
    const facMatch = t.match(/(?:FACTURA|FOLIO|COMPROBANTE|N[°º]\s*)[:\s\-]*([A-Z0-9\-]{4,20})/i)
      || t.match(/\b(F[A-Z]?[\-\s]?\d{3,}[\-\s]?\d*)\b/i);
    if (facMatch) factura = facMatch[1].replace(/\s/g, '');

    let fecha = '';
    const dateMatch = t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) fecha = parseFecha(dateMatch[0]);

    const items = [];
    const lineRegex = /([A-Za-zÁÉÍÓÚáéíóúñÑ0-9][A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s\.\-]{4,50}?)\s+(\d+(?:\.\d+)?)\s+([\d.,]+)/g;
    let m;
    while ((m = lineRegex.exec(t)) !== null) {
      const desc = m[1].trim();
      if (/^(TOTAL|SUBTOTAL|IVA|RUC|FECHA)/i.test(desc)) continue;
      const cantidad = parseFloat(m[2]) || 1;
      const costo = parseNum(m[3]);
      if (costo > 0 && desc.length > 3) items.push({ descripcion: desc, codigo: '', cantidad, costo });
    }

    if (!items.length) {
      texto.split('\n').map(l => l.trim()).filter(l => l.length > 5).forEach(line => {
        const lm = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s*$/);
        if (!lm) return;
        const desc = lm[1].trim();
        if (/^(TOTAL|SUBTOTAL|IVA|RUC|FECHA|CANT|DESCRIP)/i.test(desc)) return;
        const cantidad = parseNum(lm[2]) || 1;
        const costo = parseNum(lm[3]);
        if (costo > 0 && desc.length > 2) items.push({ descripcion: desc, codigo: '', cantidad: Math.max(1, Math.round(cantidad)), costo });
      });
    }

    if (!items.length) advertencias.push('Revise los productos: el formato puede no coincidir con el esperado.');

    let total = 0;
    const totalMatch = t.match(/(?:TOTAL(?:\s+A\s+PAGAR)?|IMPORTE\s+TOTAL)[:\s]*([\d.,]+)/i);
    if (totalMatch) total = parseNum(totalMatch[1]);
    else total = items.reduce((s, i) => s + i.cantidad * i.costo, 0);

    if (!proveedor && !factura && !items.length) {
      throw new Error('No se pudieron extraer datos del texto. Complete los campos manualmente en la revisión.');
    }

    return normalizar({ proveedor, factura, fecha, total, items, metodo: 'texto', advertencias });
  }

  function normalizar(datos) {
    if (!datos.fecha) datos.fecha = Storage.today();
    datos.items = (datos.items || []).filter(i => i.descripcion || i.codigo);
    if (!datos.total) datos.total = datos.items.reduce((s, i) => s + i.cantidad * i.costo, 0);
    return datos;
  }

  function buscarProducto(descripcion, codigo, productos) {
    if (codigo) {
      const byCode = productos.find(p => p.codigo.toLowerCase() === codigo.toLowerCase());
      if (byCode) return byCode;
    }
    const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const d = norm(descripcion);
    let best = null, bestScore = 0;
    productos.forEach(p => {
      const n = norm(p.nombre);
      const words = d.split(/\s+/).filter(w => w.length > 2);
      let score = words.filter(w => n.includes(w)).length / Math.max(words.length, 1);
      if (n.includes(d) || d.includes(n)) score += 0.4;
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return bestScore >= 0.3 ? best : null;
  }

  function emparejarItems(datos) {
    const productos = Storage.getProductos();
    datos.items = datos.items.map(item => {
      const match = buscarProducto(item.descripcion, item.codigo, productos);
      return {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        costo: item.costo,
        productoId: match?.id || '',
        productoNombre: match?.nombre || item.descripcion,
        codigo: match?.codigo || item.codigo || '',
        matchAuto: !!match
      };
    });
    return datos;
  }

  async function procesarArchivo(file, onProgress) {
    progressCallback = onProgress || null;
    const name = file.name.toLowerCase();

    try {
      let datos;

      if (isImageFile(file)) {
        datos = await parseImagen(file);
      } else {
        const buffer = await file.arrayBuffer();
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
          datos = parseExcel(buffer);
        } else if (name.endsWith('.xml')) {
          datos = parseXML(new TextDecoder('utf-8').decode(buffer));
        } else if (name.endsWith('.pdf')) {
          datos = await parsePDF(buffer);
        } else {
          throw new Error('Formato no soportado. Use imagen, .xlsx, .xml o .pdf');
        }
      }

      if (onProgress) onProgress(100, 'Listo');
      return emparejarItems(datos);
    } finally {
      progressCallback = null;
    }
  }

  function descargarPlantilla() {
    const wb = XLSX.utils.book_new();
    const data = [
      ['Proveedor', 'Factura', 'Fecha', 'Código', 'Producto', 'Cantidad', 'Costo'],
      ['Distribuidora ABC', 'F001-123', '2025-06-01', 'PROD-001', 'Producto ejemplo', 10, 25.50],
      ['Distribuidora ABC', 'F001-123', '2025-06-01', 'PROD-002', 'Otro producto', 5, 12.00]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Compra');
    XLSX.writeFile(wb, 'plantilla_compra_smartstock.xlsx');
  }

  const formatoLabel = {
    excel: 'Excel',
    xml: 'XML electrónico',
    pdf: 'PDF (texto)',
    imagen: 'Imagen (OCR local)',
    texto: 'Texto extraído'
  };

  return { procesarArchivo, descargarPlantilla, formatoLabel };
})();
