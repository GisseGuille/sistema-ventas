/* --- MÓDULO DE GESTIÓN DE PRODUCTOS --- */
import { LOCAL_STORAGE_KEY, supabaseClient } from './config.js';
import { escapeHTML, formatearCantidad } from './utils.js';
import { actualizarDropdownsVenta } from './ventas.js';
import { cambiarPantalla } from './ui.js';

let editProductId = null; // Rastrea el ID del producto que se está editando
let sortColumn = 'nombre';
let sortDirection = 'asc';

// Establecer por defecto la fecha de hoy en el campo de fecha de compra
export function inicializarFecha() {
    const dateInput = document.getElementById('prodFecha');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
}

// Configura el manejador de eventos del formulario de productos
export function configurarFormulario() {
    const form = document.getElementById('productForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await guardarProducto();
        });
    }

    const costoInput = document.getElementById('prodCosto');
    const gananciaInput = document.getElementById('prodGanancia');
    if (costoInput) {
        costoInput.addEventListener('input', calcularPrecioDeVenta);
    }
    if (gananciaInput) {
        gananciaInput.addEventListener('input', calcularPrecioDeVenta);
    }
}

// Configura los escuchadores de eventos para los filtros del listado
export function configurarFiltros() {
    const searchInput = document.getElementById('searchNombre');
    const filterSelect = document.getElementById('filterCategoria');

    if (searchInput) {
        searchInput.addEventListener('input', renderProductos);
    }
    if (filterSelect) {
        filterSelect.addEventListener('change', renderProductos);
    }
}

// Configura el botón de cancelar edición de productos
export function configurarBotonCancelar() {
    const btnCancel = document.getElementById('btnCancelEdit');
    if (btnCancel) {
        btnCancel.addEventListener('click', cancelarEdicion);
    }
}

// Carga los datos de un producto en el formulario para su modificación (Modo Edición)
export async function editarProducto(id) {
    cambiarPantalla('productos');

    const productos = await obtenerProductos();
    const prod = productos.find(p => p.id === id);
    if (!prod) return;

    editProductId = prod.id;

    document.getElementById('prodNombre').value = prod.nombre;
    document.getElementById('prodCategoria').value = prod.categoria;
    document.getElementById('prodCosto').value = prod.costo !== undefined ? prod.costo : '';
    document.getElementById('prodGanancia').value = prod.ganancia !== undefined ? prod.ganancia : '';

    const costo = prod.costo !== undefined ? prod.costo : 0;
    const precio = prod.precio !== undefined ? prod.precio : 0;
    const gananciaPesos = precio - costo;
    document.getElementById('prodGananciaPesos').value = gananciaPesos.toFixed(2);

    document.getElementById('prodPrecio').value = prod.precio;
    document.getElementById('prodCantidad').value = prod.cantidad;
    if (document.getElementById('prodUnidad')) {
        document.getElementById('prodUnidad').value = prod.unidad_medida || 'Unidades';
    }
    document.getElementById('prodFecha').value = prod.fecha;

    document.getElementById('prodEstado').value = prod.estado || 'Activo';

    const btnSubmit = document.getElementById('btnSubmit');
    if (btnSubmit) btnSubmit.innerText = 'Actualizar Producto';

    const btnCancel = document.getElementById('btnCancelEdit');
    if (btnCancel) btnCancel.style.display = 'block';

    document.getElementById('productForm').scrollIntoView({ behavior: 'smooth' });
}

// Cancela la edición y devuelve el formulario a su estado de guardado normal
export function cancelarEdicion() {
    editProductId = null;

    document.getElementById('productForm').reset();
    if (document.getElementById('prodUnidad')) {
        document.getElementById('prodUnidad').value = 'Unidades';
    }
    inicializarFecha();

    const btnSubmit = document.getElementById('btnSubmit');
    if (btnSubmit) btnSubmit.innerText = 'Guardar Producto';

    const btnCancel = document.getElementById('btnCancelEdit');
    if (btnCancel) btnCancel.style.display = 'none';
}

