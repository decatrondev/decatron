import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import api from '../../../services/api';

export interface AudienceStatus {
    status: 'ready' | 'needsBranded' | 'unknown' | 'notRequired';
    live: boolean;
    viewers: number;
    sampledAt: string | null;
    hasTwitch: boolean;
    hasKick: boolean;
}

const TONE = {
    ready: 'border-ds-ok/40 bg-ds-accent/5 text-ds-ok',
    needsBranded: 'border-ds-warn/40 bg-ds-warn/10 text-ds-warn',
    unknown: 'border-ds-border bg-ds-raised/40 text-ds-soft',
    notRequired: 'border-ds-border bg-ds-raised/40 text-ds-soft',
} as const;

/**
 * Por qué una pieza de tercero sale o no sale en este canal: en Twitch exige «Contenido de marca» activado en Editar información del stream.
 * Se actualiza solo cada minuto y con el botón. Un canal sin contenido de marca NO es un error: el texto lo dice.
 */
export function ThirdPartyStatus({ initial }: { initial: AudienceStatus | null }) {
    const { t, i18n } = useTranslation('promo');
    const [a, setA] = useState<AudienceStatus | null>(initial);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        setBusy(true);
        try { const r = await api.get('/promo-panel/audience'); if (r.data?.audience) setA(r.data.audience as AudienceStatus); } catch { /* se mantiene el último dato */ }
        setBusy(false);
    }, []);
    useEffect(() => { const id = window.setInterval(refresh, 60000); return () => window.clearInterval(id); }, [refresh]);
    // El primer dato puede venir vacío (aún sin muestreo): se vuelve a pedir pronto, cuando el servidor ya consultó la plataforma.
    useEffect(() => { if (a?.status === 'unknown') { const id = window.setTimeout(refresh, 8000); return () => window.clearTimeout(id); } }, [a?.status, refresh]);

    if (!a) return null;
    const time = a.sampledAt ? new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(a.sampledAt)) : null;
    return (
        <div role="status" className={`rounded-lg border px-4 py-3 ${TONE[a.status]}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm 3xl:text-base font-bold">{t(`panel.audience.${a.status}.title`)}</p>
                <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={busy} onClick={refresh}>
                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />{t('panel.audience.refresh')}
                </button>
            </div>
            <p className="text-sm 3xl:text-base mt-1 opacity-90">{t(`panel.audience.${a.status}.text`)}</p>
            {a.hasKick && <p className="text-sm 3xl:text-base mt-1 opacity-90">{t('panel.audience.kick')}</p>}
            <p className="text-xs 3xl:text-sm mt-2 opacity-80">
                {a.live ? t('panel.audience.live', { n: a.viewers }) : t('panel.audience.offline')}
                {time ? ` · ${t('panel.audience.checked', { time })}` : ''}
            </p>
        </div>
    );
}
