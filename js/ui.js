/* --- GESTIÓN DE INTERFAZ: MODOS, PESTAÑAS Y CONFIGURACIÓN DE BASE DE DATOS --- */
import { SUPABASE_URL, SUPABASE_KEY, obtenerGeminiKeyPersonalizada } from './config.js';
import { obtenerProductos } from './productos.js';
import { obtenerVentas } from './ventas.js';

// Abrir modal de configuración
export function abrirModalConfig() {
    const modal = document.getElementById('modalConfig');
    if (modal) {
        document.getElementById('configUrl').value = SUPABASE_URL;
        document.getElementById('configKey').value = SUPABASE_KEY;
        const geminiKey = obtenerGeminiKeyPersonalizada();
        if (document.getElementById('configGeminiKey')) {
            document.getElementById('configGeminiKey').value = geminiKey;
        }
        modal.style.display = 'flex';
    }
}

// Cerrar modal
export function cerrarModalConfig() {
    const modal = document.getElementById('modalConfig');
    if (modal) modal.style.display = 'none';
}

// Guardar configuración en localStorage y recargar
export function guardarConfigSupabase() {
    const url = document.getElementById('configUrl').value.trim();
    const key = document.getElementById('configKey').value.trim();
    const geminiKey = document.getElementById('configGeminiKey') ? document.getElementById('configGeminiKey').value.trim() : '';

    if (geminiKey) {
        localStorage.setItem('gemini_api_key', geminiKey);
    } else {
        localStorage.removeItem('gemini_api_key');
    }

    if (url === '' || key === '') {
        localStorage.removeItem('supabase_url');
        localStorage.removeItem('supabase_key');
        alert('Configuración actualizada. Volviendo a base de datos local (localStorage).');
    } else {
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);
        alert('Configuración guardada con éxito.');
    }
    cerrarModalConfig();
    window.location.reload();
}

// --- GESTIÓN DE MODOS DE INTERFAZ (MODO SIMPLE / MODO COMPLETO) ---
export function activarModoSimple() {
    const panelSimple = document.getElementById('panelModoSimple');
    const panelCompleto = document.getElementById('panelModoCompleto');
    const btnSimple = document.getElementById('btnToggleModoSimple');
    const btnCompleto = document.getElementById('btnToggleModoCompleto');

    if (panelSimple) panelSimple.style.display = 'block';
    if (panelCompleto) panelCompleto.style.display = 'none';

    if (btnSimple) {
        btnSimple.classList.add('active-mode');
        btnSimple.style.background = '';
        btnSimple.style.color = '';
        btnSimple.style.borderColor = '';
    }
    if (btnCompleto) {
        btnCompleto.classList.remove('active-mode');
        btnCompleto.style.background = '';
        btnCompleto.style.color = '';
        btnCompleto.style.borderColor = '';
    }

    localStorage.setItem('modo_interfaz', 'simple');
    actualizarMetricasModoSimple();
}

export function activarModoCompleto() {
    const panelSimple = document.getElementById('panelModoSimple');
    const panelCompleto = document.getElementById('panelModoCompleto');
    const btnSimple = document.getElementById('btnToggleModoSimple');
    const btnCompleto = document.getElementById('btnToggleModoCompleto');

    if (panelSimple) panelSimple.style.display = 'none';
    if (panelCompleto) panelCompleto.style.display = 'block';

    if (btnCompleto) {
        btnCompleto.classList.add('active-mode');
        btnCompleto.style.background = '';
        btnCompleto.style.color = '';
        btnCompleto.style.borderColor = '';
    }
    if (btnSimple) {
        btnSimple.classList.remove('active-mode');
        btnSimple.style.background = '';
        btnSimple.style.color = '';
        btnSimple.style.borderColor = '';
    }

    localStorage.setItem('modo_interfaz', 'completo');
}

export async function actualizarMetricasModoSimple() {
    const labelFacturado = document.getElementById('kpiSimpleFacturado');
    const labelGanancia = document.getElementById('kpiSimpleGanancia');
    if (!labelFacturado && !labelGanancia) return;

    try {
        const ventas = await obtenerVentas();
        const productosBD = await obtenerProductos();

        const todayStr = new Date().toISOString().split('T')[0];
        const ventasHoy = ventas.filter(v => (v.fecha || '').startsWith(todayStr));

        const totalFacturadoHoy = ventasHoy.reduce((acc, v) => acc + (v.total || 0), 0);

        let totalGananciasHoy = 0;
        ventasHoy.forEach(v => {
            if (v.productos && Array.isArray(v.productos)) {
                v.productos.forEach(p => {
                    const costoUnitario = p.costo !== undefined ? p.costo : (productosBD.find(prod => prod.id === p.id)?.costo || 0);
                    const gananciaUnitaria = (p.precio || 0) - costoUnitario;
                    totalGananciasHoy += (gananciaUnitaria * (p.cantidad || 0));
                });
            }
        });

        if (labelFacturado) {
            labelFacturado.innerText = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS'
            }).format(totalFacturadoHoy);
        }

        if (labelGanancia) {
            labelGanancia.innerText = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS'
            }).format(totalGananciasHoy);
        }
    } catch (err) {
        console.error('Error al actualizar métricas de modo simple:', err);
    }
}

// Función para alternar pantallas de pestañas
export function cambiarPantalla(tabId) {
    const tabs = ['ventas', 'productos', 'reportes', 'proveedores'];
    tabs.forEach(id => {
        const btn = document.getElementById('tabBtn-' + id);
        const content = document.getElementById('tab-' + id);
        if (btn) btn.classList.remove('active');
        if (content) content.classList.remove('active');
    });

    const activeBtn = document.getElementById('tabBtn-' + tabId);
    const activeContent = document.getElementById('tab-' + tabId);
    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
}

// Configuración de efectos táctiles fucsia inmediatos para móviles y mouse
export function configurarEfectosTactiles() {
    try {
        document.addEventListener('touchstart', function() {}, { passive: true });
        document.querySelectorAll('.big-touch-card, .btn-mode-toggle').forEach(el => {
            el.addEventListener('touchstart', () => {
                el.classList.add('touch-active');
            }, { passive: true });

            el.addEventListener('touchend', () => {
                setTimeout(() => {
                    el.classList.remove('touch-active');
                }, 220);
            }, { passive: true });

            el.addEventListener('touchcancel', () => {
                el.classList.remove('touch-active');
            }, { passive: true });

            el.addEventListener('mousedown', () => {
                el.classList.add('touch-active');
            });
            el.addEventListener('mouseup', () => {
                setTimeout(() => {
                    el.classList.remove('touch-active');
                }, 220);
            });
            el.addEventListener('mouseleave', () => {
                el.classList.remove('touch-active');
            });
        });
    } catch(e) {
        console.error("Error al configurar efectos táctiles:", e);
    }
}
