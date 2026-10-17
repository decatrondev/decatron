// ¿Esta carga es del subdominio de un tenant (slug.decatron.top)? Ahí el login y el panel llevan la marca del tenant, no la de Decatron.
export function isTenantHost(): boolean {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname.toLowerCase();
    return /^[a-z0-9-]+\.decatron\.top$/.test(h) && !h.startsWith('www.');
}
