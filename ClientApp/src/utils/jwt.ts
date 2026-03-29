/**
 * Utilidades para manejar JWT tokens
 */

interface JwtPayload {
    exp?: number; // Expiration time (seconds since epoch)
    nbf?: number; // Not before time
    iat?: number; // Issued at time
    [key: string]: any;
}

/**
 * Decodifica un JWT sin verificar la firma (solo para leer el payload)
 */
export function decodeJwt(token: string): JwtPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.error('JWT inválido: no tiene 3 partes');
            return null;
        }

        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (error) {
        console.error('Error decodificando JWT:', error);
        return null;
    }
}

/**
 * Verifica si un JWT está expirado
 * @param token - El JWT token
 * @param bufferSeconds - Segundos de buffer antes de la expiración (default: 60)
 * @returns true si el token está expirado o va a expirar pronto
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
    const payload = decodeJwt(token);

    if (!payload || !payload.exp) {
        console.warn('JWT sin campo exp, considerando expirado');
        return true;
    }

    // exp está en segundos, Date.now() está en milisegundos
    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();
    const bufferTime = bufferSeconds * 1000;

    const isExpired = currentTime >= (expirationTime - bufferTime);

    if (isExpired) {
        const expDate = new Date(expirationTime);
        const now = new Date(currentTime);
        console.warn(`🔴 Token expirado o por expirar pronto:
            Expira: ${expDate.toISOString()}
            Ahora:  ${now.toISOString()}
            Buffer: ${bufferSeconds}s`);
    }

    return isExpired;
}

/**
 * Obtiene el tiempo restante de validez del token en segundos
 */
export function getTokenTimeRemaining(token: string): number {
    const payload = decodeJwt(token);

    if (!payload || !payload.exp) {
        return 0;
    }

    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();
    const remaining = Math.max(0, Math.floor((expirationTime - currentTime) / 1000));

    return remaining;
}

/**
 * Valida si un token es válido estructuralmente
 */
export function isValidJwtStructure(token: string): boolean {
    if (!token || typeof token !== 'string') {
        return false;
    }

    const parts = token.split('.');
    return parts.length === 3;
}
