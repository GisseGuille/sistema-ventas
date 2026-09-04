/* --- MÓDULO DE REPORTES --- */
import { escapeHTML, formatearCantidad, buscarProductoCatalogo, obtenerCategoriaProducto, obtenerUnidadProducto } from './utils.js';
import { obtenerProductos } from './productos.js';
import { obtenerVentas } from './ventas.js';

// Calcula las métricas de ventas y actualiza la UI aplicando filtros de fecha
export async function actualizarReportes() {
    const ventas = await obtenerVentas();
    const productosBD = await obtenerProductos();

    const desdeStr = document.getElementById('reportFechaDesde') ? document.getElementById('reportFechaDesde').value : '';
    const hastaStr = document.getElementById('reportFechaHasta') ? document.getElementById('reportFechaHasta').value : '';

    let ventasFiltradas = ventas;

    if (desdeStr) {
        const desdeDate = new Date(desdeStr + 'T00:00:00');
        ventasFiltradas = ventasFiltradas.filter(v => new Date(v.fecha) >= desdeDate);
    }

    if (hastaStr) {
        const hastaDate = new Date(hastaStr + 'T23:59:59');
        ventasFiltradas = ventasFiltradas.filter(v => new Date(v.fecha) <= hastaDate);
    }

    // 1. Total Facturado
    const totalFacturado = ventasFiltradas.reduce((acc, v) => acc + (v.total || 0), 0);
    const totalFacturadoFormateado = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(totalFacturado);

    const totalLabel = document.getElementById('kpiTotalFacturado');
    if (totalLabel) totalLabel.innerText = totalFacturadoFormateado;

    // 2. Cantidad de Ventas Registradas
    const ventasLabel = document.getElementById('kpiVentasRealizadas');
    if (ventasLabel) ventasLabel.innerText = ventasFiltradas.length;

    // 3. Total de Ganancias
    let totalGanancias = 0;
    ventasFiltradas.forEach(v => {
        (v.productos || []).forEach(p => {
            const prodBD = buscarProductoCatalogo(p, productosBD);
            const costoUnitario = (p.costo !== undefined && p.costo !== null) ? p.costo : (prodBD?.costo || 0);
            const gananciaUnitaria = p.precio - costoUnitario;
            totalGanancias += (gananciaUnitaria * (parseFloat(p.cantidad) || 0));
        });
    });

    const totalGananciasFormateado = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(totalGanancias);

    const gananciasLabel = document.getElementById('kpiTotalGanancias');
    if (gananciasLabel) gananciasLabel.innerText = totalGananciasFormateado;

    // 4. Ranking de los 3 productos más vendidos
    const acumulador = {};
    ventasFiltradas.forEach(venta => {
        (venta.productos || []).forEach(p => {
            const prodBD = buscarProductoCatalogo(p, productosBD);
            const prodKey = p.producto_id || p.id || (prodBD ? prodBD.id : p.nombre);
            const unidad = obtenerUnidadProducto(p, productosBD);
            const nombreProd = p.nombre || (prodBD ? prodBD.nombre : 'Producto');
            if (!acumulador[prodKey]) {
                acumulador[prodKey] = { nombre: nombreProd, cantidad: 0, unidad_medida: unidad };
            }
            acumulador[prodKey].cantidad += (parseFloat(p.cantidad) || 0);
            acumulador[prodKey].unidad_medida = unidad;
        });
    });

    const topProductos = Object.values(acumulador)
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 3);

    const rankingContainer = document.getElementById('rankingProductos');
    if (rankingContainer) {
        if (topProductos.length === 0) {
            rankingContainer.innerHTML = `<li style="color: var(--text-muted); font-size: 0.9rem; font-style: italic; padding: 10px;">No hay ventas registradas en el período seleccionado.</li>`;
        } else {
            rankingContainer.innerHTML = '';
            const medallas = ['🥇', '🥈', '🥉'];
            topProductos.forEach((prod, index) => {
                const li = document.createElement('li');
                li.className = 'ranking-item';
                li.innerHTML = `
                    <span>${medallas[index] || '•'} <strong>${escapeHTML(prod.nombre)}</strong></span>
                    <span style="font-weight: 600; color: var(--primary-color); font-family: monospace;">${formatearCantidad(prod.cantidad, prod.unidad_medida)}</span>
                `;
                rankingContainer.appendChild(li);
            });
        }
    }

    // 5. Calcular ventas por categoría y dibujar gráfico circular
    const categoriaVentas = {};
    let totalUnidadesVendidas = 0;

    ventasFiltradas.forEach(v => {
        (v.productos || []).forEach(p => {
            const cat = obtenerCategoriaProducto(p, productosBD);
            const cant = parseFloat(p.cantidad) || 0;

            if (!categoriaVentas[cat]) {
                categoriaVentas[cat] = 0;
            }
            categoriaVentas[cat] = Math.round((categoriaVentas[cat] + cant) * 100) / 100;
            totalUnidadesVendidas += cant;
        });
    });

    dibujarGraficoCategorias(categoriaVentas, totalUnidadesVendidas);

    // 6. Renderizar grilla de historial de ventas en la pestaña de reportes
    renderHistorialVentasReporte(ventasFiltradas, productosBD);
}

