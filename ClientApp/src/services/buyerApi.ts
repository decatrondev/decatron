import axios from 'axios';

// Cliente HTTP del panel del comprador (slug.decatron.top/panel). Usa SU sesión (clave aparte de la del streamer) y nunca toca la de Twitch.
export const BUYER_TOKEN_KEY = 'decatron.buyerToken';

const buyerApi = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', headers: { 'Content-Type': 'application/json' } });

buyerApi.interceptors.request.use(config => {
    let token = '';
    try { token = localStorage.getItem(BUYER_TOKEN_KEY) ?? ''; } catch { /* sin almacenamiento */ }
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Solo un 401 (sesión vencida o inválida) la borra y manda a pedir el enlace. Un 403 u otro error se muestra, sin tirar la sesión:
// pedir otro correo por un fallo que no es de la sesión sería gastar cuota para nada.
buyerApi.interceptors.response.use(r => r, err => {
    const s = err?.response?.status;
    if (s === 401) {
        try { localStorage.removeItem(BUYER_TOKEN_KEY); } catch { /* sin almacenamiento */ }
        if (!window.location.pathname.startsWith('/panel/login')) window.location.href = '/panel/login';
    }
    return Promise.reject(err);
});

export default buyerApi;