// Calcula automáticamente el precio en base al costo y % de ganancia
export function calcularPrecioDeVenta() {
    const costoInput = document.getElementById('prodCosto');
    const gananciaInput = document.getElementById('prodGanancia');
    const precioInput = document.getElementById('prodPrecio');
    const gananciaPesosInput = document.getElementById('prodGananciaPesos');

    if (!costoInput || !gananciaInput || !precioInput) return;

    const costo = parseFloat(costoInput.value) || 0;
    const ganancia = parseFloat(gananciaInput.value) || 0;

    const precio = costo * (1 + (ganancia / 100));
    const gananciaPesos = precio - costo;

    precioInput.value = precio.toFixed(2);
    if (gananciaPesosInput) {
        gananciaPesosInput.value = gananciaPesos.toFixed(2);
    }
}

// Obtener productos desde Supabase o localStorage (respaldo)
export async function obtenerProductos() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('productos')
                .select('*');
            if (error) throw error;
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data || []));
            return data || [];
        } catch (err) {
            console.error("Error al obtener productos de Supabase, usando respaldo local:", err);
        }
    }
    const productosRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return productosRaw ? JSON.parse(productosRaw) : [];
}

// Guardar lista completa de productos en Supabase y localStorage
export async function guardarProductosEnStorage(productos) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(productos));
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient
                .from('productos')
                .upsert(productos);
            if (error) throw error;
        } catch (err) {
            console.error("Error al guardar productos en Supabase:", err);
            alert("Error de conexión a Base de Datos. Los cambios se guardaron localmente en este navegador.");
        }
    }
}

// Guardar o actualizar un producto
export async function guardarProducto() {
    const nombre = document.getElementById('prodNombre').value.trim();
    const categoria = document.getElementById('prodCategoria').value;
    const costoStr = document.getElementById('prodCosto').value.trim();
    const gananciaStr = document.getElementById('prodGanancia').value.trim();
    const cantidadStr = document.getElementById('prodCantidad').value.trim();
    const unidadMedida = document.getElementById('prodUnidad') ? document.getElementById('prodUnidad').value : 'Unidades';
    const fecha = document.getElementById('prodFecha').value;
    const estado = document.getElementById('prodEstado').value;

    if (nombre === '') {
        alert('El nombre del producto no puede estar vacío.');
        document.getElementById('prodNombre').focus();
        return;
    }

    if (costoStr === '') {
        alert('El costo del producto no puede estar vacío.');
        document.getElementById('prodCosto').focus();
        return;
    }
    const costo = Number(costoStr);
    if (isNaN(costo) || costo < 0) {
        alert('El costo debe ser un número válido mayor o igual a 0.');
        document.getElementById('prodCosto').focus();
        return;
    }

    if (gananciaStr === '') {
        alert('El porcentaje de ganancia no puede estar vacío.');
        document.getElementById('prodGanancia').focus();
        return;
    }
    const ganancia = Number(gananciaStr);
    if (isNaN(ganancia) || ganancia < 0) {
        alert('El porcentaje de ganancia debe ser un número válido mayor o igual a 0.');
        document.getElementById('prodGanancia').focus();
        return;
    }

    const precio = costo * (1 + (ganancia / 100));

    const cantidad = cantidadStr === '' ? 0 : parseFloat(cantidadStr);
    if (isNaN(cantidad) || cantidad < 0) {
        alert('La cantidad debe ser un número válido mayor o igual a 0.');
        document.getElementById('prodCantidad').focus();
        return;
    }

    const productos = await obtenerProductos();

    const nombreNormalizado = nombre.toLowerCase().trim();
    const nombreDuplicado = productos.some(p =>
        p.nombre.toLowerCase().trim() === nombreNormalizado &&
        p.id !== editProductId &&
        (p.estado || 'Activo') === 'Activo'
    );

    if (nombreDuplicado) {
        alert('El producto ya existe.');
        document.getElementById('prodNombre').focus();
        return;
    }

    if (editProductId) {
        const index = productos.findIndex(p => p.id === editProductId);
        if (index !== -1) {
            productos[index].nombre = nombre;
            productos[index].categoria = categoria || 'Sin categoría';
            productos[index].costo = costo;
            productos[index].ganancia = ganancia;
            productos[index].precio = precio;
            productos[index].cantidad = cantidad;
            productos[index].unidad_medida = unidadMedida;
            productos[index].fecha = fecha;
            productos[index].estado = estado;

            await guardarProductosEnStorage(productos);
            alert('¡Producto actualizado con éxito!');
        }

        editProductId = null;
        const btnSubmit = document.getElementById('btnSubmit');
        if (btnSubmit) btnSubmit.innerText = 'Guardar Producto';
        const btnCancel = document.getElementById('btnCancelEdit');
        if (btnCancel) btnCancel.style.display = 'none';

    } else {
        const nuevoProducto = {
            id: Date.now().toString(),
            nombre: nombre,
            categoria: categoria || 'Sin categoría',
            costo: costo,
            ganancia: ganancia,
            precio: precio,
            cantidad: cantidad,
            unidad_medida: unidadMedida,
            fecha: fecha,
            estado: estado || 'Activo'
        };

        productos.push(nuevoProducto);
        await guardarProductosEnStorage(productos);
        alert('¡Producto guardado con éxito!');
    }

    document.getElementById('productForm').reset();
    inicializarFecha();

    if (document.getElementById('searchNombre')) document.getElementById('searchNombre').value = '';
    if (document.getElementById('filterCategoria')) document.getElementById('filterCategoria').value = '';

    await renderProductos();
}

