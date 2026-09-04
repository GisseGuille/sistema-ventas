/* --- MÓDULO DE ASISTENTE IA PARA CARGA DE PRODUCTOS (GOOGLE GEMINI) --- */
import { escapeHTML } from './utils.js';
import { obtenerProductos, guardarProductosEnStorage, renderProductos } from './productos.js';
import { actualizarDropdownsVenta } from './ventas.js';
import { llamarGemini } from './ia-gemini.js';
import { obtenerGeminiKeyPersonalizada } from './config.js';

let recognitionIA = null;
let isRecordingIA = false;
let productosIAPrevia = [];
let fotoTicketIABase64 = null;

export function inicializarAsistenteIA() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        const btnGrabar = document.getElementById('btnGrabarAudioIA');
        if (btnGrabar) {
            btnGrabar.title = 'Tu navegador no soporta voz. Puedes usar foto o escribir texto.';
        }
    }
}

export function abrirModalAsistenteIA() {
    const modal = document.getElementById('modalAsistenteIA');
    if (!modal) return;
    modal.style.display = 'flex';
}

export function cerrarModalAsistenteIA() {
    if (isRecordingIA) {
        detenerGrabacionIA();
    }
    const modal = document.getElementById('modalAsistenteIA');
    if (modal) modal.style.display = 'none';
}

export function procesarFotoTicketIA(input) {
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, JPEG, GIF).');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1600;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const base64Raw = compressedDataUrl.split(',')[1];

            fotoTicketIABase64 = {
                mimeType: 'image/jpeg',
                data: base64Raw
            };

            const previewDiv = document.getElementById('previewFotoTicketIA');
            const imgThumb = document.getElementById('imgThumbnailTicketIA');
            if (previewDiv && imgThumb) {
                imgThumb.src = compressedDataUrl;
                previewDiv.style.display = 'flex';
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

export function eliminarFotoTicketIA() {
    fotoTicketIABase64 = null;
    const previewDiv = document.getElementById('previewFotoTicketIA');
    const imgThumb = document.getElementById('imgThumbnailTicketIA');
    const input = document.getElementById('fileFotoTicketIA');
    if (previewDiv) previewDiv.style.display = 'none';
    if (imgThumb) imgThumb.src = '';
    if (input) input.value = '';
}

export function limpiarEntradaIA() {
    const textarea = document.getElementById('txtEntradaIA');
    if (textarea) textarea.value = '';
    eliminarFotoTicketIA();
    cancelarPreviewIA();
}

export function toggleGrabacionIA() {
    if (isRecordingIA) {
        detenerGrabacionIA();
    } else {
        iniciarGrabacionIA();
    }
}

export function iniciarGrabacionIA() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Tu navegador no soporta reconocimiento de voz nativo. Puedes usar foto de ticket o escribir texto.');
        return;
    }

    if (!recognitionIA) {
        recognitionIA = new SpeechRecognition();
        recognitionIA.lang = 'es-AR';
        recognitionIA.continuous = true;
        recognitionIA.interimResults = true;

        recognitionIA.onresult = (event) => {
            let textoFinal = '';
            for (let i = 0; i < event.results.length; i++) {
                textoFinal += event.results[i][0].transcript + ' ';
            }
            const textarea = document.getElementById('txtEntradaIA');
            if (textarea) {
                textarea.value = textoFinal.trim();
            }
        };

        recognitionIA.onerror = (event) => {
            console.error('Error en reconocimiento de voz IA:', event);
            detenerGrabacionIA();
        };

        recognitionIA.onend = () => {
            detenerGrabacionIA();
        };
    }

    try {
        recognitionIA.start();
        isRecordingIA = true;
        const btn = document.getElementById('btnGrabarAudioIA');
        const txt = document.getElementById('txtGrabarIA');
        const icon = document.getElementById('iconGrabarIA');
        if (btn) btn.classList.add('btn-recording');
        if (txt) txt.innerText = 'Escuchando... (Toca para parar)';
        if (icon) icon.innerText = '🛑';
    } catch (err) {
        console.error('No se pudo iniciar reconocimiento:', err);
    }
}

