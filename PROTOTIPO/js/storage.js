/**
 * SMARTSTOCK CONTABLE — Capa de almacenamiento LocalStorage
 * Gestiona persistencia, IDs únicos y datos de demostración
 */

const Storage = (() => {
  const KEYS = {
    PRODUCTOS: 'ss_productos',
    COMPRAS: 'ss_compras',
    VENTAS: 'ss_ventas',
    MOVIMIENTOS: 'ss_movimientos',
    ASIENTOS: 'ss_asientos',
    CONFIG: 'ss_config',
    INITIALIZED: 'ss_initialized'
  };

  /** Genera ID único basado en timestamp */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /** Lee y parsea datos del localStorage */
  function get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error leyendo localStorage:', key, e);
      return null;
    }
  }

  /** Guarda datos en localStorage */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Error guardando localStorage:', key, e);
      return false;
    }
  }

  // ---- Accesores por entidad ----

  function getProductos() { return get(KEYS.PRODUCTOS) || []; }
  function setProductos(data) { return set(KEYS.PRODUCTOS, data); }

  function getCompras() { return get(KEYS.COMPRAS) || []; }
  function setCompras(data) { return set(KEYS.COMPRAS, data); }

  function getVentas() { return get(KEYS.VENTAS) || []; }
  function setVentas(data) { return set(KEYS.VENTAS, data); }

  function getMovimientos() { return get(KEYS.MOVIMIENTOS) || []; }
  function setMovimientos(data) { return set(KEYS.MOVIMIENTOS, data); }

  function getAsientos() { return get(KEYS.ASIENTOS) || []; }
  function setAsientos(data) { return set(KEYS.ASIENTOS, data); }

  function getConfig() {
    const defaults = {
      empresa: 'Mi Empresa',
      moneda: 'USD',
      metodoKardex: 'peps',
      iva: 0,
      categorias: [],
      unidades: ['Unidad', 'Kg', 'Gramo', 'Litro', 'Mililitro', 'Metro', 'Centímetro', 'Caja', 'Paquete', 'Par', 'Docena', 'Servicio', 'Kit', 'Rollo', 'Galón']
    };
    const saved = get(KEYS.CONFIG);
    if (!saved) return defaults;
    return {
      ...defaults,
      ...saved,
      categorias: saved.categorias ?? defaults.categorias,
      unidades: saved.unidades ?? defaults.unidades
    };
  }
  function setConfig(data) { return set(KEYS.CONFIG, data); }

  /** Categorías: catálogo guardado + las usadas en productos (sin duplicados) */
  function getCategorias() {
    const config = getConfig();
    const deProductos = getProductos().map(p => p.categoria).filter(Boolean);
    const todas = [...(config.categorias || []), ...deProductos];
    return [...new Set(todas.map(c => c.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }

  /** Unidades de medida: catálogo + las usadas en productos */
  function getUnidades() {
    const config = getConfig();
    const deProductos = getProductos().map(p => p.unidad).filter(Boolean);
    const todas = [...(config.unidades || []), ...deProductos];
    return [...new Set(todas.map(u => u.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }

  /** Registra categoría en el catálogo global si no existe */
  function ensureCategoria(nombre) {
    const cat = (nombre || '').trim();
    if (!cat) return '';
    const config = getConfig();
    if (!config.categorias) config.categorias = [];
    if (!config.categorias.some(c => c.toLowerCase() === cat.toLowerCase())) {
      config.categorias.push(cat);
      setConfig(config);
    }
    return cat;
  }

  /** Registra unidad en el catálogo global si no existe */
  function ensureUnidad(nombre) {
    const u = (nombre || '').trim();
    if (!u) return 'Unidad';
    const config = getConfig();
    if (!config.unidades) config.unidades = [];
    if (!config.unidades.some(x => x.toLowerCase() === u.toLowerCase())) {
      config.unidades.push(u);
      setConfig(config);
    }
    return u;
  }

  function addCategoria(nombre) { return ensureCategoria(nombre); }

  function removeCategoria(nombre) {
    const cat = (nombre || '').trim();
    const enUso = getProductos().some(p => p.categoria === cat);
    if (enUso) return { ok: false, error: 'Hay productos que usan esta categoría' };
    const config = getConfig();
    config.categorias = (config.categorias || []).filter(c => c !== cat);
    setConfig(config);
    return { ok: true };
  }

  function addUnidad(nombre) { return ensureUnidad(nombre); }

  function removeUnidad(nombre) {
    const u = (nombre || '').trim();
    const enUso = getProductos().some(p => p.unidad === u);
    if (enUso) return { ok: false, error: 'Hay productos que usan esta unidad' };
    const config = getConfig();
    config.unidades = (config.unidades || []).filter(x => x !== u);
    setConfig(config);
    return { ok: true };
  }

  /** Genera opciones HTML para datalist */
  function datalistOptions(valores) {
    return valores.map(v => `<option value="${v.replace(/"/g, '&quot;')}">`).join('');
  }

  function isInitialized() { return localStorage.getItem(KEYS.INITIALIZED) === 'true'; }
  function markInitialized() { localStorage.setItem(KEYS.INITIALIZED, 'true'); }

  /** Busca producto por ID o código */
  function findProducto(idOrCodigo) {
    const productos = getProductos();
    return productos.find(p => p.id === idOrCodigo || p.codigo === idOrCodigo);
  }

  /** Actualiza stock de un producto */
  function updateProductoStock(productoId, cantidad, operacion = 'add') {
    const productos = getProductos();
    const idx = productos.findIndex(p => p.id === productoId);
    if (idx === -1) return false;

    if (operacion === 'add') {
      productos[idx].stock += cantidad;
    } else if (operacion === 'subtract') {
      productos[idx].stock -= cantidad;
    } else {
      productos[idx].stock = cantidad;
    }

    setProductos(productos);
    return true;
  }

  /**
   * Clasifica el estado del stock (semáforo inteligente)
   * @returns {'saludable'|'bajo'|'critico'}
   */
  function getStockStatus(producto) {
    if (producto.stock <= 0) return 'critico';
    if (producto.stock <= producto.stockMinimo * 0.5) return 'critico';
    if (producto.stock <= producto.stockMinimo) return 'bajo';
    return 'saludable';
  }

  /** Formatea moneda */
  function formatMoney(amount) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: getConfig().moneda || 'USD'
    }).format(amount || 0);
  }

  /** Formatea fecha */
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /** Formatea fecha y hora */
  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /** Obtiene fecha actual en formato ISO (solo fecha) */
  function today() {
    return new Date().toISOString().split('T')[0];
  }

  /** Obtiene mes y año actual */
  function currentMonthYear() {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  }

  /** Filtra registros del mes actual */
  function isCurrentMonth(dateStr) {
    const d = new Date(dateStr);
    const { month, year } = currentMonthYear();
    return d.getMonth() === month && d.getFullYear() === year;
  }

  /** Genera datos de demostración para primera ejecución */
  function initDemoData() {
    if (isInitialized()) return;

    const now = new Date();

    // Catálogo global de categorías y unidades (cualquier rubro)
    setConfig({
      empresa: 'Empresa Demo',
      moneda: 'USD',
      metodoKardex: 'peps',
      iva: 0,
      categorias: ['Tecnología', 'Mobiliario', 'Suministros', 'Papelería', 'Herramientas', 'Textil', 'Servicios', 'General'],
      unidades: ['Unidad', 'Kg', 'Gramo', 'Litro', 'Metro', 'Caja', 'Paquete', 'Par', 'Servicio', 'Kit']
    });

    const productos = [
      { id: generateId(), codigo: 'PRD-001', nombre: 'Laptop Dell Inspiron 15', categoria: 'Tecnología', descripcion: 'Equipo portátil empresarial', precioCompra: 450.00, precioVenta: 599.00, stock: 12, stockMinimo: 3, unidad: 'Unidad', fechaCreacion: now.toISOString() },
      { id: generateId(), codigo: 'PRD-002', nombre: 'Escritorio Ejecutivo', categoria: 'Mobiliario', descripcion: 'Escritorio de melamina 1.40m', precioCompra: 120.00, precioVenta: 185.00, stock: 8, stockMinimo: 2, unidad: 'Unidad', fechaCreacion: now.toISOString() },
      { id: generateId(), codigo: 'PRD-003', nombre: 'Tóner Impresora HP 85A', categoria: 'Suministros', descripcion: 'Cartucho tóner negro compatible', precioCompra: 28.50, precioVenta: 42.00, stock: 25, stockMinimo: 8, unidad: 'Unidad', fechaCreacion: now.toISOString() },
      { id: generateId(), codigo: 'PRD-004', nombre: 'Cuaderno A4 100 hojas', categoria: 'Papelería', descripcion: 'Cuaderno empastado universitario', precioCompra: 1.80, precioVenta: 3.25, stock: 150, stockMinimo: 30, unidad: 'Unidad', fechaCreacion: now.toISOString() },
      { id: generateId(), codigo: 'PRD-005', nombre: 'Martillo 16 oz', categoria: 'Herramientas', descripcion: 'Martillo de carpintero con mango', precioCompra: 8.50, precioVenta: 14.00, stock: 5, stockMinimo: 10, unidad: 'Unidad', fechaCreacion: now.toISOString() },
      { id: generateId(), codigo: 'PRD-006', nombre: 'Camisa Formal Talla M', categoria: 'Textil', descripcion: 'Camisa manga larga algodón', precioCompra: 15.00, precioVenta: 28.00, stock: 40, stockMinimo: 10, unidad: 'Unidad', fechaCreacion: now.toISOString() },
      { id: generateId(), codigo: 'PRD-007', nombre: 'Servicio Mantenimiento PC', categoria: 'Servicios', descripcion: 'Mantenimiento preventivo por equipo', precioCompra: 0, precioVenta: 35.00, stock: 0, stockMinimo: 0, unidad: 'Servicio', fechaCreacion: now.toISOString() },
      { id: generateId(), codigo: 'PRD-008', nombre: 'Cable HDMI 2 metros', categoria: 'Tecnología', descripcion: 'Cable HDMI 2.0 alta velocidad', precioCompra: 4.20, precioVenta: 8.50, stock: 60, stockMinimo: 15, unidad: 'Unidad', fechaCreacion: now.toISOString() }
    ];

    setProductos(productos);

    // Generar compras y ventas de los últimos 6 meses para gráficos
    const compras = [];
    const ventas = [];
    const movimientos = [];
    const asientos = [];

    for (let m = 5; m >= 0; m--) {
      const fecha = new Date(now.getFullYear(), now.getMonth() - m, 15);
      const fechaStr = fecha.toISOString().split('T')[0];

      // Compra mensual demo — costos variables por mes para que FIFO ≠ Promedio
      const compraItems = productos.slice(0, 3).map((p, i) => {
        // Costo sube ~8% cada mes (compras antiguas más baratas)
        const factorCosto = 1 + (5 - m) * 0.08;
        const costo = +(p.precioCompra * factorCosto).toFixed(2);
        return {
          productoId: p.id,
          productoNombre: p.nombre,
          codigo: p.codigo,
          cantidad: 20 + i * 10,
          costo
        };
      });
      const compraTotal = compraItems.reduce((s, i) => s + i.cantidad * i.costo, 0);

      const compraId = generateId();
      compras.push({
        id: compraId,
        proveedor: 'Proveedor Comercial S.A.',
        factura: `FC-${1000 + m}`,
        fecha: fechaStr,
        items: compraItems,
        total: compraTotal
      });

      asientos.push({
        id: generateId(),
        fecha: fechaStr,
        descripcion: `Compra ${fechaStr} - Proveedor Comercial`,
        referencia: compraId,
        tipo: 'compra',
        debe: [{ cuenta: 'Inventario', codigo: '1.1.4', monto: compraTotal }],
        haber: [{ cuenta: 'Caja/Bancos', codigo: '1.1.1', monto: compraTotal }]
      });

      // Venta el día 20 del mismo mes (después de la compra del 15)
      const fechaVenta = new Date(now.getFullYear(), now.getMonth() - m, 20);
      const fechaVentaStr = fechaVenta.toISOString().split('T')[0];

      // Venta mensual demo
      const ventaItems = productos.slice(0, 4).map((p, i) => ({
        productoId: p.id,
        productoNombre: p.nombre,
        codigo: p.codigo,
        cantidad: 8 + i * 3,
        precio: p.precioVenta,
        costo: p.precioCompra
      }));
      const ventaTotal = ventaItems.reduce((s, i) => s + i.cantidad * i.precio, 0);
      const ventaCosto = ventaItems.reduce((s, i) => s + i.cantidad * i.costo, 0);
      const ventaUtilidad = ventaTotal - ventaCosto;

      const ventaId = generateId();
      ventas.push({
        id: ventaId,
        cliente: 'Cliente General',
        fecha: fechaVentaStr,
        items: ventaItems,
        total: ventaTotal,
        costo: ventaCosto,
        utilidad: ventaUtilidad
      });

      asientos.push({
        id: generateId(),
        fecha: fechaVentaStr,
        descripcion: `Venta ${fechaVentaStr} - Cliente General`,
        referencia: ventaId,
        tipo: 'venta',
        debe: [{ cuenta: 'Caja', codigo: '1.1.1', monto: ventaTotal }],
        haber: [{ cuenta: 'Ventas', codigo: '4.1.1', monto: ventaTotal }]
      });

      // Movimientos demo — entrada antes que salida en el mismo mes
      compraItems.forEach(item => {
        movimientos.push({
          id: generateId(),
          fecha: fechaStr,
          hora: '09:30:00',
          productoId: item.productoId,
          productoNombre: item.productoNombre,
          tipo: 'entrada',
          cantidad: item.cantidad,
          observaciones: `Compra FC-${1000 + m}`,
          referenciaId: compraId
        });
      });

      ventaItems.forEach(item => {
        movimientos.push({
          id: generateId(),
          fecha: fechaVentaStr,
          hora: '14:15:00',
          productoId: item.productoId,
          productoNombre: item.productoNombre,
          tipo: 'salida',
          cantidad: item.cantidad,
          observaciones: `Venta a Cliente General`,
          referenciaId: ventaId
        });
      });
    }

    setCompras(compras);
    setVentas(ventas);
    setMovimientos(movimientos);
    setAsientos(asientos);
    markInitialized();
  }

  /** Reinicia todos los datos */
  function resetAll() {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
  }

  return {
    KEYS,
    generateId,
    get, set,
    getProductos, setProductos,
    getCompras, setCompras,
    getVentas, setVentas,
    getMovimientos, setMovimientos,
    getAsientos, setAsientos,
    getConfig, setConfig,
    getCategorias, getUnidades, ensureCategoria, ensureUnidad,
    addCategoria, removeCategoria, addUnidad, removeUnidad, datalistOptions,
    isInitialized, markInitialized,
    findProducto, updateProductoStock,
    getStockStatus, formatMoney, formatDate, formatDateTime,
    today, currentMonthYear, isCurrentMonth,
    initDemoData, resetAll
  };
})();
