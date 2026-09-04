/* --- MÓDULO DE VENTAS --- */
import { SALES_STORAGE_KEY, supabaseClient } from './config.js';
import { escapeHTML, formatearCantidad } from './utils.js';
import { obtenerProductos, guardarProductosEnStorage, renderProductos } from './productos.js';
import { actualizarReportes, renderVentasDelDia } from './reportes.js';
import { actualizarMetricasModoSimple } from './ui.js';

// Configura los eventos del módulo de registro de ventas
export function configurarModuloVentas() {
    const btnAdd = document.getElementById('btnAddSaleItem');
    if (btnAdd) {
        btnAdd.addEventListener('click', async () => {
            await agregarFilaVenta();
        });
    }

    const salesForm = document.getElementById('salesForm');
    if (salesForm) {
        salesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await confirmarVenta();
        });
    }
}

// Agrega una fila de ítem de venta dinámicamente
export async function agregarFilaVenta() {
    const container = document.getElementById('saleItemsContainer');
    if (!container) return;

    const productos = await obtenerProductos();
    const productosConStock = productos.filter(p => p.cantidad > 0 && (p.estado || 'Activo') !== 'Inactivo');

    if (productosConStock.length === 0) {
        alert('No hay productos con stock disponible para vender.');
        return;
    }

    const rowId = 'sale-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sale-item-row';
    rowDiv.id = rowId;

    let selectHTML = `<select class="form-control select-sale-product" required onchange="alCambiarProductoVenta(this)">`;
    selectHTML += `<option value="" disabled selected>Elegir producto...</option>`;
    productosConStock.forEach(prod => {
        const stockFmt = formatearCantidad(prod.cantidad, prod.unidad_medida);
        selectHTML += `<option value="${prod.id}" data-precio="${prod.precio}" data-stock="${prod.cantidad}" data-unidad="${prod.unidad_medida || 'Unidades'}">
            ${escapeHTML(prod.nombre)} (Stock: ${stockFmt} - $${prod.precio})
        </option>`;
    });
    selectHTML += `</select>`;

    rowDiv.innerHTML = `
        ${selectHTML}
        <div style="display: flex; align-items: center; gap: 5px;">
            <input
                type="number"
                step="any"
                min="0.001"
                value="1"
                class="form-control input-sale-qty"
                placeholder="Cant."
                required
                oninput="actualizarPreciosVenta()"
                style="width: 85px;"
            >
            <span class="label-sale-unit" style="font-size: 0.85rem; font-weight: 600; color: var(--primary-color); min-width: 25px;">un</span>
        </div>
        <button type="button" class="btn-remove-item" onclick="eliminarFilaVenta('${rowId}')" title="Quitar ítem">❌</button>
    `;

    container.appendChild(rowDiv);
    actualizarPreciosVenta();
}

// Manejador al seleccionar producto en la línea de venta
export function alCambiarProductoVenta(selectEl) {
    const row = selectEl.closest('.sale-item-row');
    if (row) {
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const unidad = selectedOption ? selectedOption.getAttribute('data-unidad') : 'Unidades';
        const unitLabel = row.querySelector('.label-sale-unit');

        let unitText = 'un';
        if (unidad === 'Kilos') unitText = 'kg';
        else if (unidad === 'Gramos') unitText = 'g';

        if (unitLabel) unitLabel.textContent = unitText;
    }
    actualizarPreciosVenta();
}

// Elimina una fila de venta seleccionada
export function eliminarFilaVenta(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        actualizarPreciosVenta();
    }
}

// Calcula el importe total de la venta en tiempo real
export function actualizarPreciosVenta() {
    const container = document.getElementById('saleItemsContainer');
    if (!container) return;

    const rows = container.getElementsByClassName('sale-item-row');
    let total = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const select = row.querySelector('.select-sale-product');
        const qtyInput = row.querySelector('.input-sale-qty');

        if (select && qtyInput && select.value !== '') {
            const selectedOption = select.options[select.selectedIndex];
            const precio = parseFloat(selectedOption.getAttribute('data-precio')) || 0;
            const cantidad = parseFloat(qtyInput.value) || 0;
            total += precio * cantidad;
        }
    }

    const label = document.getElementById('saleTotalLabel');
    if (label) {
        label.innerText = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(total);
    }
}

// Sincroniza los dropdowns cuando cambia la base de datos de productos (sin perder la selección actual)
export async function actualizarDropdownsVenta() {
    const selects = document.querySelectorAll('.select-sale-product');
    const productos = await obtenerProductos();
    const productosConStock = productos.filter(p => p.cantidad > 0 && (p.estado || 'Activo') !== 'Inactivo');

    selects.forEach(select => {
        const valorSeleccionado = select.value;
        select.innerHTML = `<option value="" disabled>Elegir producto...</option>`;

        let valorAunExiste = false;
        productosConStock.forEach(prod => {
            const stockFmt = formatearCantidad(prod.cantidad, prod.unidad_medida);
            const option = document.createElement('option');
            option.value = prod.id;
            option.setAttribute('data-precio', prod.precio);
            option.setAttribute('data-stock', prod.cantidad);
            option.setAttribute('data-unidad', prod.unidad_medida || 'Unidades');
            option.innerText = `${prod.nombre} (Stock: ${stockFmt} - $${prod.precio})`;
            select.appendChild(option);

            if (prod.id === valorSeleccionado) {
                valorAunExiste = true;
            }
        });

        if (valorSeleccionado && !valorAunExiste) {
            const prodOriginal = productos.find(p => p.id === valorSeleccionado);
            if (prodOriginal) {
                const option = document.createElement('option');
                option.value = prodOriginal.id;
                option.setAttribute('data-precio', prodOriginal.precio);
                option.setAttribute('data-stock', prodOriginal.cantidad);
                option.setAttribute('data-unidad', prodOriginal.unidad_medida || 'Unidades');
                option.innerText = `${prodOriginal.nombre} (Sin Stock - $${prodOriginal.precio})`;
                option.disabled = true;
                select.appendChild(option);
            }
        }

        select.value = valorSeleccionado;
    });
}