export function detenerGrabacionIA() {
    if (recognitionIA && isRecordingIA) {
        try {
            recognitionIA.stop();
        } catch(e) {}
    }
    isRecordingIA = false;
    const btn = document.getElementById('btnGrabarAudioIA');
    const txt = document.getElementById('txtGrabarIA');
    const icon = document.getElementById('iconGrabarIA');
    if (btn) btn.classList.remove('btn-recording');
    if (txt) txt.innerText = 'Hablar';
    if (icon) icon.innerText = '🎙️';
}

export async function procesarConGeminiIA() {
    const textarea = document.getElementById('txtEntradaIA');
    const texto = textarea ? textarea.value.trim() : '';

    if (!texto && !fotoTicketIABase64) {
        alert('Por favor sube una foto de un ticket/factura, habla por el micrófono o escribe el texto de los productos.');
        if (textarea) textarea.focus();
        return;
    }

    if (isRecordingIA) {
        detenerGrabacionIA();
    }

    const loading = document.getElementById('loadingIA');
    const seccionPreview = document.getElementById('seccionPreviewIA');
    const btnProcesar = document.getElementById('btnProcesarIA');

    if (loading) loading.style.display = 'block';
    if (seccionPreview) seccionPreview.style.display = 'none';
    if (btnProcesar) btnProcesar.disabled = true;

    const promptSistema = `Eres un asistente experto para un negocio de alimentos y cocina en Argentina ("Bettina Guille - Cocina").
Analiza la información proporcionada (que puede incluir una foto de ticket/factura de compra, audio dictado con modismos argentinos o texto escrito) y extrae TODOS los productos comprados.

Debes responder ÚNICAMENTE con un arreglo JSON válido (sin formato markdown ni etiquetas \`\`\`json).

Cada objeto del arreglo debe tener exactamente esta estructura:
{
  "nombre": "Nombre del producto con mayúscula inicial (ej: 'Pata muslo', 'Harina 0000', 'Tomate redondo', 'Queso cremoso')",
  "categoria": "Categoría exacta deducida entre: 'Almacén', 'verdulería', 'bebidas', 'pollo', 'carbón', 'panadería', 'fiambreria'",
  "cantidad": número decimal o entero (ej: 'dos kilos y medio' -> 2.5, 'medio kilo' -> 0.5, 'un cuarto' -> 0.25, 'tres' -> 3, '500g' -> 0.5 si es kilo o 500 si es gramos),
  "unidad_medida": "Debe ser 'Kilos', 'Gramos' o 'Unidades'. (Para carnes, pollos, frutas o verduras pesadas usa 'Kilos', para fraccionados pequeños en gramos usa 'Gramos', para paquetes/unidades usa 'Unidades')",
  "costo": número decimal o entero con el costo unitario o por kilo (ej: 3500, 50000). Si el ticket indica el precio unitario úsalo; si solo indica el total de ese renglón, calcula costo_total / cantidad. Si no se indica, pon 0,
  "ganancia": número con el porcentaje de ganancia (ej: '40' para 40%, 'margen del 35' -> 35). Si no se indica, asigna 40 por defecto
}`;

    const parts = [];
    if (fotoTicketIABase64) {
        parts.push({
            inline_data: {
                mime_type: fotoTicketIABase64.mimeType,
                data: fotoTicketIABase64.data
            }
        });
    }

    let promptTextoCompleto = promptSistema;
    if (texto) {
        promptTextoCompleto += `\n\nTexto adicional / notas:\n"${texto}"`;
    }
    if (fotoTicketIABase64) {
        promptTextoCompleto += `\n\n(Revisa minuciosamente la imagen adjunta del ticket o factura, reconociendo cada renglón de producto, peso/cantidad y costo unitario o precio)`;
    }
    parts.push({ text: promptTextoCompleto });

    try {
        const data = await llamarGemini(
            [{ role: 'user', parts: parts }],
            { temperature: 0.1, responseMimeType: "application/json" }
        );

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const productosExtraidos = JSON.parse(cleanedText);

        if (!Array.isArray(productosExtraidos) || productosExtraidos.length === 0) {
            alert('No se detectaron productos en el texto. Intenta ser más descriptivo o hablar más claro.');
            return;
        }

        productosIAPrevia = productosExtraidos;
        renderizarTablaPreviaIA(productosIAPrevia);

    } catch (err) {
        console.error('Error al procesar con Gemini:', err);
        const sugerenciaClave = obtenerGeminiKeyPersonalizada() ? '\n\nVerifica tu clave de API en Configuración.' : '';
        alert('Error al comunicarse con la Inteligencia Artificial de Gemini:\n' + err.message + sugerenciaClave);
    } finally {
        if (loading) loading.style.display = 'none';
        if (btnProcesar) btnProcesar.disabled = false;
    }
}

