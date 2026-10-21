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

    // Los campos se leen por su nombre (no por la ruta técnica): «activation.rules[5].roles.everyone» pasa a «Regla 6 · Permiso: todos»
    const fieldLabel = (path: string): string => {
        const rule = path.match(/^activation\.rules\[(\d+)\]\.(.+)$/);
        const list = path.match(/^filters\.(blockedWords|blockedUsers)\[\d+\]$/);
        const key = rule ? `activation.rules.${rule[2]}` : list ? `filters.${list[1]}` : path;
        const label = i18n.exists(`speakchat:history.fields.${key}`) ? t(`history.fields.${key}`) : null;
        if (!label) return path;
        return rule ? t('history.ruleField', { n: Number(rule[1]) + 1, field: label }) : label;
    };

    // Valores con nombre propio (motores, modos, posiciones…); lo demás se muestra tal cual
    const VALUE_FIELDS = /(^|\.)(engine|pollyEngine|blockedWordsMode|noBalance|position|platform|type)$/;
    const value = (path: string, v: string | null) => {
        if (v === null || v === '') return t('history.emptyValue');
        if (v === 'true') return t('history.yes');
        if (v === 'false') return t('history.no');
        const field = path.replace(/\[\d+\]/g, '');
        if (VALUE_FIELDS.test(field) && i18n.exists(`speakchat:history.values.${v}`)) return t(`history.values.${v}`);
        return v;
    };

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
                                    <li key={i} className="text-sm text-ds-text break-words" title={c.path}>
                                        <span className="font-semibold">{fieldLabel(c.path)}:</span>{' '}
                                        <span className="text-ds-soft">{value(c.path, c.before)}</span> → {value(c.path, c.after)}
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
