import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
    render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    reset: (id?: string) => void;
    remove: (id?: string) => void;
};
const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

function load(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (api()) { resolve(); return; }
        let el = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
        if (!el) {
            el = document.createElement('script');
            el.src = SRC; el.async = true; el.defer = true; el.dataset.turnstile = '1';
            document.head.appendChild(el);
        }
        el.addEventListener('load', () => resolve());
        el.addEventListener('error', () => reject(new Error('turnstile')));
    });
}

/** Desafío de Cloudflare Turnstile para los formularios de la plataforma. Solo aparece si el servidor tiene las claves. */
export function useTurnstile() {
    const { i18n } = useTranslation();
    const [siteKey, setSiteKey] = useState('');
    const [token, setToken] = useState('');
    const boxRef = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/platform/config').then(r => r.ok ? r.json() : null)
            .then(c => { if (!cancelled && c?.turnstileSiteKey) setSiteKey(c.turnstileSiteKey); })
            .catch(() => { /* sin configuración: el formulario funciona sin desafío */ });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!siteKey || !boxRef.current) return;
        let cancelled = false;
        load().then(() => {
            const t = api();
            if (cancelled || !boxRef.current || !t) return;
            widgetId.current = t.render(boxRef.current, {
                sitekey: siteKey, theme: 'dark', language: i18n.language?.startsWith('en') ? 'en' : 'es',
                callback: (tk: string) => setToken(tk),
                'expired-callback': () => setToken(''),
                'error-callback': () => setToken(''),
            });
        }).catch(() => { /* el envío avisará que falta el desafío */ });
        return () => { cancelled = true; if (widgetId.current) api()?.remove(widgetId.current); widgetId.current = undefined; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteKey]);

    /** El desafío es de un solo uso: tras un intento fallido se pide uno nuevo. */
    const reset = () => { setToken(''); if (widgetId.current) api()?.reset(widgetId.current); };

    return { enabled: !!siteKey, token, boxRef, reset };
}
