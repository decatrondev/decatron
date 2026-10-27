import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, Select } from '../../../components/ds';
import { ToggleRow } from '../../../components/dashboard/config';
import ModalShell from '../../../components/dashboard/ModalShell';
import { STAGE, placeInZone } from '../../../components/promo-overlay/PromoPreview';
import { errorCodes, promoAdminApi } from './api';
import { errorText, type Lang } from './shared';
import { EMPTY_ZONE, type PromoOverview, type PromoZone } from './types';

/** Un lienzo diminuto que marca dónde cae una zona (una ficha de 420×130 de ejemplo). */
function Mini({ zone }: { zone: PromoZone }) {
    const p = placeInZone(zone, 420, 130);
    return (
        <div className="relative w-full shrink-0 rounded-md border border-ds-border bg-ds-bg" style={{ aspectRatio: '16 / 9', maxWidth: 220 }}>
            <div className="absolute rounded-sm bg-ds-accent/70" style={{ left: `${(p.x / STAGE.width) * 100}%`, top: `${(p.y / STAGE.height) * 100}%`, width: `${(420 / STAGE.width) * 100}%`, height: `${(130 / STAGE.height) * 100}%` }} />
        </div>
    );
}

export function ZonesTab({ data, lang, onChanged, notify }: { data: PromoOverview; lang: Lang; onChanged: () => Promise<void>; notify: (ok: boolean, text: string) => void }) {
    const { t } = useTranslation('promo');
    const [editing, setEditing] = useState<PromoZone | null>(null);
    const [deleting, setDeleting] = useState<PromoZone | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        if (!editing) return;
        setSaving(true); setError(null);
        try { await promoAdminApi.upsertZone(editing); setEditing(null); await onChanged(); notify(true, t('admin.toast.saved')); }
        catch (e) { setError(errorText(t, errorCodes(e))); }
        finally { setSaving(false); }
    };
    const remove = async () => {
        if (!deleting) return;
        const d = deleting; setDeleting(null);
        try { await promoAdminApi.deleteZone(d.id); await onChanged(); notify(true, t('admin.toast.deleted')); }
        catch (e) { notify(false, errorText(t, errorCodes(e))); }
    };
    const set = <K extends keyof PromoZone>(k: K, v: PromoZone[K]) => setEditing(p => (p ? { ...p, [k]: v } : p));

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ds-soft max-w-2xl">{t('admin.zones.hint')}</p>
                <Button icon={<Plus />} onClick={() => { setError(null); setEditing({ ...EMPTY_ZONE, sortOrder: data.zones.length }); }}>{t('admin.zones.new')}</Button>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {data.zones.map(row => {
                    const z = row.zone;
                    return (
                        <Card key={z.id}>
                            <div className="p-4 flex flex-col sm:flex-row gap-4">
                                <Mini zone={z} />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <MapPin className="w-4 h-4 text-ds-accent-text" />
                                        <span className="font-bold text-ds-text">{lang === 'en' && z.nameEn ? z.nameEn : z.nameEs}</span>
                                        <Badge tone={z.isEnabled ? 'ok' : undefined}>{t(z.isEnabled ? 'admin.templates.enabled' : 'admin.templates.disabled')}</Badge>
                                        <code className="text-xs text-ds-faint">{z.key}</code>
                                    </div>
                                    <p className="text-xs text-ds-soft">{t(`admin.zones.anchors.${z.anchor}`)} · {t('admin.zones.margins', { x: z.marginX, y: z.marginY })}<br />{t('admin.zones.usedBy', { pieces: row.pieceCount, templates: row.templateCount })}</p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => { setError(null); setEditing(z); }}>{t('admin.templates.edit')}</Button>
                                        <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setDeleting(z)}>{t('admin.templates.delete')}</Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {editing && (
                <ModalShell title={t(editing.id ? 'admin.zones.titleEdit' : 'admin.zones.titleNew')} size="lg" onClose={() => setEditing(null)}
                    actions={<>
                        <Button variant="secondary" onClick={() => setEditing(null)}>{t('admin.editor.cancel')}</Button>
                        <Button loading={saving} onClick={save}>{t('admin.editor.save')}</Button>
                    </>}>
                    <div className="space-y-4">
                        {error && <Alert tone="danger">{error}</Alert>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={t('admin.templates.key')} hint={t('admin.templates.keyHint')}><Input value={editing.key} maxLength={40} disabled={editing.id > 0} onChange={e => set('key', e.target.value)} /></Field>
                            <span />
                            <Field label={t('admin.templates.nameEs')}><Input value={editing.nameEs} maxLength={80} onChange={e => set('nameEs', e.target.value)} /></Field>
                            <Field label={t('admin.templates.nameEn')}><Input value={editing.nameEn} maxLength={80} onChange={e => set('nameEn', e.target.value)} /></Field>
                            <Field label={t('admin.zones.anchor')}>
                                <Select value={editing.anchor} onChange={e => set('anchor', e.target.value as PromoZone['anchor'])}>
                                    {data.options.anchors.map(a => <option key={a} value={a}>{t(`admin.zones.anchors.${a}`)}</option>)}
                                </Select>
                            </Field>
                            <span />
                            <Field label={t('admin.zones.marginX')}><Input type="number" min={0} max={1000} value={editing.marginX} onChange={e => set('marginX', Number(e.target.value) || 0)} /></Field>
                            <Field label={t('admin.zones.marginY')}><Input type="number" min={0} max={1000} value={editing.marginY} onChange={e => set('marginY', Number(e.target.value) || 0)} /></Field>
                        </div>
                        <Mini zone={editing} />
                        <ToggleRow title={t('admin.templates.enabled')} checked={editing.isEnabled} onChange={v => set('isEnabled', v)} />
                    </div>
                </ModalShell>
            )}

            {deleting && (
                <ModalShell title={t('admin.zones.deleteTitle')} onClose={() => setDeleting(null)}
                    actions={<>
                        <Button variant="secondary" onClick={() => setDeleting(null)}>{t('admin.editor.cancel')}</Button>
                        <Button variant="danger" onClick={remove}>{t('admin.templates.delete')}</Button>
                    </>}>
                    <p className="text-sm text-ds-soft">{t('admin.zones.deleteBody', { name: deleting.nameEs })}</p>
                </ModalShell>
            )}
        </div>
    );
}
