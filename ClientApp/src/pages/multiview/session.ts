import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { decodeJwt } from '../../utils/jwt';
import { notifyTokenChanged, notifyTokenRemoved, onTokenChanged, onTokenRemoved } from '../../utils/tokenEvents';

// La sesión de Decatron vence a la hora y en el resto del sitio no se renueva. En /multi la gente deja la página horas (lurk), así que
// mientras está abierta se pide una sesión nueva unos minutos antes de que venza, sin tope. Si aun así vence (PC suspendida, sin
// internet más de una hora), la página no se cierra: los videos siguen y se avisa para volver a entrar.

const RENEW_BEFORE_S = 10 * 60;
const CHECK_EVERY_MS = 60_000;

export type MultiviewSession = 'none' | 'active' | 'expired';

const secondsLeft = (token: string | null) => {
    const exp = token ? decodeJwt(token)?.exp : undefined;
    return typeof exp === 'number' ? exp - Date.now() / 1000 : -1;
};
const readToken = () => { try { return localStorage.getItem('token'); } catch { return null; } };

export function useMultiviewSession(): MultiviewSession {
    const [state, setState] = useState<MultiviewSession>(() => (secondsLeft(readToken()) > 0 ? 'active' : 'none'));
    const busy = useRef(false);

    useEffect(() => {
        const check = () => {
            const token = readToken();
            if (!token) return;
            const left = secondsLeft(token);
            if (left <= 0) {
                // Venció mientras la página no podía renovarla: se quita sin salir de la página
                try { localStorage.removeItem('token'); } catch { /* sin almacenamiento */ }
                notifyTokenRemoved();
                return;
            }
            if (left > RENEW_BEFORE_S || busy.current) return;
            busy.current = true;
            api.post('/multiview/session/renew')
                .then(r => {
                    const next = r.data?.token;
                    if (typeof next !== 'string' || readToken() !== token) return; // otra pestaña ya la cambió (o se cerró sesión)
                    try { localStorage.setItem('token', next); } catch { return; }
                    notifyTokenChanged(next);
                })
                .catch(() => { /* se reintenta en la próxima vuelta; si el servidor la rechaza, el interceptor la borra */ })
                .finally(() => { busy.current = false; });
        };
        check();
        const id = window.setInterval(check, CHECK_EVERY_MS);
        // Al volver de la suspensión o de otra pestaña los temporizadores pudieron quedar dormidos: se revisa en el acto
        const onWake = () => { if (!document.hidden) check(); };
        document.addEventListener('visibilitychange', onWake);
        window.addEventListener('focus', onWake);
        const offChanged = onTokenChanged(() => setState('active'));
        const offRemoved = onTokenRemoved(() => setState(prev => (prev === 'none' ? 'none' : 'expired')));
        // Otra pestaña inició o cerró sesión
        const onStorage = (e: StorageEvent) => {
            if (e.key !== 'token') return;
            if (e.newValue && secondsLeft(e.newValue) > 0) setState('active');
            else setState(prev => (prev === 'none' ? 'none' : 'expired'));
        };
        window.addEventListener('storage', onStorage);
        return () => {
            window.clearInterval(id);
            document.removeEventListener('visibilitychange', onWake);
            window.removeEventListener('focus', onWake);
            offChanged(); offRemoved();
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    return state;
}
