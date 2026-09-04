/* --- PUNTO DE ENTRADA DE LA APLICACIÓN ---
 * Importa todos los módulos, arranca la app al cargar el DOM y expone en `window`
 * únicamente las funciones que el HTML invoca mediante atributos onclick/onchange/oninput.
 * (El HTML no se reescribió a addEventListener para mantener el cambio acotado a la
 * reorganización en módulos; esta es la única razón por la que existe esta lista).
 */
import './config.js';

import {
    inicializarFecha,
    configurarFormulario,
    configurarFiltros,
    configurarBotonCancelar,
    editarProducto,
    eliminarProducto,
    ordenarGrilla,
    renderProductos
} from './productos.js';

import {
    configurarModuloVentas,
    alCambiarProductoVenta,
    actualizarPreciosVenta,
    eliminarFilaVenta
} from './ventas.js';

import {
    actualizarReportes,
    limpiarFiltrosReportes,
    renderVentasDelDia
} from './reportes.js';

import {
    configurarModuloProveedores,
    abrirModalNuevoProveedor,
    cerrarModalNuevoProveedor,
    guardarNuevoProveedor,
    eliminarProveedor,
    actualizarFechaPagoSegunEstado,
    cancelarEdicionPago,
    renderPagosProveedores,
    limpiarFiltrosPagos,
    cambiarEstadoPago,
    editarPagoProveedor,
    eliminarPagoProveedor,
    abrirModalVerComprobante,
    cerrarModalVerComprobante,
    eliminarComprobanteCargado,
    verComprobanteTemporal
} from './proveedores.js';

import {
    inicializarAsistenteIA,
    abrirModalAsistenteIA,
    cerrarModalAsistenteIA,
    procesarFotoTicketIA,
    eliminarFotoTicketIA,
    limpiarEntradaIA,
    toggleGrabacionIA,
    procesarConGeminiIA,
    actualizarDatoPreviaIA,
    actualizarCostoGananciaPreviaIA,
    eliminarFilaPreviaIA,
    cancelarPreviewIA,
    confirmarGuardadoProductosIA
} from './ia-productos.js';

import {
    abrirModalVentaVozIA,
    cerrarModalVentaVozIA,
    limpiarEntradaVentaIA,
    toggleGrabacionVentaIA,
    procesarVentaConGeminiIA,
    actualizarCantidadPreviaVentaIA,
    eliminarFilaPreviaVentaIA,
    cancelarPreviewVentaIA,
    confirmarVentaVozIA
} from './ia-ventas.js';

import {
    abrirModalConfig,
    cerrarModalConfig,
    guardarConfigSupabase,
    activarModoSimple,
    activarModoCompleto,
    actualizarMetricasModoSimple,
    cambiarPantalla,
    configurarEfectosTactiles
} from './ui.js';

import { configurarRespaldoDatos } from './backup.js';

// El HTML (estático y generado dinámicamente en las tablas) llama a estas funciones
// mediante atributos onclick/onchange/oninput, por lo que deben quedar accesibles en window.
Object.assign(window, {
    // productos
    editarProducto,
    eliminarProducto,
    ordenarGrilla,
    // ventas
    alCambiarProductoVenta,
    actualizarPreciosVenta,
    eliminarFilaVenta,
    // reportes
    actualizarReportes,
    limpiarFiltrosReportes,
    // proveedores
    abrirModalNuevoProveedor,
    cerrarModalNuevoProveedor,
    guardarNuevoProveedor,
    eliminarProveedor,
    actualizarFechaPagoSegunEstado,
    cancelarEdicionPago,
    renderPagosProveedores,
    limpiarFiltrosPagos,
    cambiarEstadoPago,
    editarPagoProveedor,
    eliminarPagoProveedor,
    abrirModalVerComprobante,
    cerrarModalVerComprobante,
    eliminarComprobanteCargado,
    verComprobanteTemporal,
    // asistente IA - productos
    abrirModalAsistenteIA,
    cerrarModalAsistenteIA,
    procesarFotoTicketIA,
    eliminarFotoTicketIA,
    limpiarEntradaIA,
    toggleGrabacionIA,
    procesarConGeminiIA,
    actualizarDatoPreviaIA,
    actualizarCostoGananciaPreviaIA,
    eliminarFilaPreviaIA,
    cancelarPreviewIA,
    confirmarGuardadoProductosIA,
    // asistente IA - venta por voz
    abrirModalVentaVozIA,
    cerrarModalVentaVozIA,
    limpiarEntradaVentaIA,
    toggleGrabacionVentaIA,
    procesarVentaConGeminiIA,
    actualizarCantidadPreviaVentaIA,
    eliminarFilaPreviaVentaIA,
    cancelarPreviewVentaIA,
    confirmarVentaVozIA,
    // ui / modos / configuración
    abrirModalConfig,
    cerrarModalConfig,
    guardarConfigSupabase,
    activarModoSimple,
    activarModoCompleto,
    cambiarPantalla
});

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    inicializarFecha();
    configurarFormulario();
    configurarFiltros();
    configurarBotonCancelar();
    configurarModuloVentas();
    configurarRespaldoDatos();
    inicializarAsistenteIA();
    configurarModuloProveedores();
    configurarEfectosTactiles();
    await renderProductos();
    await actualizarReportes();
    await renderVentasDelDia();
    await actualizarMetricasModoSimple();

    const modoGuardado = localStorage.getItem('modo_interfaz') || 'simple';
    if (modoGuardado === 'completo') {
        activarModoCompleto();
    } else {
        activarModoSimple();
    }
});
