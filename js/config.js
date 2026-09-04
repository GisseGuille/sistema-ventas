/* --- CONFIGURACIÓN DE CONEXIÓN A SUPABASE Y GEMINI IA --- */

export const LOCAL_STORAGE_KEY = 'bg_cocina_productos';
export const SALES_STORAGE_KEY = 'ventas';
export const SUPPLIERS_STORAGE_KEY = 'bg_cocina_proveedores';
export const PAYMENTS_STORAGE_KEY = 'bg_cocina_pagos_proveedores';

const SUPABASE_URL_DEFAULT = 'https://kygryupahriaxeyjgycw.supabase.co';
const SUPABASE_KEY_DEFAULT = atob('c2JfcHVibGlzaGFibGVfSzZ1ZmdYWUcxN1J3d3p4OEo5N3lqd19EeDV1ZV9vTQ==');

export const SUPABASE_URL = localStorage.getItem('supabase_url') || SUPABASE_URL_DEFAULT;
export const SUPABASE_KEY = localStorage.getItem('supabase_key') || SUPABASE_KEY_DEFAULT;

// La clave de Gemini ya NO se guarda en el código fuente. Por defecto, el Asistente IA
// usa una función Edge de Supabase (proxy) que guarda la clave real del lado del servidor.
// Un usuario avanzado puede opcionalmente configurar su propia clave desde el modal de
// configuración; en ese caso se llama a Gemini directamente desde el navegador con esa clave.
export const GEMINI_PROXY_URL = `${SUPABASE_URL_DEFAULT}/functions/v1/gemini-proxy`;

export function obtenerGeminiKeyPersonalizada() {
    return localStorage.getItem('gemini_api_key') || '';
}

export let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('your-project-id')) {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
    } catch (err) {
        console.error("Error al inicializar el cliente de Supabase", err);
    }
}
