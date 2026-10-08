import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { CopyButton, inputClass } from './ui';

/**
 * Piezas compartidas por los paneles de los overlays que reúnen Twitch y Kick (Chat, Sound Alerts…): un enlace de OBS con su
 * estado "conectado ahora", el aviso de fuentes que se pisan y el hook que consulta ese estado al servidor.
 * Patrón: .dev/plans/MULTIPLATAFORMA_PATRON.md.
 */

export interface OverlayStatus {
    total: number;
    all: number;
    twitch: number;
    kick: number;
    warnings: Array<'mixed' | 'repeated'>;
    /** Solo en los módulos cuyo `status` también describe la cuenta (Sound Alerts) */
    overlayKey?: string;
    hasTwitch?: boolean;
    hasKick?: boolean;
}

const EMPTY: OverlayStatus = { total: 0, all: 0, twitch: 0, kick: 0, warnings: [] };

/** Qué fuentes del overlay hay conectadas en OBS ahora. Se vuelve a preguntar cada pocos segundos mientras la pestaña está visible */
export function useOverlayStatus(endpoint: string, intervalMs = 5000) {
    const [status, setStatus] = useState<OverlayStatus>(EMPTY);
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get(endpoint);
            if (res.data?.success) {
                setStatus({
                    total: res.data.total ?? 0, all: res.data.all ?? 0, twitch: res.data.twitch ?? 0, kick: res.data.kick ?? 0,
                    warnings: res.data.warnings ?? [],
                    overlayKey: res.data.overlayKey, hasTwitch: res.data.hasTwitch, hasKick: res.data.hasKick,
                });
                setLoaded(true);
            }
        } catch { /* se queda con el último estado */ }
    }, [endpoint]);

    useEffect(() => {
        load();
        const id = window.setInterval(() => { if (!document.hidden) load(); }, intervalMs);
        return () => window.clearInterval(id);
    }, [load, intervalMs]);

    return { status, loaded, refresh: load };
}

interface LinkRowProps {
    url: string;
    copyLabel: string;
    copiedLabel: string;
    name?: string;
    hint?: string;
    recommended?: boolean;
    connected: boolean;
    /** false hasta que llega la primera respuesta del servidor: mientras tanto no se dibuja el estado */
    loaded: boolean;
    /** Botón extra a la derecha del de copiar (p. ej. «Abrir») */
    extra?: React.ReactNode;
}

/** Un enlace de OBS con su estado: conectado en OBS ahora o sin conexión */
export function LinkRow({ url, copyLabel, copiedLabel, name, hint, recommended, connected, loaded, extra }: LinkRowProps) {
    const { t } = useTranslation('overlays');
    return (
        <div>
            {(name || loaded) && (
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {name && <span className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">{name}</span>}
                    {recommended && <span className="px-2 py-0.5 rounded-full text-[11px] 3xl:text-xs font-bold bg-[#eff6ff] dark:bg-[#1e3a8a]/30 text-[#2563eb] dark:text-[#93c5fd]">{t('overlayLinks.recommended')}</span>}
                    {loaded && (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] 3xl:text-xs font-bold ${connected ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-[#94a3b8]'}`} />
                            {connected ? t('overlayLinks.connected') : t('overlayLinks.notConnected')}
                        </span>
                    )}
                </div>
            )}
            {hint && <p className="text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8] mb-2">{hint}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
                <input className={`${inputClass} font-mono`} readOnly value={url} onFocus={e => e.currentTarget.select()} />
                <div className="flex gap-2">
                    <CopyButton text={url} label={copyLabel} doneLabel={copiedLabel} />
                    {extra}
                </div>
            </div>
        </div>
    );
}

export function Warning({ title, text }: { title: string; text: string }) {
    return (
        <div role="alert" className="mt-5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <p className="text-sm 3xl:text-base font-bold text-amber-800 dark:text-amber-300">{title}</p>
            <p className="text-sm 3xl:text-base text-amber-800/90 dark:text-amber-200/90 mt-1">{text}</p>
        </div>
    );
}
