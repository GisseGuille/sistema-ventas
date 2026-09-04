/* --- MÓDULO DE VENTA POR VOZ CON IA (GOOGLE GEMINI) --- */
import { escapeHTML, formatearCantidad } from './utils.js';
import { obtenerProductos, guardarProductosEnStorage, renderProductos } from './productos.js';
import { guardarVentaEnStorage } from './ventas.js';
import { actualizarReportes, renderVentasDelDia } from './reportes.js';
import { actualizarMetricasModoSimple } from './ui.js';
import { llamarGemini } from './ia-gemini.js';

let recognitionVentaIA = null;
let isRecordingVentaIA = false;
let itemsVentaIAPrevia = [];

export function abrirModalVentaVozIA() {
    const modal = document.getElementById('modalVentaVozIA');
    if (!modal) return;
    modal.style.display = 'flex';
}

export function cerrarModalVentaVozIA() {
    if (isRecordingVentaIA) {
        detenerGrabacionVentaIA();
    }
    const modal = document.getElementById('modalVentaVozIA');
    if (modal) modal.style.display = 'none';
}

export function limpiarEntradaVentaIA() {
    const textarea = document.getElementById('txtEntradaVentaIA');
    if (textarea) textarea.value = '';
    cancelarPreviewVentaIA();
}

export function toggleGrabacionVentaIA() {
    if (isRecordingVentaIA) {
        detenerGrabacionVentaIA();
    } else {
        iniciarGrabacionVentaIA();
    }
}

export function iniciarGrabacionVentaIA() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Tu navegador no soporta reconocimiento de voz nativo. Puedes escribir o pegar la venta directamente en el cuadro de texto.');
        return;
    }

    if (!recognitionVentaIA) {
        recognitionVentaIA = new SpeechRecognition();
        recognitionVentaIA.lang = 'es-AR';
        recognitionVentaIA.continuous = true;
        recognitionVentaIA.interimResults = true;

        recognitionVentaIA.onresult = (event) => {
            let textoFinal = '';
            for (let i = 0; i < event.results.length; i++) {
                textoFinal += event.results[i][0].transcript + ' ';
            }
            const textarea = document.getElementById('txtEntradaVentaIA');
            if (textarea) {
                textarea.value = textoFinal.trim();
            }
        };

        recognitionVentaIA.onerror = (event) => {
            console.error('Error en reconocimiento de voz de venta:', event);
            detenerGrabacionVentaIA();
        };

        recognitionVentaIA.onend = () => {
            detenerGrabacionVentaIA();
        };
    }

    try {
        recognitionVentaIA.start();
        isRecordingVentaIA = true;
        const btn = document.getElementById('btnGrabarVentaIA');
        const txt = document.getElementById('txtGrabarVentaIA');
        const icon = document.getElementById('iconGrabarVentaIA');
        if (btn) btn.classList.add('btn-recording');
        if (txt) txt.innerText = 'Escuchando... (Toca para parar)';
        if (icon) icon.innerText = '🛑';
    } catch (err) {
        console.error('No se pudo iniciar reconocimiento de venta:', err);
    }
}

export function detenerGrabacionVentaIA() {
    if (recognitionVentaIA && isRecordingVentaIA) {
        try {
            recognitionVentaIA.stop();
        } catch(e) {}
    }
    isRecordingVentaIA = false;
    const btn = document.getElementById('btnGrabarVentaIA');
    const txt = document.getElementById('txtGrabarVentaIA');
    const icon = document.getElementById('iconGrabarVentaIA');
    if (btn) btn.classList.remove('btn-recording');
    if (txt) txt.innerText = 'Comenzar a Hablar';
    if (icon) icon.innerText = '🎙️';
}

