// «Últimos cambios» de Speak Chat: quién guardó la configuración, cuándo y qué campos cambiaron.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface Change { path: string; before: string | null; after: string | null }
interface Entry { id: number; changedBy: string; createdAt: string; changes: Change[] }

// Debe coincidir con SpeakChatConfigDiff.MaxChanges del servidor
const MAX_CHANGES = 60;

export default function SpeakChatHistory({ refreshKey }: { refreshKey?: number }) {
    const { t, i18n } = useTranslation('speakchat');
    const [items, setItems] = useState<Entry[] | null>(null);
    const [error, setError] = useState(false);
    const [open, setOpen] = useState<Record<number, boolean>>({});

    useEffect(() => {
        let alive = true;
        api.get('/speakchat/history', { params: { limit: 20 } })
            .then(res => { if (alive) { setItems(res.data.items ?? []); setError(false); } })
            .catch(() => { if (alive) setError(true); });
        return () => { alive = false; };
    }, [refreshKey]);

    const value = (v: string | null) =>
        v === null ? t('history.emptyValue')
            : v === 'true' ? t('history.yes')
            : v === 'false' ? t('history.no')
            : v === '' ? t('history.emptyValue')
            : v;

    return (
        <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
            <p className="text-base font-bold text-ds-text">{t('history.title')}</p>
            <p className="text-sm text-ds-soft mb-4">{t('history.description')}</p>

            {error && <p className="text-sm text-ds-soft">{t('history.loadError')}</p>}
            {!error && items && items.length === 0 && <p className="text-sm text-ds-soft">{t('history.empty')}</p>}

            <ul className="divide-y divide-ds-border">
                {(items ?? []).map(e => (
                    <li key={e.id} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm text-ds-text">
                                {new Date(e.createdAt).toLocaleString(i18n.language)}
                                <span className="text-ds-soft"> · {t('history.by', { user: e.changedBy || t('history.unknownUser') })}</span>
                            </div>
                            <button
                                type="button"
                                className="ds-btn ds-btn--secondary"
                                onClick={() => setOpen(o => ({ ...o, [e.id]: !o[e.id] }))}
                            >
                                {open[e.id] ? t('history.hide') : t('history.show')} · {t('history.fieldsCount', { count: e.changes.length })}
                            </button>
                        </div>
                        {open[e.id] && (
                            <ul className="mt-2 space-y-1">
                                {e.changes.map((c, i) => (
                                    <li key={i} className="text-xs font-mono text-ds-text break-all">
                                        {c.path}: <span className="text-ds-soft">{value(c.before)}</span> → {value(c.after)}
                                    </li>
                                ))}
                                {e.changes.length >= MAX_CHANGES && (
                                    <li className="text-xs text-ds-soft">{t('history.moreChanges', { count: MAX_CHANGES })}</li>
                                )}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
