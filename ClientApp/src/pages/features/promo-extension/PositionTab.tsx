import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Field, NumberInput, Select } from '../../../components/overlay-editor/ui';
import PromoDesignRenderer from '../../../components/promo-overlay/PromoDesignRenderer';
import { STAGE, placeInZone, type ZonePlacement } from '../../../components/promo-overlay/PromoPreview';
import { useBrand } from '../../../brand/BrandContext';
import type { PromoContent } from '../../../components/promo-overlay/types';
import type { Limits, Piece, Template, Zone, ZoneOv } from './types';

type Anchor = ZonePlacement['anchor'];
const ANCHORS: Anchor[] = ['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];

/** Del punto donde quedó la esquina de la ficha, el ancla más cercana (rejilla de 3×3) y los márgenes respecto a ese borde, recortados al máximo del dueño. */
export function placementFromDrag(x: number, y: number, w: number, h: number, maxMargin: number): ZonePlacement {
    const cx = x + w / 2, cy = y + h / 2;
    const col = cx < STAGE.width / 3 ? 'left' : cx > (STAGE.width * 2) / 3 ? 'right' : 'center';
    const row = cy < STAGE.height / 3 ? 'top' : cy > (STAGE.height * 2) / 3 ? 'bottom' : 'middle';
    const anchor = (row === 'middle' && col === 'center' ? 'center' : `${row}-${col}`) as Anchor;
    const clamp = (n: number) => Math.round(Math.min(maxMargin, Math.max(0, n)));
    const marginX = col === 'left' ? x : col === 'right' ? STAGE.width - x - w : 0;
    const marginY = row === 'top' ? y : row === 'bottom' ? STAGE.height - y - h : 0;
    return { anchor, marginX: clamp(marginX), marginY: clamp(marginY) };
}

/** Pestaña «Posición»: cada zona se arrastra sobre el lienzo de 1920×1080 (o se ajusta con números), sin pasar del margen máximo del dueño. */
export function PositionTab({ zones, defaults, overrides, pieces, templates, limits, lang, channel, onChange, onReset }: {
    zones: Zone[]; defaults: Zone[]; overrides: Record<string, ZoneOv>; pieces: Piece[]; templates: Template[]; limits: Limits; lang: string; channel: string;
    onChange: (key: string, v: ZoneOv) => void; onReset: (key: string) => void;
}) {
    const { t } = useTranslation('promo');
    const { resolve } = useBrand();
    const box = useRef<HTMLDivElement>(null);
    const [fit, setFit] = useState(0.5);
    const [drag, setDrag] = useState<{ key: string; dx: number; dy: number } | null>(null);

    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setFit(el.clientWidth / STAGE.width));
        ro.observe(el);
        setFit(el.clientWidth / STAGE.width);
        return () => ro.disconnect();
    }, []);

    // La ficha de muestra de cada zona: la primera pieza que sale ahí con su plantilla.
    const sampleOf = useCallback((zoneKey: string) => {
        const p = pieces.find(x => x.zone === zoneKey);
        const tpl = (p && templates.find(x => x.id === p.templateId)) ?? templates.find(x => x.zone === zoneKey);
        if (!tpl) return null;
        const content: PromoContent = p
            ? { title: (lang === 'en' && p.titleEn) || p.titleEs, body: (lang === 'en' && p.bodyEn) || p.bodyEs, link: p.linkUrl, imageUrl: p.imageUrl, icon: p.icon, showQr: p.showQr }
            : { title: '', body: '', link: null, imageUrl: null, icon: null, showQr: false };
        return { tpl, content };
    }, [pieces, templates, lang]);

    const onDown = (e: React.PointerEvent, z: Zone, w: number, h: number) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const pos = placeInZone(z, w, h);
        const rect = box.current!.getBoundingClientRect();
        setDrag({ key: z.key, dx: (e.clientX - rect.left) / fit - pos.x, dy: (e.clientY - rect.top) / fit - pos.y });
    };
    const onMove = (e: React.PointerEvent, z: Zone, w: number, h: number) => {
        if (!drag || drag.key !== z.key) return;
        const rect = box.current!.getBoundingClientRect();
        const x = Math.min(STAGE.width - w, Math.max(0, (e.clientX - rect.left) / fit - drag.dx));
        const y = Math.min(STAGE.height - h, Math.max(0, (e.clientY - rect.top) / fit - drag.dy));
        onChange(z.key, placementFromDrag(x, y, w, h, limits.maxZoneMargin));
    };

    return (
        <Card title={t('panel.position.title')} description={t('panel.position.description', { max: limits.maxZoneMargin })}>
            <div className="space-y-6">
                <div ref={box} style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 10, border: '1px solid var(--ds-border)', background: 'radial-gradient(120% 120% at 30% 20%, var(--ds-raised), var(--ds-bg))', touchAction: 'none' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, width: STAGE.width, height: STAGE.height, transform: `scale(${fit})`, transformOrigin: 'top left' }}>
                        {zones.map(z => {
                            const s = sampleOf(z.key);
                            if (!s) return null;
                            const { width: w, height: h } = s.tpl.design.canvas;
                            const pos = placeInZone(z, w, h);
                            return (
                                <div key={z.key} onPointerDown={e => onDown(e, z, w, h)} onPointerMove={e => onMove(e, z, w, h)} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}
                                    style={{ position: 'absolute', left: pos.x, top: pos.y, width: w, height: h, cursor: drag?.key === z.key ? 'grabbing' : 'grab', outline: '3px dashed var(--ds-accent)', outlineOffset: 4, borderRadius: 6 }}>
                                    <div style={{ pointerEvents: 'none' }}>
                                        <PromoDesignRenderer design={s.tpl.design} content={s.content} resolveImage={resolve} vars={{ channel, commands: '!title · !game', link: 'decatron.net' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {zones.map(z => {
                        const def = defaults.find(d => d.key === z.key) ?? z;
                        const mine = !!overrides[z.key];
                        const set = (patch: Partial<ZoneOv>) => onChange(z.key, { anchor: z.anchor, marginX: z.marginX, marginY: z.marginY, ...patch });
                        return (
                            <div key={z.key} className="rounded-lg border border-ds-border bg-ds-raised/40 p-3 space-y-3 min-w-0">
                                <div className="flex items-center gap-3">
                                    <h4 className="font-bold text-ds-text text-sm 3xl:text-base flex-1 truncate">{(lang === 'en' ? z.nameEn : z.nameEs) || z.key}</h4>
                                    <span className="text-xs 3xl:text-sm text-ds-soft">{mine ? t('panel.position.custom') : t('panel.position.default')}</span>
                                    <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={!mine} onClick={() => onReset(z.key)}>{t('panel.reset')}</button>
                                </div>
                                <Field label={t('panel.position.anchor')}>
                                    <Select value={z.anchor} onChange={v => set({ anchor: v })} options={ANCHORS.map(a => ({ value: a, label: t(`panel.position.anchors.${a}`) }))} />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label={t('panel.position.marginX')}><NumberInput value={z.marginX} min={0} max={limits.maxZoneMargin} step={10} onChange={v => set({ marginX: v })} /></Field>
                                    <Field label={t('panel.position.marginY')}><NumberInput value={z.marginY} min={0} max={limits.maxZoneMargin} step={10} onChange={v => set({ marginY: v })} /></Field>
                                </div>
                                {mine && <p className="text-xs 3xl:text-sm text-ds-soft">{t('panel.position.ownerHas', { x: def.marginX, y: def.marginY })}</p>}
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}
