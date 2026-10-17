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

// Sesión vencida o revocada: se borra y se vuelve a pedir el enlace de entrada.
buyerApi.interceptors.response.use(r => r, err => {
    const s = err?.response?.status;
    if (s === 401 || s === 403) {
        try { localStorage.removeItem(BUYER_TOKEN_KEY); } catch { /* sin almacenamiento */ }
        if (!window.location.pathname.startsWith('/panel/login')) window.location.href = '/panel/login';
    }
    return Promise.reject(err);
});

export default buyerApi;
