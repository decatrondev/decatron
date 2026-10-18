// ¿Esta carga es del subdominio de un tenant (slug.decatron.top)? Ahí el login y el panel llevan la marca del tenant, no la de Decatron.
export function isTenantHost(): boolean {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname.toLowerCase();
    return /^[a-z0-9-]+\.decatron\.top$/.test(h) && !h.startsWith('www.');
}

// Nombre del proyecto del subdominio (GET /api/platform/tenant-info): se pide una sola vez por carga. Fuera de un subdominio es null.
let tenantNamePromise: Promise<string | null> | null = null;
export function loadTenantName(): Promise<string | null> {
    if (!isTenantHost()) return Promise.resolve(null);
    tenantNamePromise ??= fetch('/api/platform/tenant-info')
        .then(r => (r.ok ? r.json() : null))
        .then(j => (j && typeof j.name === 'string' ? j.name : null))
        .catch(() => null);
    return tenantNamePromise;
}
