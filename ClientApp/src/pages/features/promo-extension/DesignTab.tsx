import { useTranslation } from 'react-i18next';
import { Card, Field, Select, Slider } from '../../../components/overlay-editor/ui';
import { PromoStage } from '../../../components/promo-overlay/PromoPreview';
import { useBrand } from '../../../brand/BrandContext';
import type { PromoContent } from '../../../components/promo-overlay/types';
import { pieceTitle, type Limits, type Piece, type PieceOv, type Template, type Zone } from './types';

/** Pestaña «Diseño»: qué plantilla usa cada pieza (entre las de su zona) y a qué tamaño sale, dentro de los límites del dueño. */
export function DesignTab({ pieces, templates, zones, limits, overrides, lang, channel, onChange }: {
    pieces: Piece[]; templates: Template[]; zones: Zone[]; limits: Limits; overrides: Record<number, PieceOv>; lang: string; channel: string;
    onChange: (id: number, patch: Partial<PieceOv>) => void;
}) {
    const { t } = useTranslation('promo');
    const { resolve } = useBrand();
    return (
        <Card title={t('panel.design.title')} description={t('panel.design.description', { min: limits.minScalePercent, max: limits.maxScalePercent })}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {pieces.map(p => {
                    const ov = overrides[p.id];
                    const options = templates.filter(x => x.zone === p.zone);
                    const tplId = ov?.templateId ?? p.templateId ?? options[0]?.id;
                    const tpl = templates.find(x => x.id === tplId) ?? options[0];
                    const scale = ov?.scalePercent ?? 100;
                    const zone = zones.find(z => z.key === p.zone);
                    const content: PromoContent = {
                        title: (lang === 'en' && p.titleEn) || p.titleEs, body: (lang === 'en' && p.bodyEn) || p.bodyEs,
                        link: p.linkUrl, imageUrl: p.imageUrl, icon: p.icon, showQr: p.showQr,
                    };
                    const nameOf = (_x: Template, i: number) => t('panel.design.templateN', { n: i + 1 });
                    return (
                        <div key={p.id} className="rounded-lg border border-ds-border bg-ds-raised/40 p-3 space-y-3 min-w-0">
                            <h4 className="font-bold text-ds-text text-sm 3xl:text-base truncate">{pieceTitle(p, lang)}</h4>
                            {tpl && zone && <PromoStage design={tpl.design} content={content} zone={zone} pieceScale={scale / 100} resolveImage={resolve}
                                vars={{ channel, commands: '!title · !game', link: (p.linkUrl || 'https://decatron.net').replace(/^https:\/\//, '') }} />}
                            {options.length > 1 && (
                                <Field label={t('panel.design.template')}>
                                    <div className="flex gap-2">
                                        <div className="flex-1"><Select value={String(tplId ?? '')} onChange={v => onChange(p.id, { templateId: Number(v) === p.templateId ? null : Number(v) })}
                                            options={options.map((x, i) => ({ value: String(x.id), label: nameOf(x, i) }))} /></div>
                                        <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={ov?.templateId == null} onClick={() => onChange(p.id, { templateId: null })}>{t('panel.reset')}</button>
                                    </div>
                                </Field>
                            )}
                            <Field label={t('panel.design.scale')}>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1"><Slider value={scale} min={limits.minScalePercent} max={limits.maxScalePercent} step={5} suffix="%"
                                        onChange={v => onChange(p.id, { scalePercent: v === 100 ? null : v })} /></div>
                                    <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={ov?.scalePercent == null} onClick={() => onChange(p.id, { scalePercent: null })}>{t('panel.reset')}</button>
                                </div>
                            </Field>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
