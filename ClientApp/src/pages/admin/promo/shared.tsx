import { useState } from 'react';
import type { TFunction } from 'i18next';
import { RefreshCw } from 'lucide-react';
import { Button, Segmented } from '../../../components/ds';
import { useBrand } from '../../../brand/BrandContext';
import { PromoStage, PromoZoom, type ZonePlacement } from '../../../components/promo-overlay/PromoPreview';
import type { PromoContent, PromoDesign, PromoVars } from '../../../components/promo-overlay/types';
import type { PromoPiece, PromoTemplate, PromoZone } from './types';

export type Lang = 'es' | 'en';

/** Textos de error del servidor (códigos) ya traducidos; un código desconocido cae en el mensaje genérico. */
export function errorText(t: TFunction, codes: string[]): string {
    return codes.map(c => t(`admin.errors.${c}`, { name: '{{link}}', defaultValue: t('admin.errors.unknown') })).join(' ');
}

export const FALLBACK_ZONE: ZonePlacement = { anchor: 'top-right', marginX: 96, marginY: 54 };

export function zonePlacement(key: string, zones: PromoZone[]): ZonePlacement {
    return zones.find(z => z.key === key) ?? FALLBACK_ZONE;
}

/** La plantilla de una pieza: la elegida, o la primera activa. */
export function templateOf(piece: Pick<PromoPiece, 'templateId'>, templates: PromoTemplate[]): PromoTemplate | undefined {
    return templates.find(x => x.id === piece.templateId) ?? templates.find(x => x.isEnabled && x.design?.elements);
}

export function contentOf(p: Pick<PromoPiece, 'titleEs' | 'titleEn' | 'bodyEs' | 'bodyEn' | 'linkUrl' | 'showQr' | 'imageUrl' | 'icon'>, lang: Lang): PromoContent {
    const en = lang === 'en';
    return { title: (en && p.titleEn) || p.titleEs, body: (en && p.bodyEn) || p.bodyEs, link: p.linkUrl, imageUrl: p.imageUrl, icon: p.icon, showQr: p.showQr };
}

export function sampleVars(t: TFunction, linkUrl?: string | null): PromoVars {
    return {
        channel: t('admin.preview.sampleChannel'),
        commands: t('admin.preview.sampleCommands'),
        link: linkUrl ? linkUrl.replace(/^https:\/\//, '') : t('admin.preview.sampleLink'),
    };
}

/** Datos de ejemplo para ver una plantilla sin pieza. */
export function sampleContent(t: TFunction): PromoContent {
    return { title: t('admin.preview.sampleTitle'), body: t('admin.preview.sampleBody'), link: 'https://decatron.net', imageUrl: null, icon: 'megaphone', showQr: true };
}

/** El resolvedor de imágenes de la biblioteca de /admin/brand (el mismo que usa el sitio). */
export function useResolveImage() {
    const { resolve } = useBrand();
    return resolve;
}

/** Vista previa con cambio de idioma y botón para repetir la animación: la ficha ampliada y el lienzo completo. */
export function PreviewPane({ design, content, vars, zone, t, lang, onLang }: {
    design: PromoDesign | null; content: PromoContent; vars: PromoVars; zone: ZonePlacement; t: TFunction; lang: Lang; onLang: (l: Lang) => void;
}) {
    const [run, setRun] = useState(0);
    const resolveImage = useResolveImage();
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-soft">{t('admin.preview.title')} <span className="normal-case font-normal text-ds-faint">· {t('admin.preview.note')}</span></p>
                <div className="flex items-center gap-2">
                    <Segmented items={[{ id: 'es', label: 'ES' }, { id: 'en', label: 'EN' }]} value={lang} onChange={id => onLang(id as Lang)} />
                    <Button variant="ghost" size="sm" icon={<RefreshCw />} aria-label={t('admin.preview.replay')} title={t('admin.preview.replay')} onClick={() => setRun(r => r + 1)} />
                </div>
            </div>
            {design && design.elements ? (
                <>
                    <PromoZoom key={`z${run}`} design={design} content={content} vars={vars} resolveImage={resolveImage} phase="enter" />
                    <PromoStage key={`s${run}`} design={design} content={content} vars={vars} resolveImage={resolveImage} zone={zone} phase="enter" />
                    <p className="text-xs text-ds-faint">{t('admin.preview.stageNote')}</p>
                </>
            ) : <p className="text-sm text-ds-soft">{t('admin.pieces.noTemplate')}</p>}
        </div>
    );
}

/** ISO (UTC) → valor de <input type="datetime-local"> en hora local. */
export function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO UTC (o null si está vacío). */
export function fromLocalInput(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
}
