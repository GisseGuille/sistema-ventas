// Proxy seguro hacia Google Gemini.
// La clave real de Gemini vive únicamente como secreto de este proyecto de Supabase
// (variable de entorno GEMINI_API_KEY) y nunca se envía al navegador del cliente.
//
// Despliegue:
//   supabase functions deploy gemini-proxy
//   supabase secrets set GEMINI_API_KEY=tu_clave_real_de_google_ai_studio
//
// El cliente (js/ia-gemini.js) llama a esta función pasando { contents, generationConfig }
// con el mismo formato que espera la API generateContent de Gemini, y recibe la respuesta
// cruda de Gemini tal cual.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Lista de modelos candidatos a probar en orden. Google renombra/retira modelos "preview" con
// frecuencia, así que se prueban varias variantes y alias "latest" antes de rendirse.
const MODELOS = [
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-pro-latest',
    'gemini-3.1-pro-preview'
];

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método no permitido." }), {
            status: 405,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: "GEMINI_API_KEY no está configurada en los secretos de este proyecto de Supabase." }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "El cuerpo de la solicitud no es JSON válido." }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    const { contents, generationConfig } = body;
    if (!contents) {
        return new Response(JSON.stringify({ error: "Falta el campo 'contents'." }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }

    // Se registra el error de CADA modelo probado (no solo el último) para poder diagnosticar
    // rápido cuándo Google retira o renombra un modelo, sin tener que ir probando a ciegas.
    const intentos: { modelo: string; error: string }[] = [];

    for (const modelo of MODELOS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents, generationConfig }),
            });

            if (res.ok) {
                const data = await res.json();
                return new Response(JSON.stringify(data), {
                    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            } else {
                const errData = await res.json().catch(() => ({}));
                intentos.push({ modelo, error: errData?.error?.message || `Error ${res.status}` });
            }
        } catch (e) {
            intentos.push({ modelo, error: e.message });
        }
    }

    return new Response(JSON.stringify({
        error: intentos[intentos.length - 1]?.error || "No se pudo conectar con Gemini.",
        intentos,
    }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
});
