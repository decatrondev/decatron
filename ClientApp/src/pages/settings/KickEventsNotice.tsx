import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { linkButton } from './parts';

type EventsState = 'unknown' | 'ok' | 'problem';

/**
 * Aviso de los eventos de Kick (follows, subs, regalos, Kicks, directo). Solo aparece si Kick está vinculado
 * y alguna suscripción falló; con todo bien (o sin revisar todavía) no muestra nada.
 */
export default function KickEventsNotice() {
    const { t } = useTranslation('settings');
    const [state, setState] = useState<EventsState>('unknown');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/auth/kick/events-status');
            setState((res.data?.state as EventsState) ?? 'unknown');
        } catch {
            setState('unknown');
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const retry = async () => {
        setBusy(true);
        setNote(null);
        try {
            const res = await api.post('/auth/kick/events-retry');
            const next = (res.data?.state as EventsState) ?? 'unknown';
            setState(next);
            if (next === 'problem') setNote(t('kickEvents.stillFailing'));
        } catch (e: unknown) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            setNote(status === 429 ? t('kickEvents.wait') : t('kickEvents.stillFailing'));
        } finally {
            setBusy(false);
        }
    };

    if (state !== 'problem') return null;

    return (
        <div className="px-5 4xl:px-7 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-ds-raised">
            <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-ds-warn mt-0.5" />
                <div className="min-w-0">
                    <p className="text-sm 4xl:text-base font-medium text-ds-warn">{t('kickEvents.title')}</p>
                    <p className="text-sm 4xl:text-base text-ds-muted">{t('kickEvents.body')}</p>
                    {note && <p className="text-sm 4xl:text-base text-ds-warn mt-1">{note}</p>}
                </div>
            </div>
            <button onClick={retry} disabled={busy} className={`${linkButton} flex-shrink-0 self-start sm:self-auto`}>
                {busy ? t('kickEvents.retrying') : t('kickEvents.retry')}
            </button>
        </div>
    );
}
