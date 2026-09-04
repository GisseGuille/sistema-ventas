/* --- CLIENTE COMPARTIDO PARA LLAMAR A GOOGLE GEMINI --- */
// Por defecto, la clave de Gemini NUNCA viaja al navegador: se llama a una función Edge de
// Supabase que guarda la clave real del lado del servidor. Si el usuario configuró su propia
// clave personal (modal de Configuración / Asistente IA), se llama directamente a Gemini con ella.
import { GEMINI_PROXY_URL, SUPABASE_KEY, obtenerGeminiKeyPersonalizada } from './config.js';

const MODELOS_GEMINI = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-2.5-pro'];

// Llama a Gemini con los `contents` (formato de la API generateContent) y devuelve la respuesta cruda.
export async function llamarGemini(contents, generationConfig) {
    const claveManual = obtenerGeminiKeyPersonalizada();
    if (claveManual) {
        return await llamarGeminiDirecto(contents, generationConfig, claveManual);
    }
    return await llamarGeminiProxy(contents, generationConfig);
}

async function llamarGeminiDirecto(contents, generationConfig, geminiKey) {
    let lastError = null;
    for (const modelo of MODELOS_GEMINI) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, generationConfig })
            });
            if (res.ok) return await res.json();
            const errData = await res.json().catch(() => ({}));
            lastError = errData.error?.message || `Error ${res.status}`;
        } catch (e) {
            lastError = e.message;
        }
    }
    throw new Error(construirMensajeError(lastError));
}

async function llamarGeminiProxy(contents, generationConfig) {
    try {
        const res = await fetch(GEMINI_PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ contents, generationConfig })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || `Error ${res.status}`);
        }
        return data;
    } catch (e) {
        throw new Error(construirMensajeError(e.message));
    }
}

function construirMensajeError(lastError) {
    if (lastError && (String(lastError).includes('503') || String(lastError).toLowerCase().includes('demand') || String(lastError).toLowerCase().includes('temporar'))) {
        return 'Los servidores de Google Gemini están experimentando alta demanda momentánea. Por favor, vuelve a presionar "Interpretar con IA" en unos instantes.';
    }
    let msg = 'No se pudo conectar con la Inteligencia Artificial de Google Gemini en este momento.';
    if (lastError) {
        msg += '\n\nDetalle: ' + lastError;
    }
    return msg;
}
