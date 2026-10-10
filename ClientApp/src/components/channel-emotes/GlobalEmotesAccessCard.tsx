import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Loader2 } from 'lucide-react';
import api from '../../services/api';

// Acceso a los emotes globales de Decatron desde el panel de emotes: quien ya tiene permiso va a gestionarlos,
// y quien no puede solicitarlo (el owner aprueba o rechaza desde /emotes/global).

interface Me { delegated?: boolean; access: 'owner' | 'admin' | 'manager' | 'none'; request: { status: 'pending' | 'approved' | 'rejected'; resolvedAt?: string | null } | null }

const btn = 'px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-ds-accent text-ds-on-accent hover:bg-ds-accent-hover disabled:opacity-50 flex items-center gap-2';

export default function GlobalEmotesAccessCard({ onGranted }: { onGranted?: () => void }) {
    const { t } = useTranslation('emotes');
    const [me, setMe] = useState<Me | null>(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try { setMe((await api.get('/global-emotes/me')).data); } catch { setMe(null); }
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (me && me.access !== 'none') onGranted?.(); }, [me, onGranted]);

    const send = async () => {
        setBusy(true); setError(null);
        try { await api.post('/global-emotes/request', { message: message.trim() || null }); setMessage(''); await load(); }
        catch (e: any) {
            const code = e?.response?.data?.error;
            setError(t(`global.errors.${code}`, { defaultValue: t('global.errors.request_failed') }));
            await load();
        } finally { setBusy(false); }
    };

    // Actuando en el canal de otra persona no se ofrece: el permiso es personal
    if (!me || me.delegated) return null;
    const rejected = me.request?.status === 'rejected';

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-5 3xl:p-6 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Globe className="w-6 h-6 text-ds-accent-text shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <h2 className="font-bold text-base 3xl:text-lg text-ds-text">{t('global.card.title')}</h2>
                        <p className="text-sm 3xl:text-base text-ds-soft mt-1">
                            {me.access !== 'none' ? t('global.card.has') : me.request?.status === 'pending' ? t('global.card.pending') : t('global.card.ask')}
                        </p>
                        {rejected && me.access === 'none' && <p className="text-sm text-ds-warn mt-1">{t('global.card.rejected')}</p>}
                        {error && <p className="text-sm text-ds-danger mt-1">{error}</p>}
                    </div>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[18rem]">
                    {me.access !== 'none' && <a href="/emotes/global" className={`${btn} justify-center`}>{t('global.card.manage')}</a>}
                    {me.access === 'none' && me.request?.status !== 'pending' && (
                        <>
                            <textarea value={message} maxLength={300} rows={2} onChange={e => setMessage(e.target.value)} placeholder={t('global.card.messagePlaceholder')}
                                className="ds-input" />
                            <button className={`${btn} justify-center`} disabled={busy} onClick={send}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('global.card.request')}</button>
                        </>
                    )}
                    <a href="/emotes/global" className="text-center text-sm font-bold text-ds-accent-text hover:underline">{t('global.card.viewSet')}</a>
                </div>
            </div>
        </div>
    );
}
