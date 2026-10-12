import axios from 'axios';
import { isTokenExpired, isValidJwtStructure } from '../utils/jwt';
import { notifyTokenRemoved } from '../utils/tokenEvents';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// En /multi una sesión vencida nunca saca de la página (se cortarían todos los videos): se borra la sesión, la página lo
// muestra con un aviso y sigue como anónima. La renovación mientras está abierta la hace useMultiviewSession.
const staysOnPage = () => window.location.pathname === '/multi' || window.location.pathname.startsWith('/multi/');
const toLogin = () => {
    if (staysOnPage()) return;
    if (window.location.pathname !== '/login') window.location.href = '/login';
};

// Interceptor para agregar token JWT Y verificar expiración
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');

        if (token) {
            // Verificar si el token es válido estructuralmente
            if (!isValidJwtStructure(token)) {
                console.error('🔴 Token con estructura inválida, limpiando...');
                localStorage.removeItem('token');
                notifyTokenRemoved();
                toLogin();
                if (staysOnPage()) return config;
                return Promise.reject(new Error('Token inválido'));
            }

            // Verificar si el token está expirado (con 60s de buffer)
            if (isTokenExpired(token, 60)) {
                console.warn('🔴 Token expirado detectado, redirigiendo al login...');
                localStorage.removeItem('token');
                notifyTokenRemoved();
                toLogin();
                if (staysOnPage()) return config;
                return Promise.reject(new Error('Token expirado'));
            }

            // Token válido, agregarlo a los headers
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor de respuesta (MODIFICADO)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // 1. Comprobamos si estamos en medio del proceso de autenticación
        const isAuthenticating = localStorage.getItem('isAuthenticating');

        // 2. Verificar si hay un code en la URL (auth callback en progreso)
        const urlParams = new URLSearchParams(window.location.search);
        const codeInUrl = urlParams.get('code');

        // 3. Solo redirigimos si el error es 401 Y NO estamos autenticando Y NO hay code en URL
        //    Y la request NO es al endpoint de exchange (que es AllowAnonymous)
        const isExchangeRequest = error.config?.url?.includes('/auth/exchange');
        if (error.response?.status === 401 && !isAuthenticating && !codeInUrl && !isExchangeRequest) {
            // Token inválido o expirado
            localStorage.removeItem('token');
            notifyTokenRemoved();
            // Asegurarnos de no estar en un bucle si ya estamos en /login (y en /multi no se sale de la página)
            toLogin();
        }
        return Promise.reject(error);
    }
);

export default api;
