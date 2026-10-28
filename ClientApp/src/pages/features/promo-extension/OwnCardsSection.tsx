import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import { Card, Field, Select, Slider, Toggle, inputClass } from '../../../components/overlay-editor/ui';
import { PromoZoom } from '../../../components/promo-overlay/PromoPreview';
import { PROMO_ICONS } from '../../../components/promo/icons';
import { useBrand } from '../../../brand/BrandContext';
import type { PromoContent } from '../../../components/promo-overlay/types';
import { ShowNowButton } from './ShowNowButton';
import type { Limits, OwnCard, Template, Zone } from './types';

const blank = (zone: string, limits: Limits): OwnCard => ({
    id: 0, title: '', body: '', icon: null, linkUrl: null, showQr: false, zone, templateId: null,
    durationSeconds: Math.min(Math.max(8, limits.minDurationSeconds), limits.maxDurationSeconds), intervalMinutes: Math.max(10, limits.ownMinIntervalMinutes), isEnabled: true, hiddenByAdmin: false,
});

/**
 * Tarjetas propias del streamer (solo texto): salen únicamente en su canal, después de una pieza del bot. Se guardan al instante, cada
 * una por su cuenta (no con el botón Guardar de las demás pestañas).
 */
export function OwnCardsSection({ cards, max, templates, zones, limits, lang, channel, botActive, onChanged }: {
    cards: OwnCard[]; max: number; templates: Template[]; zones: Zone[]; limits: Limits; lang: string; channel: string; botActive: boolean; onChanged: () => Promise<void>;
}) {
    const { t } = useTranslation('promo');
    const { resolve } = useBrand();
    const [draft, setDraft] = useState<OwnCard | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = (patch: Partial<OwnCard>) => setDraft(d => (d ? { ...d, ...patch } : d));

    const errorText = (e: unknown) => {
        const code = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
        return code ? t(`panel.cards.errors.${code}`, { defaultValue: t('panel.cards.errors.unknown') }) : t('panel.cards.errors.unknown');
    };
    const save = async (c: OwnCard) => {
        setBusy(true); setError(null);
        try {
            await api.put(`/promo-panel/card/${c.id}`, { title: c.title, body: c.body, icon: c.icon, linkUrl: c.linkUrl, showQr: c.showQr, zone: c.zone, templateId: c.templateId, durationSeconds: c.durationSeconds, intervalMinutes: c.intervalMinutes, isEnabled: c.isEnabled });
            await onChanged(); setDraft(null);
        } catch (e) { setError(errorText(e)); }
        setBusy(false);
    };
    const remove = async (c: OwnCard) => {
        if (!window.confirm(t('panel.cards.confirmDelete'))) return;
        setBusy(true); setError(null);
        try { await api.delete(`/promo-panel/card/${c.id}`); await onChanged(); } catch (e) { setError(errorText(e)); }
        setBusy(false);
    };

    const contentOf = (c: OwnCard): PromoContent => ({ title: c.title, body: c.body, link: c.linkUrl, imageUrl: null, icon: c.icon, showQr: c.showQr });
    const tplFor = (c: OwnCard) => templates.find(x => x.id === c.templateId && x.zone === c.zone) ?? templates.find(x => x.zone === c.zone);
    const varsOf = (c: OwnCard) => ({ channel, commands: '!title · !game', link: (c.linkUrl || 'https://decatron.net').replace(/^https:\/\//, '') });
    const zoneName = (key: string) => { const z = zones.find(x => x.key === key); return z ? (lang === 'en' ? z.nameEn : z.nameEs) || key : key; };

    return (
        <Card title={t('panel.cards.title')} description={t('panel.cards.description', { count: cards.length, max })}
            actions={!draft && cards.length < max && zones.length > 0 ? <button className="ds-btn ds-btn--primary ds-btn--sm" onClick={() => { setError(null); setDraft(blank(zones[0].key, limits)); }}><Plus className="w-4 h-4" />{t('panel.cards.add')}</button> : undefined}>
            <div className="space-y-4">
                {!botActive && cards.length > 0 && <p className="text-sm 3xl:text-base text-ds-warn">{t('panel.cards.needsBot')}</p>}
                {error && <p className="text-sm 3xl:text-base text-ds-danger" role="alert">{error}</p>}
                {cards.length === 0 && !draft && <p className="text-ds-soft">{t('panel.cards.empty')}</p>}
                {cards.length >= max && <p className="text-sm text-ds-soft">{t('panel.cards.quota', { max })}</p>}

                {draft && (
                    <div className="rounded-lg border border-ds-border bg-ds-raised/40 p-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label={t('panel.cards.fields.title')}><input className={inputClass} maxLength={80} value={draft.title} onChange={e => set({ title: e.target.value })} /></Field>
                            <Field label={t('panel.cards.fields.icon')}>
                                <Select value={draft.icon ?? ''} onChange={v => set({ icon: v || null })} options={[{ value: '', label: t('panel.cards.fields.noIcon') }, ...Object.keys(PROMO_ICONS).map(k => ({ value: k, label: k }))]} />
                            </Field>
                        </div>
                        <Field label={t('panel.cards.fields.body')} hint={t('panel.cards.fields.bodyHint', { channel: '{{channel}}', commands: '{{commands}}', link: '{{link}}', interpolation: { escapeValue: false } })}><textarea className={inputClass} rows={3} maxLength={200} value={draft.body} onChange={e => set({ body: e.target.value })} /></Field>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label={t('panel.cards.fields.link')} hint={t('panel.cards.fields.linkHint')}><input className={inputClass} maxLength={500} placeholder="https://" value={draft.linkUrl ?? ''} onChange={e => set({ linkUrl: e.target.value || null })} /></Field>
                            <Toggle checked={draft.showQr} onChange={v => set({ showQr: v })} label={t('panel.cards.fields.qr')} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label={t('panel.cards.fields.zone')}>
                                <Select value={draft.zone} onChange={v => set({ zone: v, templateId: null })} options={zones.map(z => ({ value: z.key, label: zoneName(z.key) }))} />
                            </Field>
                            {templates.filter(x => x.zone === draft.zone).length > 1 && (
                                <Field label={t('panel.cards.fields.template')}>
                                    <Select value={String(draft.templateId ?? templates.find(x => x.zone === draft.zone)?.id ?? '')} onChange={v => set({ templateId: Number(v) })}
                                        options={templates.filter(x => x.zone === draft.zone).map((x, i) => ({ value: String(x.id), label: t('panel.design.templateN', { n: i + 1 }) }))} />
                                </Field>
                            )}
                            <Field label={t('panel.cards.fields.duration')}><Slider value={draft.durationSeconds} min={limits.minDurationSeconds} max={limits.maxDurationSeconds} suffix=" s" onChange={v => set({ durationSeconds: v })} /></Field>
                            <Field label={t('panel.cards.fields.interval')} hint={t('panel.cards.fields.intervalHint', { min: limits.ownMinIntervalMinutes })}>
                                <Slider value={draft.intervalMinutes} min={limits.ownMinIntervalMinutes} max={120} suffix=" min" onChange={v => set({ intervalMinutes: v })} />
                            </Field>
                        </div>
                        <Toggle checked={draft.isEnabled} onChange={v => set({ isEnabled: v })} label={t('panel.cards.fields.enabled')} />
                        {tplFor(draft) && <PromoZoom design={tplFor(draft)!.design} content={contentOf(draft)} resolveImage={resolve} vars={varsOf(draft)} />}
                        <div className="flex gap-2">
                            <button className="ds-btn ds-btn--primary ds-btn--sm" disabled={busy} onClick={() => save(draft)}>{t('panel.cards.save')}</button>
                            <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={busy} onClick={() => { setDraft(null); setError(null); }}>{t('panel.cards.cancel')}</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {cards.map(c => (
                        <div key={c.id} className={`rounded-lg border border-ds-border bg-ds-raised/40 p-3 space-y-3 min-w-0 ${!c.isEnabled || c.hiddenByAdmin ? 'opacity-60' : ''}`}>
                            <Toggle checked={c.isEnabled} onChange={on => save({ ...c, isEnabled: on })} label={c.title || c.body} hint={c.hiddenByAdmin ? t('panel.cards.hidden') : c.isEnabled ? t('panel.pieces.on') : t('panel.pieces.off')} />
                            {tplFor(c) && <PromoZoom design={tplFor(c)!.design} content={contentOf(c)} resolveImage={resolve} vars={varsOf(c)} />}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs 3xl:text-sm text-ds-soft">
                                <span>{t('panel.pieces.zone')}: {zoneName(c.zone)}</span>
                                <span>{t('panel.pieces.seconds', { n: c.durationSeconds })}</span>
                                <span>{t('panel.cards.every', { n: c.intervalMinutes })}</span>
                            </div>
                            {!c.hiddenByAdmin && <ShowNowButton pieceId={-c.id} />}
                            <div className="flex gap-2">
                                <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={busy} onClick={() => { setError(null); setDraft(c); }}><Pencil className="w-4 h-4" />{t('panel.cards.edit')}</button>
                                <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={busy} onClick={() => remove(c)}><Trash2 className="w-4 h-4" />{t('panel.cards.delete')}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}
