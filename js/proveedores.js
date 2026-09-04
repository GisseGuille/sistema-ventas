/* --- MÓDULO DE PAGO A PROVEEDORES Y COMPROBANTES --- */
import { SUPPLIERS_STORAGE_KEY, PAYMENTS_STORAGE_KEY, supabaseClient } from './config.js';
import { escapeHTML } from './utils.js';
import { cambiarPantalla } from './ui.js';

let editPaymentId = null;
let tempComprobanteBase64 = null;

const PROVEEDORES_DEFAULT = [
    { id: 'prov-1', nombre: 'Distribuidora San Juan', telefono: '342-4567890' },
    { id: 'prov-2', nombre: 'Molino Cañuelas', telefono: '0800-333-6654' },
    { id: 'prov-3', nombre: 'Lácteos del Sur', telefono: '342-4112233' },
    { id: 'prov-4', nombre: 'Verdulería Mayorista Central', telefono: '342-4998877' },
    { id: 'prov-5', nombre: 'Envases y Descartables Santa Fe', telefono: '342-4881122' }
];

// Obtener proveedores desde Supabase o localStorage
export async function obtenerProveedores() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('proveedores').select('*').order('nombre', { ascending: true });
            if (!error && data && data.length > 0) {
                localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(data));
                return data;
            }
        } catch (err) {
            console.error("Error al obtener proveedores de Supabase, usando local:", err);
        }
    }
    const raw = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    if (raw) {
        try { return JSON.parse(raw); } catch (e) { return PROVEEDORES_DEFAULT; }
    }
    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(PROVEEDORES_DEFAULT));
    return PROVEEDORES_DEFAULT;
}

// Guardar proveedores en storage y Supabase
export async function guardarProveedoresEnStorage(proveedores) {
    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(proveedores));
    if (supabaseClient) {
        try {
            await supabaseClient.from('proveedores').upsert(proveedores);
        } catch (err) {
            console.error("Error al guardar proveedores en Supabase:", err);
        }
    }
}

// Renderizar menús desplegables de proveedores
export async function renderProveedoresDropdown() {
    const proveedores = await obtenerProveedores();
    const selectForm = document.getElementById('payProveedor');
    const selectFiltro = document.getElementById('filtroPayProveedor');

    if (selectForm) {
        const actualVal = selectForm.value;
        selectForm.innerHTML = '<option value="">Selecciona un proveedor...</option>';
        proveedores.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.nombre;
            opt.textContent = p.nombre + (p.telefono ? ` (${p.telefono})` : '');
            selectForm.appendChild(opt);
        });
        if (actualVal) selectForm.value = actualVal;
    }

    if (selectFiltro) {
        const actualFiltro = selectFiltro.value;
        selectFiltro.innerHTML = '<option value="">Todos los proveedores</option>';
        proveedores.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.nombre;
            opt.textContent = p.nombre;
            selectFiltro.appendChild(opt);
        });
        if (actualFiltro) selectFiltro.value = actualFiltro;
    }

    renderListaProveedoresModal(proveedores);
}

