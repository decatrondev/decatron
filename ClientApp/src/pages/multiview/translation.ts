import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import api from '../../services/api';
import { isTokenExpired } from '../../utils/jwt';
import type { Slot } from './types';

export interface TrInfo { enabled: boolean; live: boolean; languages: string[] }
export interface TrCaption { text: string; source: string; n: number }

const REFRESH_MS = 120_000;
// Las traducciones se piden por el Twitch login (el mismo que el de Decatron); en Kick hoy no hay traducción.

/** Qué canales de Twitch abiertos ofrecen traducción en vivo, qué idiomas y si está traduciendo ahora. Se repite cada 2 minutos. */
export function useTranslationInfo(slots: Slot[]) {
    const [info, setInfo] = useState<Record<string, TrInfo>>({});
    const known = useRef(new Set<string>());
    const list = slots.filter(s => s.platform === 'twitch').map(s => s.channel).join(',');

    useEffect(() => {
        const channels = list ? list.split(',') : [];
        let alive = true;
        const load = (only?: string[]) => {
            for (const login of only ?? channels) {
                api.get(`/live-translation/public/${encodeURIComponent(login)}`)
                    .then(r => {
                        if (!alive) return;
                        const d = r.data ?? {};
                        setInfo(prev => ({ ...prev, [login]: { enabled: !!d.enabled, live: !!d.live, languages: Array.isArray(d.languages) ? d.languages : [] } }));
                    })
                    .catch(() => { /* sin dato: la casilla se muestra sin el botón de traducción */ });
            }
        };
        // Solo se consultan los canales nuevos al agregarlos; los demás se refrescan cada 2 minutos.
        const fresh = channels.filter(c => !known.current.has(c));
        fresh.forEach(c => known.current.add(c));
        if (fresh.length) load(fresh);
        const id = window.setInterval(() => load(), REFRESH_MS);
        return () => { alive = false; window.clearInterval(id); };
    }, [list]);

    return info;
}

/**
 * Subtítulos de la traducción de un canal en un idioma: una conexión propia al hub público de traducción. Solo se usa el
 * texto de cada frase (SegmentStart); el audio doblado se escucha en twitch.tv con la extensión. Cada frase se muestra
 * el tiempo que tarda en leerse y luego desaparece.
 */
export function useTileCaptions(login: string, lang: string | null) {
    const [caption, setCaption] = useState<TrCaption | null>(null);
    const [active, setActive] = useState<boolean | null>(null);
    /** Motivo por el que el canal no deja escuchar (límites de acceso): paused, full, ip_limit, languages_full, language, rate_limited, busy */
    const [denied, setDenied] = useState<{ reason: string; minFollowDays?: number | null; minSubTier?: number | null } | null>(null);

    useEffect(() => {
        setCaption(null);
        setActive(null);
        setDenied(null);
        if (!lang) return;
        // Con la sesión iniciada el hub reconoce a la persona (límites por persona y, más adelante, los niveles de acceso del canal).
        const c = new signalR.HubConnectionBuilder().withUrl('/hubs/translation', {
            accessTokenFactory: () => { try { const k = localStorage.getItem('token'); return k && !isTokenExpired(k, 60) ? k : ''; } catch { return ''; } },
        }).withAutomaticReconnect([0, 2000, 5000, 15000, 30000]).configureLogging(signalR.LogLevel.None).build();
        let timer: number | null = null;
        let n = 0;

        c.on('SegmentStart', (m: { lang?: string; text?: string; source?: string }) => {
            if (m.lang && m.lang !== lang) return;
            const text = String(m.text ?? '').trim();
            if (!text) return;
            setCaption({ text, source: String(m.source ?? ''), n: ++n });
            if (timer != null) window.clearTimeout(timer);
            timer = window.setTimeout(() => setCaption(null), Math.max(3500, text.length * 75));
        });
        c.on('Status', (st: { active?: boolean }) => setActive(!!st?.active));
        // El servidor saca a quien escucha (por ejemplo, el streamer usó el botón de pánico)
        c.on('Denied', (m: { reason?: string; minFollowDays?: number | null; minSubTier?: number | null }) => { setDenied({ reason: m?.reason ?? 'paused', minFollowDays: m?.minFollowDays, minSubTier: m?.minSubTier }); setCaption(null); void c.stop(); });

        const join = () => c.invoke('Join', login, lang)
            .then((st: { ok?: boolean; reason?: string; minFollowDays?: number | null; minSubTier?: number | null; active?: boolean } | null) => {
                if (st && st.ok === false) { setDenied({ reason: st.reason ?? 'paused', minFollowDays: st.minFollowDays, minSubTier: st.minSubTier }); void c.stop(); return; }
                setDenied(null);
                setActive(!!st?.active);
            })
            .catch(() => { /* se reintenta al reconectar */ });
        c.onreconnected(() => { void join(); });
        let stopped = false;
        c.start().then(() => { if (!stopped) void join(); }).catch(() => { if (!stopped) setActive(null); });

        return () => { stopped = true; if (timer != null) window.clearTimeout(timer); void c.stop(); };
    }, [login, lang]);

    return { caption, active, denied };
}
