import axios from 'axios';

// Cliente HTTP del panel del comprador (slug.decatron.top/panel). Usa SU sesión (clave aparte de la del streamer) y nunca toca la de Twitch.
export const BUYER_TOKEN_KEY = 'decatron.buyerToken';

const buyerApi = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', headers: { 'Content-Type': 'application/json' } });

// 2FA (pieza F): el token de paso vive solo en memoria (10 min en el servidor; aqui 9,5). Si una accion con credenciales responde
// step_up_required, se pide el codigo con el manejador que registra el panel y se repite la peticion una vez.
let stepUpToken = '';
let stepUpUntil = 0;
let stepUpHandler: (() => Promise<string>) | null = null;
let stepUpPending: Promise<string> | null = null;
export const setStepUp = (token: string) => { stepUpToken = token; stepUpUntil = Date.now() + 9.5 * 60 * 1000; };
export const setStepUpHandler = (h: (() => Promise<string>) | null) => { stepUpHandler = h; };

buyerApi.interceptors.request.use(config => {
    if (stepUpToken && Date.now() < stepUpUntil) config.headers['X-Step-Up'] = stepUpToken;
    let token = '';
    try { token = localStorage.getItem(BUYER_TOKEN_KEY) ?? ''; } catch { /* sin almacenamiento */ }
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Solo un 401 (sesión vencida o inválida) la borra y manda a pedir el enlace. Un 403 u otro error se muestra, sin tirar la sesión:
// pedir otro correo por un fallo que no es de la sesión sería gastar cuota para nada.
buyerApi.interceptors.response.use(r => r, async err => {
    const s = err?.response?.status;
    const cfg = err?.config;
    if (s === 403 && err.response?.data?.code === 'step_up_required' && stepUpHandler && cfg && !cfg._stepUpRetried) {
        cfg._stepUpRetried = true;
        try {
            stepUpPending ??= stepUpHandler().finally(() => { stepUpPending = null; });
            setStepUp(await stepUpPending);
        } catch { return Promise.reject(err); } // canceló: la accion no se hace y el panel muestra el error de siempre
        cfg.headers['X-Step-Up'] = stepUpToken;
        return buyerApi.request(cfg);
    }
    if (s === 401) {
        try { localStorage.removeItem(BUYER_TOKEN_KEY); } catch { /* sin almacenamiento */ }
        if (!window.location.pathname.startsWith('/panel/login')) window.location.href = '/panel/login';
    }
    return Promise.reject(err);
});

export default buyerApi;
