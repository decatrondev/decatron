import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field, Input, Select, Textarea } from '../../../components/ds';
import { ToggleRow } from '../../../components/dashboard/config';
import ModalShell from '../../../components/dashboard/ModalShell';
import { PROMO_ICONS } from '../../../components/promo/icons';
import { errorCodes, promoAdminApi } from './api';
import { PreviewPane, contentOf, errorText, fromLocalInput, sampleVars, templateOf, toLocalInput, zonePlacement, type Lang } from './shared';
import type { PromoOptions, PromoPiece, PromoTemplate, PromoZone } from './types';

/** El panel escala con zoom en pantallas grandes (--z, index.css): sin dividir por --z el modal se pasa del alto de la ventana. */
const BODY_SCROLL = { maxHeight: 'calc((100vh - 260px) / var(--z, 1))' } as const;
const sectionCls = 'text-xs font-semibold uppercase tracking-wide text-ds-soft border-b border-ds-border pb-1 mt-2';

export function PieceEditor({ initial, templates, zones, options, lang, onLang, onClose, onSaved }: {
    initial: PromoPiece; templates: PromoTemplate[]; zones: PromoZone[]; options: PromoOptions; lang: Lang; onLang: (l: Lang) => void;
    onClose: () => void; onSaved: (p: PromoPiece) => void;
}) {
    const { t } = useTranslation('promo');
    const [p, setP] = useState<PromoPiece>(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = <K extends keyof PromoPiece>(k: K, v: PromoPiece[K]) => setP(prev => ({ ...prev, [k]: v }));
    const num = (k: 'priority' | 'weight' | 'durationSeconds') => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) || 0);

    const save = async () => {
        setSaving(true); setError(null);
        try { onSaved(await promoAdminApi.upsertPiece(p)); }
        catch (e) { setError(errorText(t, errorCodes(e))); }
        finally { setSaving(false); }
    };

    return (
        <ModalShell
            title={t(p.id ? 'admin.editor.titleEdit' : 'admin.editor.titleNew')} size="xl" onClose={onClose}
            actions={<>
                <Button variant="secondary" onClick={onClose}>{t('admin.editor.cancel')}</Button>
                <Button loading={saving} onClick={save}>{t('admin.editor.save')}</Button>
            </>}
        >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-6 overflow-y-auto pr-1" style={BODY_SCROLL}>
                <div className="space-y-4 min-w-0">
                    {error && <Alert tone="danger">{error}</Alert>}
                    {p.kind === 'emergency' && <Alert tone="warn">{t('admin.pieces.emergencyNote')}</Alert>}

                    <p className={sectionCls}>{t('admin.editor.content')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label={t('admin.editor.kind')}>
                            <Select value={p.kind} onChange={e => set('kind', e.target.value as PromoPiece['kind'])}>
                                {options.kinds.map(k => <option key={k} value={k}>{t(`admin.pieces.kind.${k}`)}</option>)}
                            </Select>
                        </Field>
                        <Field label={t('admin.editor.origin')}>
                            <Select value={p.origin} onChange={e => set('origin', e.target.value as PromoPiece['origin'])}>
                                {options.origins.map(o => <option key={o} value={o}>{t(`admin.pieces.origin.${o}`)}</option>)}
                            </Select>
                        </Field>
                        {p.origin === 'tercero' && (
                            <div className="sm:col-span-2">
                                <Field label={t('admin.editor.advertiser')} hint={t('admin.editor.advertiserHint')}>
                                    <Input value={p.advertiserName ?? ''} maxLength={80} placeholder={t('admin.editor.advertiserPlaceholder')} onChange={e => set('advertiserName', e.target.value || null)} />
                                </Field>
                            </div>
                        )}
                        <Field label={t('admin.editor.titleEs')}><Input value={p.titleEs} maxLength={120} onChange={e => set('titleEs', e.target.value)} /></Field>
                        <Field label={t('admin.editor.titleEn')}><Input value={p.titleEn} maxLength={120} onChange={e => set('titleEn', e.target.value)} /></Field>
                        <Field label={t('admin.editor.bodyEs')}><Textarea value={p.bodyEs} maxLength={300} rows={3} onChange={e => set('bodyEs', e.target.value)} /></Field>
                        <Field label={t('admin.editor.bodyEn')} hint={t('admin.editor.englishFallback')}><Textarea value={p.bodyEn} maxLength={300} rows={3} onChange={e => set('bodyEn', e.target.value)} /></Field>
                    </div>
                    <p className="text-xs text-ds-faint">{t('admin.editor.variables', { vars: options.variables.map(v => `{{${v}}}`).join(' ') })}</p>
                    <Field label={t('admin.editor.link')} hint={t('admin.editor.linkHint', { name: '{{link}}' })}>
                        <Input value={p.linkUrl ?? ''} maxLength={500} placeholder="https://" onChange={e => set('linkUrl', e.target.value || null)} />
                    </Field>
                    <ToggleRow title={t('admin.editor.showQr')} checked={p.showQr} onChange={v => set('showQr', v)} />

                    <p className={sectionCls}>{t('admin.editor.look')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label={t('admin.editor.template')}>
                            <Select value={p.templateId ?? ''} onChange={e => set('templateId', e.target.value ? Number(e.target.value) : null)}>
                                <option value="">{t('admin.pieces.noTemplate')}</option>
                                {templates.map(x => <option key={x.id} value={x.id}>{lang === 'en' && x.nameEn ? x.nameEn : x.nameEs}</option>)}
                            </Select>
                        </Field>
                        <Field label={t('admin.editor.zone')}>
                            <Select value={p.zone} onChange={e => set('zone', e.target.value)}>
                                {zones.map(z => <option key={z.key} value={z.key}>{lang === 'en' && z.nameEn ? z.nameEn : z.nameEs}</option>)}
                            </Select>
                        </Field>
                        <Field label={t('admin.editor.icon')}>
                            <Select value={p.icon ?? ''} onChange={e => set('icon', e.target.value || null)}>
                                <option value="">{t('admin.editor.noIcon')}</option>
                                {options.icons.filter(i => PROMO_ICONS[i]).map(i => <option key={i} value={i}>{i}</option>)}
                            </Select>
                        </Field>
                        <Field label={t('admin.editor.image')} hint={t('admin.editor.imageHint')}>
                            <Input value={p.imageUrl ?? ''} maxLength={500} onChange={e => set('imageUrl', e.target.value || null)} />
                        </Field>
                    </div>

                    <p className={sectionCls}>{t('admin.editor.rules')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label={t('admin.editor.priority')} hint={t('admin.editor.priorityHint')}><Input type="number" min={0} max={100} value={p.priority} onChange={num('priority')} /></Field>
                        <Field label={t('admin.editor.weight')} hint={t('admin.editor.weightHint')}><Input type="number" min={0} max={100} value={p.weight} onChange={num('weight')} /></Field>
                        <Field label={t('admin.editor.duration')} hint={t('admin.editor.durationHint')}><Input type="number" min={3} max={30} value={p.durationSeconds} onChange={num('durationSeconds')} /></Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label={t('admin.editor.startsAt')}><Input type="datetime-local" value={toLocalInput(p.startsAt)} onChange={e => set('startsAt', fromLocalInput(e.target.value))} /></Field>
                        <Field label={t('admin.editor.endsAt')} hint={t('admin.editor.datesHint')}><Input type="datetime-local" value={toLocalInput(p.endsAt)} onChange={e => set('endsAt', fromLocalInput(e.target.value))} /></Field>
                        <Field label={t('admin.editor.platforms')}>
                            <Select value={p.platforms} onChange={e => set('platforms', e.target.value as PromoPiece['platforms'])}>
                                {options.platforms.map(x => <option key={x} value={x}>{t(`admin.pieces.platforms.${x}`)}</option>)}
                            </Select>
                        </Field>
                        <Field label={t('admin.editor.status')}>
                            <Select value={p.status} onChange={e => set('status', e.target.value as PromoPiece['status'])}>
                                <option value="draft">{t('admin.pieces.status.draft')}</option>
                                <option value="published">{t('admin.pieces.status.published')}</option>
                            </Select>
                        </Field>
                    </div>
                    {p.kind !== 'emergency' && p.origin !== 'tercero' && <ToggleRow title={t('admin.editor.pinned')} description={t('admin.editor.pinnedHint')} checked={p.isPinned} onChange={v => set('isPinned', v)} />}
                    {p.origin === 'tercero' && (
                        <div className="space-y-4">
                            <p className={sectionCls}>{t('admin.editor.thirdPartySection')}</p>
                            <Alert tone="info">{t('admin.editor.thirdPartyHint')}</Alert>
                            <Field label={t('admin.editor.advertiserNote')} hint={t('admin.editor.advertiserNoteHint')}>
                                <Textarea value={p.advertiserNote ?? ''} maxLength={500} rows={3} onChange={e => set('advertiserNote', e.target.value || null)} />
                            </Field>
                        </div>
                    )}
                    <Field label={t('admin.editor.onlyChannels')} hint={t('admin.editor.onlyChannelsHint')}>
                        <Input value={p.onlyChannels ?? ''} maxLength={500} onChange={e => set('onlyChannels', e.target.value || null)} />
                    </Field>
                </div>

                <div className="min-w-0 lg:sticky lg:top-0 self-start">
                    <PreviewPane design={templateOf(p, templates)?.design ?? null} content={contentOf(p, lang)} vars={sampleVars(t, p.linkUrl)} zone={zonePlacement(p.zone, zones)} t={t} lang={lang} onLang={onLang} />
                </div>
            </div>
        </ModalShell>
    );
}