// Valida la venta, descuenta el stock de productos y la registra en 'ventas'
export async function confirmarVenta() {
    const container = document.getElementById('saleItemsContainer');
    if (!container) return;

    const rows = container.getElementsByClassName('sale-item-row');
    if (rows.length === 0) {
        alert('Debe agregar al menos un producto a la venta.');
        return;
    }

    const productos = await obtenerProductos();
    const itemsVenta = [];
    const idsAgregados = new Set();
    let totalVenta = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const select = row.querySelector('.select-sale-product');
        const qtyInput = row.querySelector('.input-sale-qty');

        if (!select || select.value === '') {
            alert('Por favor, seleccione un producto en todas las filas.');
            select.focus();
            return;
        }

        const prodId = select.value;
        const cantidad = parseFloat(qtyInput.value);

        if (isNaN(cantidad) || cantidad <= 0) {
            alert('La cantidad ingresada debe ser un número válido mayor a 0.');
            qtyInput.focus();
            return;
        }

        if (idsAgregados.has(prodId)) {
            alert('Has agregado el mismo producto más de una vez. Unifica las cantidades en una sola línea.');
            select.focus();
            return;
        }

        const prodOriginal = productos.find(p => p.id === prodId);
        if (!prodOriginal) {
            alert('El producto ya no se encuentra en el listado.');
            return;
        }

        if (cantidad > prodOriginal.cantidad) {
            const stockFmt = formatearCantidad(prodOriginal.cantidad, prodOriginal.unidad_medida);
            const solFmt = formatearCantidad(cantidad, prodOriginal.unidad_medida);
            alert(`Stock insuficiente para "${prodOriginal.nombre}". Stock disponible: ${stockFmt}, solicitado: ${solFmt}.`);
            qtyInput.focus();
            return;
        }

        idsAgregados.add(prodId);
        totalVenta += prodOriginal.precio * cantidad;

        itemsVenta.push({
            id: prodId,
            nombre: prodOriginal.nombre,
            costo: prodOriginal.costo !== undefined ? prodOriginal.costo : 0,
            precio: prodOriginal.precio,
            cantidad: cantidad,
            unidad_medida: prodOriginal.unidad_medida || 'Unidades'
        });
    }

    itemsVenta.forEach(item => {
        const prod = productos.find(p => p.id === item.id);
        if (prod) {
            prod.cantidad = Math.round((prod.cantidad - item.cantidad) * 1000) / 1000;
        }
    });

    await guardarProductosEnStorage(productos);

    const nuevaVenta = {
        id: 'sale-' + Date.now(),
        fecha: new Date().toISOString(),
        productos: itemsVenta,
        total: totalVenta
    };

    await guardarVentaEnStorage(nuevaVenta);

    container.innerHTML = '';
    actualizarPreciosVenta();

    await renderProductos();

    await actualizarReportes();
    await renderVentasDelDia();
    await actualizarMetricasModoSimple();

    alert('¡Venta confirmada correctamente! El stock ha sido descontado.');

    const productosConStock = productos.filter(p => p.cantidad > 0);
    if (productosConStock.length > 0) {
        await agregarFilaVenta();
    }
}

// Obtener historial de ventas desde Supabase o localStorage (respaldo)
export async function obtenerVentas() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('ventas')
                .select('*, productos:detalle_ventas(*)');
            if (error) throw error;
            localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(data || []));
            return data || [];
        } catch (err) {
            console.error("Error al obtener ventas de Supabase, usando respaldo local:", err);
        }
    }
    const ventasRaw = localStorage.getItem(SALES_STORAGE_KEY);
    return ventasRaw ? JSON.parse(ventasRaw) : [];
}

// Registrar una venta en Supabase y localStorage
export async function guardarVentaEnStorage(nuevaVenta) {
    const ventasRaw = localStorage.getItem(SALES_STORAGE_KEY);
    const ventas = ventasRaw ? JSON.parse(ventasRaw) : [];
    ventas.push(nuevaVenta);
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(ventas));

    if (supabaseClient) {
        try {
            const { error: errorVenta } = await supabaseClient
                .from('ventas')
                .insert({
                    id: nuevaVenta.id,
                    fecha: nuevaVenta.fecha,
                    total: nuevaVenta.total
                });
            if (errorVenta) throw errorVenta;

            const itemsInsert = nuevaVenta.productos.map(p => ({
                venta_id: nuevaVenta.id,
                producto_id: p.id,
                nombre: p.nombre,
                costo: p.costo,
                precio: p.precio,
                cantidad: p.cantidad,
                unidad_medida: p.unidad_medida || 'Unidades'
            }));

            const { error: errorDetalle } = await supabaseClient
                .from('detalle_ventas')
                .insert(itemsInsert);
            if (errorDetalle) throw errorDetalle;
        } catch (err) {
            console.error("Error al registrar venta en Supabase:", err);
            alert("Error al guardar venta en la base de datos en la nube. Los cambios se guardaron localmente.");
        }
    }
}
