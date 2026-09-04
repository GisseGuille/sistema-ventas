/* --- MÓDULO DE IMPORTACIÓN / EXPORTACIÓN DE RESPALDO --- */
import { SALES_STORAGE_KEY, supabaseClient } from './config.js';
import { obtenerProductos, guardarProductosEnStorage, renderProductos } from './productos.js';
import { obtenerVentas } from './ventas.js';
import { obtenerProveedores, guardarProveedoresEnStorage, guardarPagosProveedoresEnStorage, renderProveedoresDropdown, renderPagosProveedores, obtenerPagosProveedores } from './proveedores.js';
import { actualizarReportes, renderVentasDelDia } from './reportes.js';

export function configurarRespaldoDatos() {
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const importFileInput = document.getElementById('importFile');

    if (btnExport) {
        btnExport.addEventListener('click', exportarDatos);
    }

    if (btnImport && importFileInput) {
        btnImport.addEventListener('click', () => {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', importarDatos);
    }
}

// Descarga un archivo JSON con los productos, ventas, proveedores y pagos actuales
export async function exportarDatos() {
    const productos = await obtenerProductos();
    const ventas = await obtenerVentas();
    const proveedores = await obtenerProveedores();
    const pagos = await obtenerPagosProveedores();

    const backupData = {
        productos: productos,
        ventas: ventas,
        proveedores: proveedores,
        pagos_proveedores: pagos
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const hoy = new Date().toISOString().split('T')[0];
    const filename = `bettina_guille_cocina_respaldo_${hoy}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Lee el archivo JSON cargado y restaura los datos en localStorage y Supabase
export function importarDatos(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data || typeof data !== 'object') {
                throw new Error('El archivo no contiene un objeto JSON válido.');
            }
            if (!Array.isArray(data.productos)) {
                throw new Error('Falta la lista de "productos" o no es válida.');
            }
            if (data.ventas && !Array.isArray(data.ventas)) {
                throw new Error('La sección "ventas" no es un formato válido.');
            }

            const confirmacion = confirm(
                `¿Seguro que querés importar los datos? Se sobrescribirá la información actual.\n\n` +
                `Productos a importar: ${data.productos.length}\n` +
                `Ventas a importar: ${data.ventas ? data.ventas.length : 0}\n` +
                `Comprobantes/Pagos a importar: ${data.pagos_proveedores ? data.pagos_proveedores.length : 0}`
            );

            if (confirmacion) {
                await guardarProductosEnStorage(data.productos);

                localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(data.ventas || []));

                if (data.proveedores && Array.isArray(data.proveedores)) {
                    await guardarProveedoresEnStorage(data.proveedores);
                }
                if (data.pagos_proveedores && Array.isArray(data.pagos_proveedores)) {
                    await guardarPagosProveedoresEnStorage(data.pagos_proveedores);
                }

                if (supabaseClient && data.ventas && data.ventas.length > 0) {
                    try {
                        const cabeceras = data.ventas.map(v => ({ id: v.id, fecha: v.fecha, total: v.total }));
                        await supabaseClient.from('ventas').upsert(cabeceras);

                        const detalles = [];
                        data.ventas.forEach(v => {
                            if (v.productos) {
                                v.productos.forEach(p => {
                                    detalles.push({
                                        venta_id: v.id,
                                        producto_id: p.id,
                                        nombre: p.nombre,
                                        costo: p.costo,
                                        precio: p.precio,
                                        cantidad: p.cantidad
                                    });
                                });
                            }
                        });

                        if (detalles.length > 0) {
                            await supabaseClient.from('detalle_ventas').upsert(detalles);
                        }
                    } catch (dbErr) {
                        console.error("Error al sincronizar importación de ventas en Supabase:", dbErr);
                    }
                }

                await renderProductos();
                await actualizarReportes();
                await renderVentasDelDia();
                await renderProveedoresDropdown();
                await renderPagosProveedores();

                alert('¡Los datos han sido restaurados con éxito!');
            }

        } catch (error) {
            alert('Error al importar el archivo: ' + error.message);
        }

        event.target.value = '';
    };

    reader.readAsText(file);
}
