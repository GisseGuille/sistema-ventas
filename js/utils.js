/* --- UTILIDADES COMPARTIDAS (FORMATO, CATEGORIAS, SANITIZACION) --- */

// Sanitizar strings para prevenir vulnerabilidades XSS
export function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Formateador de cantidades para soportar enteros y decimales con su unidad de medida
export function formatearCantidad(cant, unidad) {
    const n = Number(cant) || 0;
    const formattedNum = n % 1 === 0
        ? n.toString()
        : n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

    let sufijo = ' un';
    const u = (unidad || 'Unidades').toLowerCase();
    if (u.includes('kilo') || u === 'kg') {
        sufijo = ' kg';
    } else if (u.includes('gramo') || u === 'g' || u === 'gr') {
        sufijo = ' g';
    } else {
        sufijo = ' un';
    }
    return `${formattedNum}${sufijo}`;
}

// Búsqueda inteligente de producto en el catálogo (por producto_id, id o coincidencia de nombre)
export function buscarProductoCatalogo(p, productosBD) {
    if (!productosBD || productosBD.length === 0 || !p) return null;
    const idBuscado = p.producto_id || p.id;
    const nombreBuscado = (p.nombre || '').trim().toLowerCase();
    return productosBD.find(prod =>
        (idBuscado && String(prod.id) === String(idBuscado)) ||
        (nombreBuscado && prod.nombre && prod.nombre.trim().toLowerCase() === nombreBuscado)
    ) || null;
}

// Rango Unicode de marcas diacríticas combinantes (U+0300-U+036F), construido por código
// de carácter para evitar problemas de codificación del propio archivo fuente.
const ACENTOS_REGEX = new RegExp(
    '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
    'g'
);

// Normaliza el nombre de la categoría para unificar mayúsculas y acentos
export function normalizarNombreCategoria(cat) {
    if (!cat) return '';
    const c = cat.trim();
    if (c.toLowerCase() === 'sin categoría' || c.toLowerCase() === 'sin categoria' || c.toLowerCase() === 'null' || c.toLowerCase() === 'undefined') return '';

    const cLower = c.toLowerCase().normalize("NFD").replace(ACENTOS_REGEX, "");
    if (cLower === 'almacen') return 'Almacén';
    if (cLower === 'verduleria') return 'Verdulería';
    if (cLower === 'bebidas' || cLower === 'bebida') return 'Bebidas';
    if (cLower === 'pollo' || cLower === 'pollos' || cLower === 'polleria') return 'Pollo y Granja';
    if (cLower === 'carbon' || cLower === 'carboneria') return 'Carbón';
    if (cLower === 'panaderia') return 'Panadería';
    if (cLower === 'fiambreria' || cLower === 'lacteos' || cLower === 'lacteo') return 'Fiambrería y Lácteos';

    return c.charAt(0).toUpperCase() + c.slice(1);
}

// Infiere la categoría según palabras clave en el nombre del producto cuando no está asignada
export function inferirCategoriaPorNombre(nombre) {
    if (!nombre) return 'Almacén';
    const n = nombre.toLowerCase().normalize("NFD").replace(ACENTOS_REGEX, "");

    if (n.includes('pata') || n.includes('muslo') || n.includes('pollo') || n.includes('pechuga') || n.includes('alita') || n.includes('suprema') || n.includes('granja') || n.includes('huevo') || n.includes('maple') || n.includes('menudo')) {
        return 'Pollo y Granja';
    }
    if (n.includes('papa') || n.includes('tomate') || n.includes('cebolla') || n.includes('lechuga') || n.includes('zanahoria') || n.includes('morron') || n.includes('limon') || n.includes('manzana') || n.includes('banana') || n.includes('palta') || n.includes('fruta') || n.includes('verdura') || n.includes('zapallo') || n.includes('acelga')) {
        return 'Verdulería';
    }
    if (n.includes('leche') || n.includes('queso') || n.includes('crema') || n.includes('manteca') || n.includes('yogur') || n.includes('jamon') || n.includes('paleta') || n.includes('salame') || n.includes('mortadela') || n.includes('fiambre') || n.includes('cremoso') || n.includes('sardo') || n.includes('barra')) {
        return 'Fiambrería y Lácteos';
    }
    if (n.includes('coca') || n.includes('pepsi') || n.includes('sprite') || n.includes('fanta') || n.includes('cerveza') || n.includes('vino') || n.includes('agua') || n.includes('soda') || n.includes('jugo') || n.includes('gaseosa') || n.includes('fernet') || n.includes('aperitivo') || n.includes('manaos')) {
        return 'Bebidas';
    }
    if (n.includes('pan') || n.includes('medialuna') || n.includes('factura') || n.includes('bizcoch') || n.includes('torta') || n.includes('prepisa') || n.includes('prepiza') || n.includes('criollo') || n.includes('galleta') || n.includes('miga')) {
        return 'Panadería';
    }
    if (n.includes('carbon') || n.includes('lena') || n.includes('briquet')) {
        return 'Carbón';
    }
    return 'Almacén';
}

// Obtener la categoría del producto (desde catálogo de productos, desde ítem de venta o inferida)
export function obtenerCategoriaProducto(p, productosBD) {
    const prodBD = buscarProductoCatalogo(p, productosBD);
    let cat = prodBD && prodBD.categoria ? normalizarNombreCategoria(prodBD.categoria) : '';
    if (!cat && p.categoria) {
        cat = normalizarNombreCategoria(p.categoria);
    }
    if (!cat) {
        cat = inferirCategoriaPorNombre(p.nombre || (prodBD ? prodBD.nombre : ''));
    }
    return cat || 'Almacén';
}

// Obtener la unidad de medida de un producto (desde el ítem de venta o consultando el catálogo de productos)
export function obtenerUnidadProducto(p, productosBD) {
    if (p.unidad_medida && p.unidad_medida !== 'Unidades') return p.unidad_medida;
    const prod = buscarProductoCatalogo(p, productosBD);
    if (prod && prod.unidad_medida) return prod.unidad_medida;
    return p.unidad_medida || 'Unidades';
}