// Eliminar un producto (Baja directa y definitiva)
export async function eliminarProducto(id) {
    const productos = await obtenerProductos();
    const prod = productos.find(p => p.id === id);
    if (!prod) return;

    if (!confirm(`¿Estás seguro de que deseas eliminar el producto "${prod.nombre}"?`)) {
        return;
    }

    if (editProductId === id) {
        cancelarEdicion();
    }

    const productosActualizados = productos.filter(p => p.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(productosActualizados));

    if (supabaseClient) {
        try {
            const { error } = await supabaseClient
                .from('productos')
                .delete()
                .eq('id', id);
            if (error) {
                console.error("Error al eliminar en Supabase:", error);
            }
        } catch (err) {
            console.error("Error al conectar con Supabase:", err);
        }
    }

    await renderProductos();
    await actualizarDropdownsVenta();
    alert(`¡Producto "${prod.nombre}" eliminado con éxito!`);
}

// Renderizar la tabla de productos aplicando filtros
export async function renderProductos() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const productos = await obtenerProductos();

    const searchVal = document.getElementById('searchNombre') ? document.getElementById('searchNombre').value.toLowerCase().trim() : '';
    const catVal = document.getElementById('filterCategoria') ? document.getElementById('filterCategoria').value : '';

    const productosFiltrados = productos.filter(prod => {
        const coincideNombre = prod.nombre.toLowerCase().includes(searchVal);
        const coincideCategoria = catVal === '' || prod.categoria === catVal;
        return coincideNombre && coincideCategoria;
    });

    productosFiltrados.sort((a, b) => {
        let valA, valB;

        switch (sortColumn) {
            case 'fecha':
                valA = a.fecha ? new Date(a.fecha) : new Date(0);
                valB = b.fecha ? new Date(b.fecha) : new Date(0);
                break;
            case 'nombre':
                valA = (a.nombre || '').toLowerCase();
                valB = (b.nombre || '').toLowerCase();
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            case 'cantidad':
                valA = Number(a.cantidad) || 0;
                valB = Number(b.cantidad) || 0;
                break;
            case 'costo':
                valA = Number(a.costo) || 0;
                valB = Number(b.costo) || 0;
                break;
            case 'gananciaPorc':
                valA = Number(a.ganancia) || 0;
                valB = Number(b.ganancia) || 0;
                break;
            case 'precio':
                valA = Number(a.precio) || 0;
                valB = Number(b.precio) || 0;
                break;
            case 'gananciaPesos':
                valA = (Number(a.precio) || 0) - (Number(a.costo) || 0);
                valB = (Number(b.precio) || 0) - (Number(b.costo) || 0);
                break;
            default:
                return 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    actualizarIconosOrden();

    if (productos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-state-icon">📥</div>
                        <p>No hay productos registrados en el sistema.</p>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Los productos cargados aparecerán en esta lista.</p>
                    </div>
                </td>
            </tr>
        `;
        await actualizarDropdownsVenta();
        return;
    }

    if (productosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <p>No se encontraron productos que coincidan con la búsqueda.</p>
                        <p style="font-size: 0.85rem; margin-top: 5px;">Prueba modificando el buscador o el filtro de categoría.</p>
                    </div>
                </td>
            </tr>
        `;
        await actualizarDropdownsVenta();
        return;
    }

    tbody.innerHTML = '';
    productosFiltrados.forEach(prod => {
        const tr = document.createElement('tr');

        if (prod.cantidad === 0) {
            tr.style.backgroundColor = '#ffebee';
        }

        const costoFormateado = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(prod.costo || 0);

        const precioFormateado = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(prod.precio);

        const gananciaPesos = prod.precio - (prod.costo || 0);
        const gananciaFormateada = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(gananciaPesos);

        const gananciaPorcentaje = prod.ganancia !== undefined ? `${prod.ganancia}%` : '0%';

        let fechaFormateada = '-';
        if (prod.fecha) {
            const partes = prod.fecha.split('-');
            if (partes.length === 3) {
                fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            } else {
                fechaFormateada = prod.fecha;
            }
        }

        const estado = prod.estado || 'Activo';
        const estadoHTML = estado === 'Activo'
            ? `<span style="background-color: #e8f8f5; color: #16a085; padding: 2px 6px; border-radius: 12px; font-weight: 600;">Activo</span>`
            : `<span style="background-color: #fce4ec; color: #c2185b; padding: 2px 6px; border-radius: 12px; font-weight: 600;">Inactivo</span>`;

        tr.innerHTML = `
            <td>${fechaFormateada}</td>
            <td style="word-break: break-word;">
                <div style="font-weight: 600; color: var(--primary-color);">${escapeHTML(prod.nombre)}</div>
                <div style="font-size: 0.72rem; margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap;">
                    <span style="background-color: #eaf2f8; color: #2980b9; padding: 2px 6px; border-radius: 12px; font-weight: 600;">${escapeHTML(prod.categoria)}</span>
                    ${estadoHTML}
                </div>
            </td>
            <td style="text-align: center; font-weight: 600; font-family: monospace;">${formatearCantidad(prod.cantidad, prod.unidad_medida)}</td>
            <td style="font-family: monospace; font-weight: 600; text-align: right;">${costoFormateado}</td>
            <td style="text-align: center; font-weight: 600; color: #555;">${gananciaPorcentaje}</td>
            <td style="font-family: monospace; font-weight: 600; text-align: right; color: var(--primary-color);">${precioFormateado}</td>
            <td style="font-family: monospace; font-weight: 700; text-align: right; color: var(--secondary-color);">${gananciaFormateada}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn-edit" title="Editar Producto" onclick="editarProducto('${prod.id}')">✏️</button>
                <button class="btn-delete" title="Eliminar Producto" onclick="eliminarProducto('${prod.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    await actualizarDropdownsVenta();
}

// Conmuta la columna y dirección de ordenamiento, y re-renderiza la grilla
export async function ordenarGrilla(columna) {
    if (sortColumn === columna) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = columna;
        sortDirection = 'asc';
    }
    await renderProductos();
}

// Actualiza el indicador visual de ordenación (flechas o neutral) en las cabeceras
export function actualizarIconosOrden() {
    const columnas = ['fecha', 'nombre', 'cantidad', 'costo', 'gananciaPorc', 'precio', 'gananciaPesos'];
    columnas.forEach(col => {
        const span = document.getElementById('sort-icon-' + col);
        if (span) {
            if (sortColumn === col) {
                span.innerText = sortDirection === 'asc' ? ' ▲' : ' ▼';
                span.style.color = 'var(--secondary-color)';
            } else {
                span.innerText = ' ↕';
                span.style.color = '#ccc';
            }
        }
    });
}
