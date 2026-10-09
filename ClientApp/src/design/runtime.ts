import { installDesignTokens, resolveDesign, type DesignOverrides, type ResolvedDesign } from '../components/ds/tokens';

// Arranque de los valores de diseño: qué se aplica al sitio y cuándo.
//  1. Vista previa del borrador (solo en el navegador del dueño, localStorage) si está activa.
//  2. Si no, los valores publicados: se aplican al instante desde la copia local (sin esperar red) y se
//     refrescan con GET /api/design/tokens. En la primera visita se espera hasta BOOT_WAIT_MS para no
//     pintar los colores de fábrica y cambiarlos después.
//  3. Si el servidor no responde, el sitio se ve con los valores de fábrica del código.

const CACHE_KEY = 'decatron-design-cache';
const PREVIEW_KEY = 'decatron-design-preview';
const BOOT_WAIT_MS = 800;

let active: ResolvedDesign = resolveDesign();
export const getActiveDesign = () => active;

function read<T>(key: string): T | null {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function write(key: string, value: unknown | null) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento: no pasa nada */ }
}

export function applyDesign(ov?: DesignOverrides | null) {
    active = resolveDesign(ov);
    installDesignTokens(active);
    window.dispatchEvent(new Event('decatron-design-changed'));
}

export const getPreview = () => read<DesignOverrides>(PREVIEW_KEY);
export function setPreview(ov: DesignOverrides | null) {
    write(PREVIEW_KEY, ov);
    applyDesign(ov ?? read<{ values: DesignOverrides }>(CACHE_KEY)?.values);
}

/** Vuelve a pedir lo publicado (el editor lo llama al publicar o restablecer). */
export async function refreshPublished(): Promise<void> {
    const res = await fetch('/api/design/tokens', { credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json() as { version: number; values: DesignOverrides };
    write(CACHE_KEY, { version: data.version, values: data.values });
    if (!getPreview()) applyDesign(data.values);
}

export function bootDesign(): Promise<void> {
    const preview = getPreview();
    const cached = read<{ version: number; values: DesignOverrides }>(CACHE_KEY);
    applyDesign(preview ?? cached?.values);
    const fetching = refreshPublished().catch(() => { /* se queda con lo que ya hay */ });
    // Con copia local (o vista previa) no se espera la red; sin ella, solo un momento.
    if (preview || cached) return Promise.resolve();
    return Promise.race([fetching, new Promise<void>(r => setTimeout(r, BOOT_WAIT_MS))]);
}