// Renderizar lista en modal de administración de proveedores
export function renderListaProveedoresModal(proveedores) {
    const container = document.getElementById('listaProveedoresExistentes');
    if (!container) return;
    if (proveedores.length === 0) {
        container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">No hay proveedores registrados.</span>';
        return;
    }
    container.innerHTML = proveedores.map(p => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.85rem;">
            <div>
                <strong>${escapeHTML(p.nombre)}</strong>
                ${p.telefono ? `<span style="color: var(--text-muted); margin-left: 5px;">(${escapeHTML(p.telefono)})</span>` : ''}
            </div>
            <button type="button" onclick="eliminarProveedor('${p.id}')" title="Eliminar Proveedor" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 0.9rem;">🗑️</button>
        </div>
    `).join('');
}

export function abrirModalNuevoProveedor() {
    const modal = document.getElementById('modalNuevoProveedor');
    if (modal) {
        document.getElementById('nuevoProveedorNombre').value = '';
        document.getElementById('nuevoProveedorTelefono').value = '';
        modal.style.display = 'flex';
    }
}

export function cerrarModalNuevoProveedor() {
    const modal = document.getElementById('modalNuevoProveedor');
    if (modal) modal.style.display = 'none';
}

export async function guardarNuevoProveedor() {
    const nombre = document.getElementById('nuevoProveedorNombre').value.trim();
    const telefono = document.getElementById('nuevoProveedorTelefono').value.trim();
    if (!nombre) {
        alert('Por favor, ingresa el nombre del proveedor.');
        return;
    }
    const proveedores = await obtenerProveedores();
    if (proveedores.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
        alert('Ya existe un proveedor con ese nombre.');
        return;
    }
    const nuevo = {
        id: 'prov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        nombre: nombre,
        telefono: telefono || ''
    };
    proveedores.push(nuevo);
    await guardarProveedoresEnStorage(proveedores);
    await renderProveedoresDropdown();

    const selectForm = document.getElementById('payProveedor');
    if (selectForm) selectForm.value = nuevo.nombre;
    cerrarModalNuevoProveedor();
}

export async function eliminarProveedor(id) {
    const proveedores = await obtenerProveedores();
    const prov = proveedores.find(p => p.id === id);
    if (!prov) return;
    if (!confirm(`¿Seguro que deseas eliminar al proveedor "${prov.nombre}"?`)) return;
    const actualizados = proveedores.filter(p => p.id !== id);
    await guardarProveedoresEnStorage(actualizados);
    if (supabaseClient) {
        try { await supabaseClient.from('proveedores').delete().eq('id', id); } catch (e) {}
    }
    await renderProveedoresDropdown();
}

// Obtener historial de pagos a proveedores desde Supabase o localStorage
export async function obtenerPagosProveedores() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('pagos_proveedores').select('*').order('fecha_compra', { ascending: false });
            if (!error && data) {
                localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(data));
                return data;
            }
        } catch (err) {
            console.error("Error al obtener pagos de proveedores de Supabase:", err);
        }
    }
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

// Guardar pagos en storage y Supabase
export async function guardarPagosProveedoresEnStorage(pagos) {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(pagos));
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('pagos_proveedores').upsert(pagos);
            if (error) throw error;
        } catch (err) {
            console.error("Error al guardar pagos a proveedores en Supabase:", err);
        }
    }
}

// Procesar y comprimir imágenes de comprobantes usando Canvas
export function procesarArchivoComprobante(file) {
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        alert('Formato de imagen no válido. Por favor sube un archivo PNG, JPG, JPEG o GIF.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const maxDimension = 1200;
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.82);
            tempComprobanteBase64 = compressedBase64;
            mostrarPreviewComprobante(compressedBase64, file.name);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

export function mostrarPreviewComprobante(base64, filename) {
    const prompt = document.getElementById('dropzonePrompt');
    const preview = document.getElementById('dropzonePreview');
    const img = document.getElementById('imgPreviewComprobante');
    const nameLabel = document.getElementById('previewFileName');

    if (prompt) prompt.style.display = 'none';
    if (preview) preview.style.display = 'flex';
    if (img) img.src = base64;
    if (nameLabel) nameLabel.textContent = filename || 'Comprobante adjunto';
}

export function eliminarComprobanteCargado() {
    tempComprobanteBase64 = null;
    const prompt = document.getElementById('dropzonePrompt');
    const preview = document.getElementById('dropzonePreview');
    const fileInput = document.getElementById('fileComprobante');
    const img = document.getElementById('imgPreviewComprobante');

    if (prompt) prompt.style.display = 'flex';
    if (preview) preview.style.display = 'none';
    if (fileInput) fileInput.value = '';
    if (img) img.src = '';
}

export function actualizarFechaPagoSegunEstado() {
    const estado = document.getElementById('payEstado').value;
    const fechaPagoInput = document.getElementById('payFechaPago');
    if (estado === 'Pagado' && fechaPagoInput && !fechaPagoInput.value) {
        fechaPagoInput.value = new Date().toISOString().split('T')[0];
    }
}

export async function guardarPagoProveedor(event) {
    if (event) event.preventDefault();

    const fechaCompra = document.getElementById('payFechaCompra').value;
    const proveedor = document.getElementById('payProveedor').value;
    const importeStr = document.getElementById('payImporte').value;
    const formaPago = document.getElementById('payFormaPago').value;
    const fechaPago = document.getElementById('payFechaPago').value || null;
    const estado = document.getElementById('payEstado').value;
    const notas = document.getElementById('payNotas').value.trim();

    if (!fechaCompra) {
        alert('Por favor, selecciona la fecha de compra.');
        return;
    }
    if (!proveedor) {
        alert('Por favor, selecciona un proveedor.');
        return;
    }
    const importe = parseFloat(importeStr);
    if (isNaN(importe) || importe <= 0) {
        alert('Por favor, ingresa un importe válido mayor a 0.');
        return;
    }

    const pagos = await obtenerPagosProveedores();

    if (editPaymentId) {
        const index = pagos.findIndex(p => p.id === editPaymentId);
        if (index !== -1) {
            pagos[index].fecha_compra = fechaCompra;
            pagos[index].proveedor = proveedor;
            pagos[index].importe = importe;
            pagos[index].forma_pago = formaPago;
            pagos[index].fecha_pago = fechaPago;
            pagos[index].estado = estado;
            pagos[index].notas = notas;
            if (tempComprobanteBase64 !== null) {
                pagos[index].comprobante_base64 = tempComprobanteBase64;
            }
        }
        alert('¡Comprobante actualizado correctamente!');
    } else {
        const nuevoPago = {
            id: 'pago-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            fecha_compra: fechaCompra,
            proveedor: proveedor,
            importe: importe,
            forma_pago: formaPago,
            fecha_pago: fechaPago,
            estado: estado,
            notas: notas,
            comprobante_base64: tempComprobanteBase64 || null,
            fecha_registro: new Date().toISOString()
        };
        pagos.unshift(nuevoPago);
        alert('¡Comprobante y pago registrado con éxito!');
    }

    await guardarPagosProveedoresEnStorage(pagos);
    cancelarEdicionPago();
    await renderPagosProveedores();
}

export async function renderPagosProveedores() {
    const pagos = await obtenerPagosProveedores();
    const tbody = document.getElementById('supplierPaymentsTableBody');
    const cantLabel = document.getElementById('cantComprobantesLabel');
    const filtroProv = document.getElementById('filtroPayProveedor') ? document.getElementById('filtroPayProveedor').value : '';
    const filtroEst = document.getElementById('filtroPayEstado') ? document.getElementById('filtroPayEstado').value : '';
    const filtroDesde = document.getElementById('filtroPayFechaDesde') ? document.getElementById('filtroPayFechaDesde').value : '';
    const filtroHasta = document.getElementById('filtroPayFechaHasta') ? document.getElementById('filtroPayFechaHasta').value : '';

    let totalCompras = 0;
    let totalPagado = 0;
    let totalPendiente = 0;

    pagos.forEach(p => {
        const imp = Number(p.importe) || 0;
        totalCompras += imp;
        if (p.estado === 'Pagado') {
            totalPagado += imp;
        } else {
            totalPendiente += imp;
        }
    });

    const kpiComprasEl = document.getElementById('kpiTotalCompras');
    const kpiPagadoEl = document.getElementById('kpiTotalPagado');
    const kpiPendienteEl = document.getElementById('kpiTotalPendiente');

    if (kpiComprasEl) kpiComprasEl.textContent = '$' + totalCompras.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiPagadoEl) kpiPagadoEl.textContent = '$' + totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kpiPendienteEl) kpiPendienteEl.textContent = '$' + totalPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let filtrados = pagos.filter(p => {
        if (filtroProv && p.proveedor !== filtroProv) return false;
        if (filtroEst && p.estado !== filtroEst) return false;
        if (filtroDesde && p.fecha_compra < filtroDesde) return false;
        if (filtroHasta && p.fecha_compra > filtroHasta) return false;
        return true;
    });

    if (cantLabel) {
        cantLabel.textContent = `${filtrados.length} comprobante${filtrados.length === 1 ? '' : 's'} visible${filtrados.length === 1 ? '' : 's'}`;
    }

    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">
                    No se encontraron comprobantes con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    filtrados.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';

        const badgeClass = p.estado === 'Pagado' ? 'badge-status-pagado' : 'badge-status-pendiente';
        const badgeIcon = p.estado === 'Pagado' ? '✅ Pagado' : '⏳ Pendiente';

        let thumbHtml = '<span style="color: var(--text-muted); font-size: 0.8rem;">Sin foto</span>';
        if (p.comprobante_base64) {
            thumbHtml = `<img src="${p.comprobante_base64}" class="comprobante-thumb" alt="Foto Factura" title="Clic para ver comprobante" onclick="abrirModalVerComprobante('${p.id}', 'Factura: ${escapeHTML(p.proveedor)}')">`;
        }

        const fechaCompraFmt = p.fecha_compra ? p.fecha_compra.split('-').reverse().join('/') : '-';
        const fechaPagoFmt = p.fecha_pago ? p.fecha_pago.split('-').reverse().join('/') : '-';

        tr.innerHTML = `
            <td style="padding: 10px 8px; font-weight: 500; font-size: 0.9rem;">${fechaCompraFmt}</td>
            <td style="padding: 10px 8px; font-weight: 600; color: var(--primary-color);">
                ${escapeHTML(p.proveedor)}
                ${p.notas ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">📝 ${escapeHTML(p.notas)}</div>` : ''}
            </td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; font-family: monospace; font-size: 1rem; color: ${p.estado === 'Pagado' ? 'var(--text-color)' : '#d97706'};">
                $${Number(p.importe).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style="padding: 10px 8px; font-size: 0.85rem; color: var(--text-muted);">${escapeHTML(p.forma_pago || 'Efectivo')}</td>
            <td style="padding: 10px 8px; font-size: 0.85rem; color: var(--text-muted);">${fechaPagoFmt}</td>
            <td style="padding: 10px 8px; text-align: center;">
                <span class="badge-status ${badgeClass}">${badgeIcon}</span>
            </td>
            <td style="padding: 6px 8px; text-align: center;">
                ${thumbHtml}
            </td>
            <td style="padding: 10px 8px; text-align: center;">
                <div style="display: flex; gap: 4px; justify-content: center;">
                    <button type="button" class="btn-status-toggle" title="Cambiar Estado (Pagado/Pendiente)" onclick="cambiarEstadoPago('${p.id}')">
                        ${p.estado === 'Pagado' ? '🔄' : '💰'}
                    </button>
                    <button type="button" class="btn-edit" title="Editar Pago" onclick="editarPagoProveedor('${p.id}')">
                        ✏️
                    </button>
                    <button type="button" class="btn-delete" title="Eliminar Comprobante" onclick="eliminarPagoProveedor('${p.id}')">
                        🗑️
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export async function cambiarEstadoPago(id) {
    const pagos = await obtenerPagosProveedores();
    const p = pagos.find(x => x.id === id);
    if (!p) return;

    if (p.estado === 'Pagado') {
        p.estado = 'Pendiente';
    } else {
        p.estado = 'Pagado';
        if (!p.fecha_pago) {
            p.fecha_pago = new Date().toISOString().split('T')[0];
        }
    }
    await guardarPagosProveedoresEnStorage(pagos);
    await renderPagosProveedores();
}

export async function editarPagoProveedor(id) {
    const pagos = await obtenerPagosProveedores();
    const p = pagos.find(x => x.id === id);
    if (!p) return;

    editPaymentId = p.id;
    cambiarPantalla('proveedores');

    document.getElementById('payFechaCompra').value = p.fecha_compra || '';
    document.getElementById('payProveedor').value = p.proveedor || '';
    document.getElementById('payImporte').value = p.importe || '';
    document.getElementById('payFormaPago').value = p.forma_pago || 'Efectivo';
    document.getElementById('payFechaPago').value = p.fecha_pago || '';
    document.getElementById('payEstado').value = p.estado || 'Pendiente';
    document.getElementById('payNotas').value = p.notas || '';

    if (p.comprobante_base64) {
        tempComprobanteBase64 = p.comprobante_base64;
        mostrarPreviewComprobante(p.comprobante_base64, 'Comprobante guardado');
    } else {
        eliminarComprobanteCargado();
    }

    const btnSubmit = document.getElementById('btnSubmitPago');
    const btnCancel = document.getElementById('btnCancelPagoEdit');
    const formTitle = document.getElementById('supplierFormTitle');

    if (btnSubmit) btnSubmit.innerText = '💾 Actualizar Comprobante / Pago';
    if (btnCancel) btnCancel.style.display = 'inline-block';
    if (formTitle) formTitle.querySelector('span').innerText = '✏️ Editando Comprobante de Proveedor';

    document.getElementById('supplierPaymentForm').scrollIntoView({ behavior: 'smooth' });
}

export function cancelarEdicionPago() {
    editPaymentId = null;
    tempComprobanteBase64 = null;
    const form = document.getElementById('supplierPaymentForm');
    if (form) form.reset();

    const fechaHoy = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('payFechaCompra');
    if (fechaInput) fechaInput.value = fechaHoy;

    eliminarComprobanteCargado();

    const btnSubmit = document.getElementById('btnSubmitPago');
    const btnCancel = document.getElementById('btnCancelPagoEdit');
    const formTitle = document.getElementById('supplierFormTitle');

    if (btnSubmit) btnSubmit.innerText = '💾 Registrar Comprobante / Pago';
    if (btnCancel) btnCancel.style.display = 'none';
    if (formTitle) formTitle.querySelector('span').innerText = '🧾 Cargar Comprobante / Pago a Proveedor';
}

export async function eliminarPagoProveedor(id) {
    const pagos = await obtenerPagosProveedores();
    const p = pagos.find(x => x.id === id);
    if (!p) return;

    if (!confirm(`¿Seguro que deseas eliminar el comprobante de "${p.proveedor}" por $${p.importe}?`)) return;

    const actualizados = pagos.filter(x => x.id !== id);
    await guardarPagosProveedoresEnStorage(actualizados);

    if (supabaseClient) {
        try {
            await supabaseClient.from('pagos_proveedores').delete().eq('id', id);
        } catch (e) {
            console.error("Error al eliminar pago en Supabase:", e);
        }
    }
    await renderPagosProveedores();
}

export function limpiarFiltrosPagos() {
    if (document.getElementById('filtroPayProveedor')) document.getElementById('filtroPayProveedor').value = '';
    if (document.getElementById('filtroPayEstado')) document.getElementById('filtroPayEstado').value = '';
    if (document.getElementById('filtroPayFechaDesde')) document.getElementById('filtroPayFechaDesde').value = '';
    if (document.getElementById('filtroPayFechaHasta')) document.getElementById('filtroPayFechaHasta').value = '';
    renderPagosProveedores();
}

export async function abrirModalVerComprobante(source, titulo) {
    let base64 = source;
    if (source && !source.startsWith('data:image')) {
        const pagos = await obtenerPagosProveedores();
        const p = pagos.find(x => x.id === source);
        if (p && p.comprobante_base64) {
            base64 = p.comprobante_base64;
            titulo = `Factura: ${p.proveedor} ($${p.importe})`;
        }
    }

    if (!base64) return;
    const modal = document.getElementById('modalVerComprobante');
    const img = document.getElementById('modalComprobanteImg');
    const titleEl = document.getElementById('modalComprobanteTitulo');
    const downloadBtn = document.getElementById('btnDescargarComprobante');

    if (modal && img) {
        img.src = base64;
        if (titleEl) titleEl.textContent = titulo || '📸 Comprobante de Respaldo';
        if (downloadBtn) {
            downloadBtn.href = base64;
            downloadBtn.download = `comprobante_${(titulo || 'pago').replace(/\s+/g, '_').toLowerCase()}.jpg`;
        }
        modal.style.display = 'flex';
    }
}

export function cerrarModalVerComprobante() {
    const modal = document.getElementById('modalVerComprobante');
    if (modal) modal.style.display = 'none';
}

// Abre la vista ampliada de la foto que el usuario acaba de adjuntar (aún no guardada)
export function verComprobanteTemporal() {
    abrirModalVerComprobante(tempComprobanteBase64, 'Vista Previa Comprobante');
}

export function configurarModuloProveedores() {
    const form = document.getElementById('supplierPaymentForm');
    if (form) {
        form.addEventListener('submit', guardarPagoProveedor);
    }

    const fechaCompraInput = document.getElementById('payFechaCompra');
    if (fechaCompraInput) {
        fechaCompraInput.value = new Date().toISOString().split('T')[0];
    }

    const dropzone = document.getElementById('dropzoneComprobante');
    const fileInput = document.getElementById('fileComprobante');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                procesarArchivoComprobante(e.target.files[0]);
            }
        });
    }

    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                procesarArchivoComprobante(files[0]);
            }
        }, false);
    }

    renderProveedoresDropdown();
    renderPagosProveedores();
}
