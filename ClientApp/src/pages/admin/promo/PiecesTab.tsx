import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Eye, EyeOff, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Empty } from '../../../components/ds';
import { PromoZoom } from '../../../components/promo-overlay/PromoPreview';
import ModalShell from '../../../components/dashboard/ModalShell';
import { errorCodes, promoAdminApi } from './api';
import { PieceEditor } from './PieceEditor';
import { contentOf, errorText, sampleVars, templateOf, useResolveImage, type Lang } from './shared';
import { EMPTY_PIECE, type PromoOverview, type PromoPiece, type PromoZone } from './types';

function zoneName(zones: PromoZone[], key: string, lang: Lang) {
    const z = zones.find(x => x.key === key);
    return z ? (lang === 'en' && z.nameEn ? z.nameEn : z.nameEs) : key;
}

export function PiecesTab({ data, lang, onLang, onChanged, notify }: {
    data: PromoOverview; lang: Lang; onLang: (l: Lang) => void; onChanged: () => Promise<void>; notify: (ok: boolean, text: string) => void;
}) {
    const { t, i18n } = useTranslation('promo');
    const [editing, setEditing] = useState<PromoPiece | null>(null);
    const [deleting, setDeleting] = useState<PromoPiece | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const templates = data.templates.map(x => x.template);
    const zones = data.zones.map(x => x.zone);
    const resolveImage = useResolveImage();
    const fmt = (iso: string) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

    const run = async (id: number, okKey: string, fn: () => Promise<unknown>) => {
        setBusy(id);
        try { await fn(); await onChanged(); notify(true, t(okKey)); }
        catch (e) { notify(false, errorText(t, errorCodes(e))); }
        finally { setBusy(null); }
    };

    const windowText = (p: PromoPiece) =>
        p.startsAt && p.endsAt ? t('admin.pieces.window', { from: fmt(p.startsAt), to: fmt(p.endsAt) })
            : p.startsAt ? t('admin.pieces.windowFrom', { from: fmt(p.startsAt) })
            : p.endsAt ? t('admin.pieces.windowTo', { to: fmt(p.endsAt) })
            : t('admin.pieces.noWindow');

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button icon={<Plus />} onClick={() => setEditing({ ...EMPTY_PIECE, sortOrder: data.pieces.length })}>{t('admin.pieces.new')}</Button>
            </div>

            {data.pieces.length === 0 && (
                <Empty icon={<Megaphone />} title={t('admin.pieces.emptyTitle')}>{t('admin.pieces.emptyHint')}</Empty>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {data.pieces.map(p => {
                    const title = (lang === 'en' && p.titleEn) || p.titleEs || p.bodyEs || t('admin.pieces.untitled');
                    const tpl = templates.find(x => x.id === p.templateId);
                    return (
                        <Card key={p.id}>
                            <div className="p-4 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone={p.status === 'published' ? 'ok' : undefined}>{t(`admin.pieces.status.${p.status}`)}</Badge>
                                    <Badge tone={p.kind === 'emergency' ? 'danger' : 'accent'}>{t(`admin.pieces.kind.${p.kind}`)}</Badge>
                                    {p.origin === 'tercero' && <Badge tone="warn">{t('admin.pieces.origin.tercero')}</Badge>}
                                    <span className="text-sm font-bold text-ds-text truncate min-w-0">{title}</span>
                                </div>
                                {templateOf(p, templates)?.design?.elements ? <PromoZoom design={templateOf(p, templates)!.design} content={contentOf(p, lang)} vars={sampleVars(t, p.linkUrl)} resolveImage={resolveImage} phase="enter" /> : <p className="text-sm text-ds-soft">{t('admin.pieces.noTemplate')}</p>}
                                <p className="text-xs text-ds-soft">
                                    {zoneName(zones, p.zone, lang)} · {t(`admin.pieces.platforms.${p.platforms}`)} · {tpl ? (lang === 'en' && tpl.nameEn ? tpl.nameEn : tpl.nameEs) : t('admin.pieces.noTemplate')}
                                    <br />{t('admin.pieces.views', { d7: data.views?.[p.id]?.last7 ?? 0, d30: data.views?.[p.id]?.last30 ?? 0, total: data.views?.[p.id]?.total ?? 0 })}                                    <br />{windowText(p)} · {p.onlyChannels ? t('admin.pieces.onlyChannels', { list: p.onlyChannels.split(',').join(', ') }) : t('admin.pieces.allChannels')}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => setEditing(p)}>{t('admin.pieces.edit')}</Button>
                                    <Button size="sm" variant="secondary" icon={<Copy />} loading={busy === p.id} onClick={() => run(p.id, 'admin.toast.duplicated', () => promoAdminApi.duplicatePiece(p.id))}>{t('admin.pieces.duplicate')}</Button>
                                    {p.status === 'published'
                                        ? <Button size="sm" variant="secondary" icon={<EyeOff />} loading={busy === p.id} onClick={() => run(p.id, 'admin.toast.drafted', () => promoAdminApi.setStatus(p.id, 'draft'))}>{t('admin.pieces.unpublish')}</Button>
                                        : <Button size="sm" icon={<Eye />} loading={busy === p.id} onClick={() => run(p.id, 'admin.toast.published', () => promoAdminApi.setStatus(p.id, 'published'))}>{t('admin.pieces.publish')}</Button>}
                                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setDeleting(p)}>{t('admin.pieces.delete')}</Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {editing && (
                <PieceEditor initial={editing} templates={templates} zones={zones} options={data.options} lang={lang} onLang={onLang}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await onChanged(); notify(true, t('admin.toast.saved')); }} />
            )}

            {deleting && (
                <ModalShell title={t('admin.pieces.deleteTitle')} onClose={() => setDeleting(null)}
                    actions={<>
                        <Button variant="secondary" onClick={() => setDeleting(null)}>{t('admin.editor.cancel')}</Button>
                        <Button variant="danger" onClick={async () => { const d = deleting; setDeleting(null); await run(d.id, 'admin.toast.deleted', () => promoAdminApi.deletePiece(d.id)); }}>{t('admin.pieces.delete')}</Button>
                    </>}>
                    <p className="text-sm text-ds-soft">{t('admin.pieces.deleteBody', { name: deleting.titleEs || deleting.bodyEs || t('admin.pieces.untitled') })}</p>
                </ModalShell>
            )}
        </div>
    );
}