export function renderizarTablaPreviaIA(productos) {
    const tbody = document.getElementById('tablaPreviewIABody');
    const cantLabel = document.getElementById('cantProductosIADetectados');
    const seccion = document.getElementById('seccionPreviewIA');

    if (!tbody || !seccion) return;

    tbody.innerHTML = '';
    if (cantLabel) cantLabel.innerText = productos.length;

    if (productos.length === 0) {
        seccion.style.display = 'none';
        return;
    }

    productos.forEach((prod, index) => {
        const tr = document.createElement('tr');
        const costo = Number(prod.costo) || 0;
        const ganancia = Number(prod.ganancia) || 0;
        const precio = costo * (1 + (ganancia / 100));

        tr.innerHTML = `
            <td style="padding: 6px;">
                <input type="text" value="${escapeHTML(prod.nombre)}" class="form-control" style="width: 100%; font-size: 0.85rem;" onchange="actualizarDatoPreviaIA(${index}, 'nombre', this.value)">
            </td>
            <td style="padding: 6px;">
                <select class="form-control" style="width: 100%; font-size: 0.85rem;" onchange="actualizarDatoPreviaIA(${index}, 'categoria', this.value)">
                    <option value="Almacén" ${prod.categoria?.toLowerCase() === 'almacén' || prod.categoria?.toLowerCase() === 'almacen' ? 'selected' : ''}>Almacén</option>
                    <option value="verdulería" ${prod.categoria?.toLowerCase() === 'verdulería' || prod.categoria?.toLowerCase() === 'verduleria' ? 'selected' : ''}>Verdulería</option>
                    <option value="bebidas" ${prod.categoria?.toLowerCase() === 'bebidas' ? 'selected' : ''}>Bebidas</option>
                    <option value="pollo" ${prod.categoria?.toLowerCase() === 'pollo' ? 'selected' : ''}>Pollo</option>
                    <option value="carbón" ${prod.categoria?.toLowerCase() === 'carbón' || prod.categoria?.toLowerCase() === 'carbon' ? 'selected' : ''}>Carbón</option>
                    <option value="panadería" ${prod.categoria?.toLowerCase() === 'panadería' || prod.categoria?.toLowerCase() === 'panaderia' ? 'selected' : ''}>Panadería</option>
                    <option value="fiambreria" ${prod.categoria?.toLowerCase() === 'fiambreria' ? 'selected' : ''}>Fiambrería</option>
                    <option value="Sin categoría" ${!prod.categoria ? 'selected' : ''}>Sin categoría</option>
                </select>
            </td>
            <td style="padding: 6px;">
                <input type="number" step="any" min="0" value="${prod.cantidad}" class="form-control" style="width: 100%; text-align: center; font-size: 0.85rem;" oninput="actualizarDatoPreviaIA(${index}, 'cantidad', parseFloat(this.value) || 0)">
            </td>
            <td style="padding: 6px;">
                <select class="form-control" style="width: 100%; font-size: 0.85rem;" onchange="actualizarDatoPreviaIA(${index}, 'unidad_medida', this.value)">
                    <option value="Unidades" ${prod.unidad_medida === 'Unidades' ? 'selected' : ''}>Unidades</option>
                    <option value="Kilos" ${prod.unidad_medida === 'Kilos' ? 'selected' : ''}>Kilos</option>
                    <option value="Gramos" ${prod.unidad_medida === 'Gramos' ? 'selected' : ''}>Gramos</option>
                </select>
            </td>
            <td style="padding: 6px;">
                <input type="number" step="0.01" min="0" value="${costo}" class="form-control" style="width: 100%; text-align: right; font-family: monospace; font-size: 0.85rem;" oninput="actualizarCostoGananciaPreviaIA(${index}, 'costo', parseFloat(this.value) || 0)">
            </td>
            <td style="padding: 6px;">
                <input type="number" min="0" value="${ganancia}" class="form-control" style="width: 100%; text-align: center; font-size: 0.85rem;" oninput="actualizarCostoGananciaPreviaIA(${index}, 'ganancia', parseFloat(this.value) || 0)">
            </td>
            <td id="previewPrecio-${index}" style="padding: 6px; font-family: monospace; font-weight: 700; text-align: right; color: var(--primary-color);">
                $${precio.toFixed(2)}
            </td>
            <td style="padding: 6px; text-align: center;">
                <button type="button" onclick="eliminarFilaPreviaIA(${index})" style="background: none; border: none; cursor: pointer; font-size: 1rem;" title="Quitar este producto">❌</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    seccion.style.display = 'block';
    seccion.scrollIntoView({ behavior: 'smooth' });
}

export function actualizarDatoPreviaIA(index, campo, valor) {
    if (productosIAPrevia[index]) {
        productosIAPrevia[index][campo] = valor;
    }
}

export function actualizarCostoGananciaPreviaIA(index, campo, valor) {
    if (productosIAPrevia[index]) {
        productosIAPrevia[index][campo] = valor;
        const costo = Number(productosIAPrevia[index].costo) || 0;
        const ganancia = Number(productosIAPrevia[index].ganancia) || 0;
        const precio = costo * (1 + (ganancia / 100));
        const precioCell = document.getElementById(`previewPrecio-${index}`);
        if (precioCell) {
            precioCell.innerText = `$${precio.toFixed(2)}`;
        }
    }
}

export function eliminarFilaPreviaIA(index) {
    productosIAPrevia.splice(index, 1);
    renderizarTablaPreviaIA(productosIAPrevia);
}

export function cancelarPreviewIA() {
    productosIAPrevia = [];
    const seccion = document.getElementById('seccionPreviewIA');
    if (seccion) seccion.style.display = 'none';
}

export async function confirmarGuardadoProductosIA() {
    if (!productosIAPrevia || productosIAPrevia.length === 0) {
        alert('No hay productos para guardar.');
        return;
    }

    const productosBD = await obtenerProductos();
    let agregadosCount = 0;
    let actualizadosCount = 0;
    const fechaHoy = new Date().toISOString().split('T')[0];

    productosIAPrevia.forEach(prod => {
        const nombre = (prod.nombre || '').trim();
        if (!nombre) return;

        const costo = Number(prod.costo) || 0;
        const ganancia = Number(prod.ganancia) || 0;
        const precio = costo * (1 + (ganancia / 100));
        const cantidad = Number(prod.cantidad) || 0;
        const unidad_medida = prod.unidad_medida || 'Unidades';
        const categoria = prod.categoria || 'Sin categoría';

        const nombreNormalizado = nombre.toLowerCase();
        const indexExistente = productosBD.findIndex(p =>
            p.nombre.toLowerCase().trim() === nombreNormalizado &&
            (p.estado || 'Activo') === 'Activo'
        );

        if (indexExistente !== -1) {
            productosBD[indexExistente].cantidad = Math.round((productosBD[indexExistente].cantidad + cantidad) * 1000) / 1000;
            productosBD[indexExistente].costo = costo;
            productosBD[indexExistente].ganancia = ganancia;
            productosBD[indexExistente].precio = precio;
            productosBD[indexExistente].unidad_medida = unidad_medida;
            if (categoria !== 'Sin categoría') {
                productosBD[indexExistente].categoria = categoria;
            }
            actualizadosCount++;
        } else {
            productosBD.push({
                id: 'prod-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                nombre: nombre,
                categoria: categoria,
                costo: costo,
                ganancia: ganancia,
                precio: precio,
                cantidad: cantidad,
                unidad_medida: unidad_medida,
                fecha: fechaHoy,
                estado: 'Activo'
            });
            agregadosCount++;
        }
    });

    await guardarProductosEnStorage(productosBD);
    await renderProductos();
    await actualizarDropdownsVenta();

    alert(
        `✨ ¡Productos guardados con éxito!\n\n` +
        `• Productos Nuevos: ${agregadosCount}\n` +
        `• Productos Actualizados (Stock sumado): ${actualizadosCount}`
    );

    cancelarPreviewIA();
    limpiarEntradaIA();
    cerrarModalAsistenteIA();
}
