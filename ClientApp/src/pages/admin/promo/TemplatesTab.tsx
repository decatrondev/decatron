import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Empty } from '../../../components/ds';
import ModalShell from '../../../components/dashboard/ModalShell';
import { PromoZoom } from '../../../components/promo-overlay/PromoPreview';
import { starterDesign } from '../../../components/promo-overlay/defaults';
import { errorCodes, promoAdminApi } from './api';
import { TemplateEditor } from './TemplateEditor';
import { errorText, sampleContent, sampleVars, useResolveImage, type Lang } from './shared';
import type { PromoOverview, PromoTemplate } from './types';

export function TemplatesTab({ data, lang, onLang, onChanged, notify }: {
    data: PromoOverview; lang: Lang; onLang: (l: Lang) => void; onChanged: () => Promise<void>; notify: (ok: boolean, text: string) => void;
}) {
    const { t, i18n } = useTranslation('promo');
    const [editing, setEditing] = useState<PromoTemplate | null>(null);
    const [deleting, setDeleting] = useState<{ template: PromoTemplate; pieceCount: number } | null>(null);
    const resolveImage = useResolveImage();
    const zones = data.zones.map(z => z.zone);
    const tl = i18n.getFixedT(lang, 'promo');

    if (editing) {
        return (
            <TemplateEditor key={editing.id || 'new'} initial={editing} zones={zones} options={data.options} lang={lang} onLang={onLang}
                onBack={() => setEditing(null)}
                onSaved={async () => { setEditing(null); await onChanged(); notify(true, t('admin.toast.saved')); }} />
        );
    }

    const create = (kind: 'corner' | 'banner') => {
        const zone = zones.find(z => z.key === kind) ?? zones[0];
        setEditing({ id: 0, key: '', nameEs: '', nameEn: '', zone: zone?.key ?? 'corner', isEnabled: true, sortOrder: data.templates.length, design: starterDesign(kind) });
    };
    const copyOf = (x: PromoTemplate): PromoTemplate => ({ ...x, id: 0, key: `${x.key}-2`.slice(0, 40), nameEs: `${x.nameEs} (copia)`.slice(0, 80), nameEn: x.nameEn ? `${x.nameEn} (copy)`.slice(0, 80) : '', sortOrder: data.templates.length });
    const remove = async () => {
        if (!deleting) return;
        const d = deleting; setDeleting(null);
        try { await promoAdminApi.deleteTemplate(d.template.id); await onChanged(); notify(true, t('admin.toast.deleted')); }
        catch (e) { notify(false, errorText(t, errorCodes(e))); }
    };

    const content = sampleContent(tl);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ds-soft max-w-2xl">{t('admin.templates.hint')}</p>
                <div className="flex gap-2">
                    <Button icon={<Plus />} onClick={() => create('corner')}>{t('admin.templates.newCard')}</Button>
                    <Button variant="secondary" icon={<Plus />} onClick={() => create('banner')}>{t('admin.templates.newBanner')}</Button>
                </div>
            </div>

            {data.templates.length === 0 && <Empty icon={<LayoutTemplate />} title={t('admin.templates.emptyTitle')}>{t('admin.templates.emptyHint')}</Empty>}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {data.templates.map(row => {
                    const x = row.template;
                    const zone = zones.find(z => z.key === x.zone);
                    return (
                        <Card key={x.id}>
                            <div className="p-4 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <LayoutTemplate className="w-4 h-4 text-ds-accent-text" />
                                    <span className="font-bold text-ds-text">{lang === 'en' && x.nameEn ? x.nameEn : x.nameEs}</span>
                                    <Badge tone={x.isEnabled ? 'ok' : undefined}>{t(x.isEnabled ? 'admin.templates.enabled' : 'admin.templates.disabled')}</Badge>
                                    <code className="text-xs text-ds-faint">{x.key}</code>
                                </div>
                                {x.design?.elements?.length
                                    ? <PromoZoom design={x.design} content={content} vars={sampleVars(tl, content.link)} resolveImage={resolveImage} phase="enter" />
                                    : <p className="text-sm text-ds-soft">{t('admin.templates.noDesign')}</p>}
                                <p className="text-xs text-ds-soft">
                                    {zone ? (lang === 'en' && zone.nameEn ? zone.nameEn : zone.nameEs) : x.zone} · {x.design?.canvas ? `${x.design.canvas.width}×${x.design.canvas.height}` : ''} · {t('admin.templates.usedBy', { count: row.pieceCount })}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => setEditing(x)}>{t('admin.templates.edit')}</Button>
                                    <Button size="sm" variant="secondary" icon={<Copy />} onClick={() => setEditing(copyOf(x))}>{t('admin.templates.duplicate')}</Button>
                                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setDeleting(row)}>{t('admin.templates.delete')}</Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {deleting && (
                <ModalShell title={t('admin.templates.deleteTitle')} onClose={() => setDeleting(null)}
                    actions={<>
                        <Button variant="secondary" onClick={() => setDeleting(null)}>{t('admin.editor.cancel')}</Button>
                        <Button variant="danger" onClick={remove}>{t('admin.templates.delete')}</Button>
                    </>}>
                    <p className="text-sm text-ds-soft">{t('admin.templates.deleteBody', { name: deleting.template.nameEs })}</p>
                </ModalShell>
            )}
        </div>
    );
}