// Renderiza la grilla de ventas históricas filtradas en la pestaña de reportes
export function renderHistorialVentasReporte(ventasFiltradas, productosBD) {
    const histTbody = document.getElementById('historicalSalesTableBody');
    if (!histTbody) return;

    if (ventasFiltradas.length === 0) {
        histTbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 15px;">
                    No hay ventas registradas en el período seleccionado.
                </td>
            </tr>
        `;
        return;
    }

    histTbody.innerHTML = '';
    const ventasOrdenadas = [...ventasFiltradas].reverse();

    ventasOrdenadas.forEach(v => {
        const tr = document.createElement('tr');

        const fechaObj = new Date(v.fecha);
        const dia = String(fechaObj.getDate()).padStart(2, '0');
        const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const anio = fechaObj.getFullYear();
        const hora = String(fechaObj.getHours()).padStart(2, '0');
        const min = String(fechaObj.getMinutes()).padStart(2, '0');
        const fechaHoraStr = `${dia}/${mes}/${anio} ${hora}:${min} hs`;

        let prodHTML = '';
        let cantHTML = '';
        let totalProdHTML = '';
        let gananciaVentaAcumulada = 0;

        (v.productos || []).forEach(p => {
            const prodBD = buscarProductoCatalogo(p, productosBD);
            const unidad = obtenerUnidadProducto(p, productosBD);
            prodHTML += `<div style="padding: 2px 0;">${escapeHTML(p.nombre || prodBD?.nombre || 'Producto')}</div>`;
            cantHTML += `<div style="padding: 2px 0; text-align: center; font-weight: 600; font-family: monospace; white-space: nowrap;">${formatearCantidad(p.cantidad, unidad)}</div>`;

            const subtotal = p.precio * p.cantidad;
            const subtotalFormateado = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS'
            }).format(subtotal);
            totalProdHTML += `<div style="padding: 2px 0; text-align: right; font-family: monospace;">${subtotalFormateado}</div>`;

            const costoUnitario = (p.costo !== undefined && p.costo !== null) ? p.costo : (prodBD?.costo || 0);
            const gananciaUnitaria = p.precio - costoUnitario;
            gananciaVentaAcumulada += gananciaUnitaria * p.cantidad;
        });

        const totalVentaFormateado = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(v.total);

        const gananciaVentaFormateada = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(gananciaVentaAcumulada);

        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--primary-color); vertical-align: top; padding-top: 12px; font-size: 0.85rem;">${fechaHoraStr}</td>
            <td style="word-break: break-word; font-size: 0.9rem; color: #555; vertical-align: top; padding-top: 10px;">${prodHTML}</td>
            <td style="vertical-align: top; padding-top: 10px;">${cantHTML}</td>
            <td style="vertical-align: top; padding-top: 10px;">${totalProdHTML}</td>
            <td style="font-family: monospace; font-weight: 700; text-align: right; color: var(--primary-color); vertical-align: top; padding-top: 12px;">${totalVentaFormateado}</td>
            <td style="font-family: monospace; font-weight: 700; text-align: right; color: var(--secondary-color); vertical-align: top; padding-top: 12px;">${gananciaVentaFormateada}</td>
        `;
        histTbody.appendChild(tr);
    });
}

// Dibuja un gráfico circular nativo usando Canvas para las ventas por categoría
export function dibujarGraficoCategorias(datos, total) {
    const canvas = document.getElementById('chartCategorias');
    const legendContainer = document.getElementById('chartLegend');
    if (!canvas || !legendContainer) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    legendContainer.innerHTML = '';

    const categorias = Object.keys(datos);
    if (categorias.length === 0 || total === 0) {
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Sin datos de ventas', canvas.width / 2, canvas.height / 2);
        legendContainer.innerHTML = '<div style="color: var(--text-muted); font-style: italic; padding: 10px;">No hay ventas registradas en este período para graficar.</div>';
        return;
    }

    const colores = [
        '#d81b60', '#27ae60', '#2980b9', '#f39c12', '#8e44ad',
        '#16a085', '#e67e22', '#c0392b', '#2c3e50', '#00b894'
    ];

    const centroX = canvas.width / 2;
    const centroY = canvas.height / 2;
    const radio = Math.min(centroX, centroY) - 10;
    let anguloInicio = 0;

    categorias.forEach((cat, index) => {
        const cantidad = datos[cat];
        const porcentaje = (cantidad / total) * 100;
        const fraccion = cantidad / total;
        const anguloFin = anguloInicio + (fraccion * 2 * Math.PI);
        const color = colores[index % colores.length];

        ctx.beginPath();
        ctx.moveTo(centroX, centroY);
        ctx.arc(centroX, centroY, radio, anguloInicio, anguloFin);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        anguloInicio = anguloFin;

        const cantFmt = (cantidad % 1 === 0)
            ? cantidad.toString()
            : cantidad.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        const legendItem = document.createElement('div');
        legendItem.style.display = 'flex';
        legendItem.style.alignItems = 'center';
        legendItem.style.gap = '10px';
        legendItem.style.padding = '4px 0';
        legendItem.innerHTML = `
            <span style="display: inline-block; width: 14px; height: 14px; background-color: ${color}; border-radius: 50%; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span>
            <span style="flex: 1; font-size: 0.92rem;"><strong>${escapeHTML(cat)}</strong></span>
            <span style="font-weight: 700; font-family: monospace; font-size: 0.92rem; color: var(--primary-color);">${cantFmt} (${porcentaje.toFixed(1)}%)</span>
        `;
        legendContainer.appendChild(legendItem);
    });
}

