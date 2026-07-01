/**
 * SMARTSTOCK CONTABLE — Asistente Contable Inteligente
 * Chatbot que responde consultas sobre inventario y contabilidad
 */

const Chatbot = (() => {

  const SALUDOS = ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'hey', 'hi'];
  const AYUDA = ['ayuda', 'help', 'qué puedes hacer', 'que puedes hacer', 'comandos'];

  /** Procesa la pregunta del usuario y genera respuesta */
  function procesarPregunta(pregunta) {
    const q = pregunta.toLowerCase().trim();

    // Saludos
    if (SALUDOS.some(s => q.includes(s))) {
      return '¡Hola! Soy el Asistente Contable de SmartStock. Puedo ayudarte con consultas sobre inventario, ventas, compras y utilidades. ¿Qué deseas saber?';
    }

    // Ayuda
    if (AYUDA.some(a => q.includes(a))) {
      return `Puedo responder preguntas como:
• ¿Cuál es el producto más vendido?
• ¿Cuánto vendí este mes?
• ¿Cuánto compré este mes?
• ¿Qué productos están por agotarse?
• ¿Cuál es mi utilidad?
• ¿Cuál es mi inventario actual?
• ¿Cuántos productos tengo?
• ¿Cuál es el valor del inventario?`;
    }

    // Producto más vendido
    if (q.includes('más vendido') || q.includes('mas vendido') || q.includes('top') || q.includes('mejor producto')) {
      const ventas = Storage.getVentas();
      const counts = {};
      ventas.forEach(v => {
        v.items.forEach(item => {
          counts[item.productoNombre] = (counts[item.productoNombre] || 0) + item.cantidad;
        });
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) return 'Aún no hay ventas registradas.';
      return `🏆 El producto más vendido es **${sorted[0][0]}** con **${sorted[0][1]} unidades** vendidas.${sorted[1] ? `\n\nSeguido por ${sorted[1][0]} (${sorted[1][1]} uds).` : ''}`;
    }

    // Ventas del mes
    if (q.includes('vendí') || q.includes('vendi') || q.includes('ventas') && (q.includes('mes') || q.includes('este mes'))) {
      const ventas = Storage.getVentas().filter(v => Storage.isCurrentMonth(v.fecha));
      const total = ventas.reduce((s, v) => s + v.total, 0);
      const count = ventas.length;
      return `📊 Este mes has realizado **${count} venta${count !== 1 ? 's' : ''}** por un total de **${Storage.formatMoney(total)}**.`;
    }

    // Compras del mes
    if (q.includes('compré') || q.includes('compre') || q.includes('compras') && (q.includes('mes') || q.includes('este mes'))) {
      const compras = Storage.getCompras().filter(c => Storage.isCurrentMonth(c.fecha));
      const total = compras.reduce((s, c) => s + c.total, 0);
      return `🛒 Este mes has realizado **${compras.length} compra${compras.length !== 1 ? 's' : ''}** por un total de **${Storage.formatMoney(total)}**.`;
    }

    // Productos por agotarse
    if (q.includes('agot') || q.includes('bajo') || q.includes('crítico') || q.includes('critico') || q.includes('reponer')) {
      const alertas = Storage.getProductos().filter(p => Storage.getStockStatus(p) !== 'saludable');
      if (alertas.length === 0) return '✅ Todos los productos tienen stock saludable. No hay alertas.';
      const lista = alertas.map(p => {
        const status = Storage.getStockStatus(p);
        const emoji = status === 'critico' ? '🔴' : '🟡';
        return `${emoji} **${p.nombre}**: ${p.stock} unidades (mín: ${p.stockMinimo})`;
      }).join('\n');
      return `⚠️ **${alertas.length} producto${alertas.length !== 1 ? 's' : ''} requieren atención:**\n\n${lista}`;
    }

    // Utilidad
    if (q.includes('utilidad') || q.includes('ganancia') || q.includes('rentabilidad') || q.includes('margen')) {
      const ventas = Storage.getVentas();
      const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
      const totalUtilidad = ventas.reduce((s, v) => s + (v.utilidad || 0), 0);
      const ventasMes = ventas.filter(v => Storage.isCurrentMonth(v.fecha));
      const utilidadMes = ventasMes.reduce((s, v) => s + (v.utilidad || 0), 0);
      const margen = totalVentas > 0 ? ((totalUtilidad / totalVentas) * 100).toFixed(1) : 0;
      return `💰 **Utilidad total acumulada:** ${Storage.formatMoney(totalUtilidad)}\n📅 **Utilidad del mes:** ${Storage.formatMoney(utilidadMes)}\n📈 **Margen de utilidad:** ${margen}%`;
    }

    // Inventario actual
    if (q.includes('inventario') || q.includes('stock total') || q.includes('existencias')) {
      const productos = Storage.getProductos();
      const stockTotal = productos.reduce((s, p) => s + p.stock, 0);
      const valor = Contabilidad.getValorInventario();
      const activos = productos.filter(p => p.stock > 0).length;
      const agotados = productos.filter(p => p.stock <= 0).length;
      return `📦 **Inventario actual:**\n• Productos activos: ${activos}\n• Productos agotados: ${agotados}\n• Stock total: ${stockTotal.toLocaleString()} unidades\n• Valor del inventario: ${Storage.formatMoney(valor)}`;
    }

    // Cantidad de productos
    if (q.includes('cuántos productos') || q.includes('cuantos productos') || q.includes('total productos')) {
      const productos = Storage.getProductos();
      const categorias = [...new Set(productos.map(p => p.categoria))];
      return `📋 Tienes **${productos.length} productos** registrados en **${categorias.length} categorías**: ${categorias.join(', ')}.`;
    }

    // Valor inventario
    if (q.includes('valor') && (q.includes('inventario') || q.includes('stock'))) {
      return `💵 El valor total del inventario es **${Storage.formatMoney(Contabilidad.getValorInventario())}** (calculado al costo de compra).`;
    }

    // Balance / contabilidad
    if (q.includes('balance') || q.includes('contabilidad') || q.includes('estado de resultados')) {
      const balance = Contabilidad.getBalanceGeneral();
      const estado = Contabilidad.getEstadoResultados();
      return `📒 **Resumen Contable:**\n• Total Activos: ${Storage.formatMoney(balance.totalActivos)}\n• Total Patrimonio: ${Storage.formatMoney(balance.totalPatrimonio)}\n• Ventas totales: ${Storage.formatMoney(estado.totalIngresos)}\n• Utilidad neta: ${Storage.formatMoney(estado.utilidadNeta)}`;
    }

    // Predicción específica
    if (q.includes('predicc') || q.includes('cuándo se agota') || q.includes('cuando se agota')) {
      const criticos = Prediccion.analizarTodos().filter(p => p.status !== 'saludable').slice(0, 3);
      if (criticos.length === 0) return '✅ No hay productos con riesgo de agotamiento inmediato.';
      const lista = criticos.map(p => `• **${p.producto.nombre}**: ${p.mensaje}`).join('\n');
      return `🔮 **Predicciones de agotamiento:**\n${lista}`;
    }

    // Respuesta por defecto
    return `No estoy seguro de entender tu pregunta. Intenta preguntarme sobre:
• Productos más vendidos
• Ventas o compras del mes
• Utilidad y rentabilidad
• Productos por agotarse
• Inventario actual

Escribe **"ayuda"** para ver todas las opciones.`;
  }

  function init() {
    const toggle = document.getElementById('chatbotToggle');
    const window_ = document.getElementById('chatbotWindow');
    const close = document.getElementById('chatbotClose');
    const input = document.getElementById('chatbotInput');
    const send = document.getElementById('chatbotSend');
    const messages = document.getElementById('chatbotMessages');

    toggle?.addEventListener('click', () => {
      window_.classList.toggle('open');
      if (window_.classList.contains('open') && messages.children.length === 0) {
        addMessage('bot', '¡Hola! Soy tu Asistente Contable. Pregúntame sobre inventario, ventas, compras o utilidades. Escribe "ayuda" para ver opciones.');
      }
    });

    close?.addEventListener('click', () => window_.classList.remove('open'));

    function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      addMessage('user', text);
      input.value = '';

      // Simular delay de "pensamiento"
      setTimeout(() => {
        const respuesta = procesarPregunta(text);
        addMessage('bot', respuesta);
      }, 400);
    }

    send?.addEventListener('click', sendMessage);
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function addMessage(type, text) {
    const messages = document.getElementById('chatbotMessages');
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    // Convertir **texto** a negrita simple
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  return { init, procesarPregunta, addMessage };
})();
