/**
 * Logos de la marca controlados desde /admin/brand (.dev/plans/BRAND_LOGOS_PLAN.md).
 * El backend guarda este JSON tal cual por lugar; todo el significado vive acá.
 */

export type BrandTheme = 'light' | 'dark';
export type BrandFont = 'display' | 'sans' | 'mono';

/** "builtin:<clave>" (pieza incluida en el front) o "asset:<id>" (subida desde admin). */
export type BrandRef = string;

/**
 * Un elemento de la caja: imagen o texto. Guarda los campos de los dos tipos para que
 * cambiar de texto a imagen (o al revés) no pierda lo que ya estaba configurado.
 */
export interface BrandElement {
    /** Estable entre variantes: así "aplicar a todas las pantallas" sabe cuál es cuál. */
    id: string;
    type: 'image' | 'text';
    visible: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
    // Imagen
    ref: BrandRef | null;
    /** Imagen distinta en tema oscuro; null = la misma. */
    refDark: BrandRef | null;
    keepAspect: boolean;
    // Texto
    text: string;
    font: BrandFont;
    weight: number;
    /** px */
    size: number;
    color: string;
    colorDark: string;
    /** px */
    letterSpacing: number;
    align: 'left' | 'center' | 'right';
    italic: boolean;
    uppercase: boolean;
}

/** Una caja de tamaño fijo con los elementos que se quieran; el orden de la lista es el de apilado (el último queda encima). */
export interface BrandLayout {
    visible: boolean;
    width: number;
    height: number;
    elements: BrandElement[];
}

export interface BrandSlotConfig {
    v: 1 | 2;
    /** Una por variante del lugar (tamaño de pantalla o formato). */
    layouts: Record<string, BrandLayout>;
    /** Solo el lugar "favicon". */
    favicon?: BrandRef | null;
}

export interface BrandAsset {
    id: number;
    name: string;
    url: string;
    width: number;
    height: number;
}

export interface BrandData {
    assets: BrandAsset[];
    slots: Record<string, BrandSlotConfig>;
    updatedAt?: string;
}

export interface ResolvedImage {
    url: string;
    width: number;
    height: number;
    name: string;
}