// Limpia los campos de fecha del panel de reportes y actualiza los indicadores
export async function limpiarFiltrosReportes() {
    const desdeInput = document.getElementById('reportFechaDesde');
    const hastaInput = document.getElementById('reportFechaHasta');

    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';

    await actualizarReportes();
}

// Renderiza el historial de ventas del día actual y totaliza la facturación diaria
export async function renderVentasDelDia() {
    const tbody = document.getElementById('todaySalesTableBody');
    if (!tbody) return;

    const ventas = await obtenerVentas();
    const hoyObj = new Date();
    const hoy = hoyObj.toDateString();

    const dia = String(hoyObj.getDate()).padStart(2, '0');
    const mes = String(hoyObj.getMonth() + 1).padStart(2, '0');
    const anio = hoyObj.getFullYear();
    const fechaHoyFormateada = `${dia}/${mes}/${anio}`;

    const fechaHoyLabel = document.getElementById('fechaHoyLabel');
    if (fechaHoyLabel) fechaHoyLabel.innerText = fechaHoyFormateada;

    const ventasHoy = ventas.filter(v => new Date(v.fecha).toDateString() === hoy);

    const productosBD = await obtenerProductos();
    let totalHoy = 0;
    let totalGananciaHoy = 0;

    ventasHoy.forEach(v => {
        totalHoy += (v.total || 0);
        (v.productos || []).forEach(p => {
            const prodBD = buscarProductoCatalogo(p, productosBD);
            const costoUnitario = (p.costo !== undefined && p.costo !== null) ? p.costo : (prodBD?.costo || 0);
            const gananciaUnitaria = p.precio - costoUnitario;
            totalGananciaHoy += (gananciaUnitaria * (parseFloat(p.cantidad) || 0));
        });
    });

    const totalHoyFormateado = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(totalHoy);

    const totalGananciaHoyFormateado = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(totalGananciaHoy);

    const totalLabel = document.getElementById('totalFacturadoHoyLabel');
    if (totalLabel) totalLabel.innerText = totalHoyFormateado;

    const totalGananciaLabel = document.getElementById('totalGananciaHoyLabel');
    if (totalGananciaLabel) totalGananciaLabel.innerText = totalGananciaHoyFormateado;

    if (ventasHoy.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 15px;">
                    No hay ventas registradas el día de hoy.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    ventasHoy.reverse().forEach(v => {
        const tr = document.createElement('tr');

        const fechaObj = new Date(v.fecha);
        const horaStr = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        let prodHTML = '';
        let cantHTML = '';
        let totalProdHTML = '';
        let gananciaVentaAcumulada = 0;

        (v.productos || []).forEach(p => {
            const prodBD = buscarProductoCatalogo(p, productosBD);
            const unidad = obtenerUnidadProducto(p, productosBD);
            prodHTML += `<div style="padding: 2px 0;">${escapeHTML(p.nombre || prodBD?.nombre || 'Producto')}</div>`;
            cantHTML += `<div style="padding: 2px 0; text-align: center; font-weight: 600; font-family: monospace; white-space: nowrap;">${formatearCantidad(p.cantidad, unidad)}</div>`;

            const subtotal = p.precio * p.cantidad;
            const subtotalFormateado = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS'
            }).format(subtotal);
            totalProdHTML += `<div style="padding: 2px 0; text-align: right; font-family: monospace;">${subtotalFormateado}</div>`;

            const costoUnitario = (p.costo !== undefined && p.costo !== null) ? p.costo : (prodBD?.costo || 0);
            const gananciaUnitaria = p.precio - costoUnitario;
            gananciaVentaAcumulada += gananciaUnitaria * p.cantidad;
        });

        const totalVentaFormateado = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(v.total);

        const gananciaVentaFormateada = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(gananciaVentaAcumulada);

        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--primary-color); vertical-align: top; padding-top: 12px;">${horaStr} hs</td>
            <td style="word-break: break-word; font-size: 0.9rem; color: #555; vertical-align: top; padding-top: 10px;">${prodHTML}</td>
            <td style="vertical-align: top; padding-top: 10px;">${cantHTML}</td>
            <td style="vertical-align: top; padding-top: 10px;">${totalProdHTML}</td>
            <td style="font-family: monospace; font-weight: 700; text-align: right; color: var(--primary-color); vertical-align: top; padding-top: 12px;">${totalVentaFormateado}</td>
            <td style="font-family: monospace; font-weight: 700; text-align: right; color: var(--secondary-color); vertical-align: top; padding-top: 12px;">${gananciaVentaFormateada}</td>
        `;
        tbody.appendChild(tr);
    });
}
