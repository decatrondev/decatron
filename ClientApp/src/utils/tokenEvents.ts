/**
 * Sistema de eventos para notificar cuando el token JWT cambia
 * Permite que múltiples componentes reaccionen a cambios de autenticación
 */

export const TOKEN_CHANGED_EVENT = 'tokenChanged';
export const TOKEN_REMOVED_EVENT = 'tokenRemoved';

/**
 * Dispara un evento cuando el token cambia (nuevo login)
 */
export function notifyTokenChanged(newToken: string) {
    window.dispatchEvent(new CustomEvent(TOKEN_CHANGED_EVENT, {
        detail: { token: newToken, timestamp: Date.now() }
    }));
}

/**
 * Dispara un evento cuando el token es removido (logout)
 */
export function notifyTokenRemoved() {
    window.dispatchEvent(new CustomEvent(TOKEN_REMOVED_EVENT, {
        detail: { timestamp: Date.now() }
    }));
}

/**
 * Listener para cambios de token
 */
export function onTokenChanged(callback: () => void) {
    const handler = () => callback();
    window.addEventListener(TOKEN_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TOKEN_CHANGED_EVENT, handler);
}

/**
 * Listener para cuando se remueve el token
 */
export function onTokenRemoved(callback: () => void) {
    const handler = () => callback();
    window.addEventListener(TOKEN_REMOVED_EVENT, handler);
    return () => window.removeEventListener(TOKEN_REMOVED_EVENT, handler);
}