export async function procesarVentaConGeminiIA() {
    const textarea = document.getElementById('txtEntradaVentaIA');
    const texto = textarea ? textarea.value.trim() : '';

    if (!texto) {
        alert('Por favor habla por el micrófono o escribe los productos vendidos.');
        if (textarea) textarea.focus();
        return;
    }

    if (isRecordingVentaIA) {
        detenerGrabacionVentaIA();
    }

    const loading = document.getElementById('loadingVentaIA');
    const seccionPreview = document.getElementById('seccionPreviewVentaIA');
    const btnProcesar = document.getElementById('btnProcesarVentaIA');

    if (loading) loading.style.display = 'block';
    if (seccionPreview) seccionPreview.style.display = 'none';
    if (btnProcesar) btnProcesar.disabled = true;

    const productosBD = await obtenerProductos();
    const catalogo = productosBD
        .filter(p => (p.estado || 'Activo') === 'Activo')
        .map(p => ({
            id: p.id,
            nombre: p.nombre,
            categoria: p.categoria,
            precio: p.precio,
            costo: p.costo || 0,
            stock: p.cantidad,
            unidad_medida: p.unidad_medida || 'Unidades'
        }));

    const promptSistema = `Eres un asistente de punto de venta (POS) para un negocio de alimentos y cocina en Argentina ("Bettina Guille - Cocina").
Tu trabajo es interpretar un dictado por voz de una venta realizada y mapear cada producto vendido con el catálogo de productos disponibles.

Catálogo disponible:
${JSON.stringify(catalogo, null, 2)}

Texto dictado:
"${texto}"

Debes responder ÚNICAMENTE con un objeto JSON válido (sin markdown \`\`\`json) con esta estructura:
{
  "cliente": "Nombre del cliente si fue mencionado, o 'Consumidor Final'",
  "forma_pago": "Uno de: 'Efectivo', 'Transferencia / MP', 'Débito', 'Crédito', 'Cuenta Corriente'. Si no se menciona, usa 'Efectivo'",
  "items": [
    {
      "producto_id": "El 'id' exacto del producto en el catálogo que mejor coincida",
      "nombre": "El 'nombre' exacto del producto en el catálogo",
      "cantidad": número decimal o entero vendido (ej: 'dos kilos y medio' -> 2.5, 'medio kilo' -> 0.5, 'un cuarto' -> 0.25, 'tres' -> 3, '500g' -> 0.5 si la unidad es Kilos o 500 si es Gramos),
      "unidad_medida": "La unidad del catálogo ('Kilos', 'Gramos' o 'Unidades')",
      "precio_unitario": número con el precio del catálogo,
      "costo": número con el costo del catálogo
    }
  ]
}

Reglas:
1. Solo incluye ítems que coincidan con algún producto del catálogo.
2. Si el producto se vende por peso (Kilos/Gramos), respeta la unidad_medida del catálogo y convierte adecuadamente las fracciones argentinas.
3. Asocia la forma de pago si el usuario dice "efectivo", "transferencia", "mercado pago", "debito", "credito" o "fiado/cuenta corriente".`;

    try {
        const data = await llamarGemini(
            [{ role: 'user', parts: [{ text: promptSistema }] }],
            { temperature: 0.1, responseMimeType: "application/json" }
        );

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const ventaParsed = JSON.parse(cleanedText);

        if (!ventaParsed.items || ventaParsed.items.length === 0) {
            alert('No pudimos asociar ningún producto del catálogo con lo dictado. Revisa que los nombres coincidan con los productos cargados en el inventario.');
            return;
        }

        itemsVentaIAPrevia = ventaParsed.items.map(item => {
            const prodBD = catalogo.find(p => p.id === item.producto_id) || catalogo.find(p => p.nombre.toLowerCase().trim() === (item.nombre || '').toLowerCase().trim());
            const precio = prodBD ? prodBD.precio : (Number(item.precio_unitario) || 0);
            const costo = prodBD ? prodBD.costo : (Number(item.costo) || 0);
            const id = prodBD ? prodBD.id : item.producto_id;
            const nombre = prodBD ? prodBD.nombre : item.nombre;
            const unidad = prodBD ? prodBD.unidad_medida : (item.unidad_medida || 'Unidades');
            const cantidad = Number(item.cantidad) || 1;
            const stock = prodBD ? prodBD.stock : 0;

            return {
                id,
                producto_id: id,
                nombre,
                cantidad,
                unidad_medida: unidad,
                precio,
                costo,
                subtotal: precio * cantidad,
                stock
            };
        });

        const clienteInput = document.getElementById('previewVentaCliente');
        const formaPagoSelect = document.getElementById('previewVentaFormaPago');
        if (clienteInput) clienteInput.value = ventaParsed.cliente || 'Consumidor Final';
        if (formaPagoSelect && ventaParsed.forma_pago) {
            for (let opt of formaPagoSelect.options) {
                if (opt.value.toLowerCase().includes(ventaParsed.forma_pago.toLowerCase())) {
                    formaPagoSelect.value = opt.value;
                    break;
                }
            }
        }

        renderizarTablaPreviaVentaIA();

    } catch (err) {
        console.error('Error al procesar venta con Gemini:', err);
        alert('Error al comunicarse con la Inteligencia Artificial:\n' + err.message);
    } finally {
        if (loading) loading.style.display = 'none';
        if (btnProcesar) btnProcesar.disabled = false;
    }
}

export function renderizarTablaPreviaVentaIA() {
    const tbody = document.getElementById('tablaPreviewVentaIABody');
    const seccion = document.getElementById('seccionPreviewVentaIA');
    const totalLabel = document.getElementById('previewVentaTotalLabel');

    if (!tbody || !seccion) return;

    tbody.innerHTML = '';

    if (itemsVentaIAPrevia.length === 0) {
        seccion.style.display = 'none';
        return;
    }

    let total = 0;

    itemsVentaIAPrevia.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        item.subtotal = subtotal;
        total += subtotal;

        const tr = document.createElement('tr');
        const stockInsuficiente = item.cantidad > item.stock;
        if (stockInsuficiente) {
            tr.style.backgroundColor = '#ffebee';
        }

        const stockFmt = formatearCantidad(item.stock, item.unidad_medida);

        tr.innerHTML = `
            <td style="padding: 8px;">
                <div style="font-weight: 600; color: var(--primary-color);">${escapeHTML(item.nombre)}</div>
                <small style="font-size: 0.75rem; color: ${stockInsuficiente ? '#c0392b; font-weight: 700;' : 'var(--text-muted)'};">
                    Stock disponible: ${stockFmt} ${stockInsuficiente ? '(⚠️ Stock insuficiente)' : ''}
                </small>
            </td>
            <td style="padding: 8px; text-align: center;">
                <input type="number" step="any" min="0" value="${item.cantidad}" class="form-control" style="width: 85px; text-align: center; font-size: 0.88rem; display: inline-block;" oninput="actualizarCantidadPreviaVentaIA(${index}, parseFloat(this.value) || 0)">
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted); display: block;">${escapeHTML(item.unidad_medida)}</span>
            </td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: 600;">
                $${item.precio.toFixed(2)}
            </td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-weight: 700; color: var(--primary-color);">
                $${subtotal.toFixed(2)}
            </td>
            <td style="padding: 8px; text-align: center;">
                <button type="button" onclick="eliminarFilaPreviaVentaIA(${index})" style="background: none; border: none; cursor: pointer; font-size: 1rem;" title="Quitar ítem">❌</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (totalLabel) {
        totalLabel.innerText = new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(total);
    }

    seccion.style.display = 'block';
    seccion.scrollIntoView({ behavior: 'smooth' });
}

export function actualizarCantidadPreviaVentaIA(index, nuevaCantidad) {
    if (itemsVentaIAPrevia[index]) {
        itemsVentaIAPrevia[index].cantidad = nuevaCantidad;
        itemsVentaIAPrevia[index].subtotal = itemsVentaIAPrevia[index].precio * nuevaCantidad;
        renderizarTablaPreviaVentaIA();
    }
}

export function eliminarFilaPreviaVentaIA(index) {
    itemsVentaIAPrevia.splice(index, 1);
    renderizarTablaPreviaVentaIA();
}

export function cancelarPreviewVentaIA() {
    itemsVentaIAPrevia = [];
    const seccion = document.getElementById('seccionPreviewVentaIA');
    if (seccion) seccion.style.display = 'none';
}

export async function confirmarVentaVozIA() {
    if (!itemsVentaIAPrevia || itemsVentaIAPrevia.length === 0) {
        alert('No hay productos en la venta.');
        return;
    }

    const productosBD = await obtenerProductos();

    for (const item of itemsVentaIAPrevia) {
        if (item.cantidad <= 0) {
            alert(`La cantidad para "${item.nombre}" debe ser mayor a 0.`);
            return;
        }
        const prodOriginal = productosBD.find(p => p.id === item.id);
        if (!prodOriginal) {
            alert(`El producto "${item.nombre}" ya no existe en el catálogo.`);
            return;
        }
        if (item.cantidad > prodOriginal.cantidad) {
            const stockFmt = formatearCantidad(prodOriginal.cantidad, prodOriginal.unidad_medida);
            const solFmt = formatearCantidad(item.cantidad, item.unidad_medida);
            alert(`Stock insuficiente para "${prodOriginal.nombre}". Stock disponible: ${stockFmt}, solicitado: ${solFmt}.`);
            return;
        }
    }

    let totalVenta = 0;
    const itemsFinales = [];

    itemsVentaIAPrevia.forEach(item => {
        const prod = productosBD.find(p => p.id === item.id);
        if (prod) {
            prod.cantidad = Math.round((prod.cantidad - item.cantidad) * 1000) / 1000;
        }
        totalVenta += item.precio * item.cantidad;
        itemsFinales.push({
            id: item.id,
            producto_id: item.id,
            nombre: item.nombre,
            costo: item.costo,
            precio: item.precio,
            cantidad: item.cantidad,
            unidad_medida: item.unidad_medida
        });
    });

    await guardarProductosEnStorage(productosBD);

    const cliente = document.getElementById('previewVentaCliente') ? document.getElementById('previewVentaCliente').value.trim() || 'Consumidor Final' : 'Consumidor Final';
    const formaPago = document.getElementById('previewVentaFormaPago') ? document.getElementById('previewVentaFormaPago').value : 'Efectivo';

    const nuevaVenta = {
        id: 'sale-' + Date.now(),
        fecha: new Date().toISOString(),
        productos: itemsFinales,
        total: totalVenta,
        cliente: cliente,
        forma_pago: formaPago
    };

    await guardarVentaEnStorage(nuevaVenta);
    await renderProductos();
    await actualizarReportes();
    await renderVentasDelDia();
    await actualizarMetricasModoSimple();

    const totalFmt = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(totalVenta);

    alert(`✨ ¡Venta por Voz registrada con éxito!\n\n• Total: ${totalFmt}\n• Forma de pago: ${formaPago}\n• Cliente: ${cliente}\n\nEl stock ha sido descontado correctamente.`);

    cancelarPreviewVentaIA();
    limpiarEntradaVentaIA();
    cerrarModalVentaVozIA();
}
