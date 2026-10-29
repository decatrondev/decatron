import type { PromoDesign } from '../../../components/promo-overlay/types';
import type { ZonePlacement } from '../../../components/promo-overlay/PromoPreview';

export interface Piece {
    id: number; kind: string; titleEs: string; titleEn: string; bodyEs: string; bodyEn: string; zone: string; platforms: string;
    durationSeconds: number; priority: number; weight: number; startsAt: string | null; endsAt: string | null; templateId: number | null;
    linkUrl: string | null; showQr: boolean; imageUrl: string | null; icon: string | null; isPinned?: boolean;
    /** 'tercero' = publicidad de un anunciante (el canal solo la recibe si la aceptó). */
    origin?: string; advertiserName?: string | null;
}
export interface Template { id: number; zone: string; nameEs?: string; nameEn?: string; design: PromoDesign }
/** Nombre de la plantilla para listas; si el servidor no lo trae, «Plantilla N». */
export const templateLabel = (t: Template, lang: string, fallback: string) => (lang === 'en' ? t.nameEn : t.nameEs) || fallback;
/** ¿La plantilla tiene un hueco de imagen de la pieza? Sin él, la imagen de una tarjeta propia no se ve. */
export const hasPieceImage = (t: Template | undefined) => !!t && (t.design.elements ?? []).some(e => e.kind === 'image' && e.source === 'piece');
export interface Zone extends ZonePlacement { key: string; nameEs: string; nameEn: string }
export interface Limits {
    minGapSeconds: number; hourlyCapSeconds: number;
    minDurationSeconds: number; maxDurationSeconds: number; minScalePercent: number; maxScalePercent: number; maxZoneMargin: number; botPerOwn: number; ownMinIntervalMinutes: number; oneAtATime: boolean;
}
/** Tarjeta propia del streamer (solo texto). */
export interface OwnCard {
    id: number; title: string; body: string; icon: string | null; linkUrl: string | null; showQr: boolean; zone: string; templateId: number | null;
    durationSeconds: number; intervalMinutes: number; isEnabled: boolean; hiddenByAdmin: boolean; imageUrl: string | null;
}
/** Lo que el streamer cambió de una pieza; null = usa el valor del dueño. */
export interface PieceOv { durationSeconds: number | null; templateId: number | null; scalePercent: number | null }
/** Dónde puso el streamer una zona; si no hay entrada, usa la del dueño. */
export interface ZoneOv { anchor: ZonePlacement['anchor']; marginX: number; marginY: number }

export const emptyPieceOv: PieceOv = { durationSeconds: null, templateId: null, scalePercent: null };
export const isEmptyPieceOv = (o: PieceOv | undefined) => !o || (o.durationSeconds == null && o.templateId == null && o.scalePercent == null);

export interface PieceChange { piece: Piece; ov: PieceOv | undefined; set: (patch: Partial<PieceOv>) => void; reset: () => void }

/** Pieza fija con tarjetas propias en uso: el streamer no la puede apagar ni dejar por debajo de la duración y el tamaño del dueño. */
export const isPinnedLocked = (p: Piece, cards: OwnCard[]) => !!p.isPinned && cards.some(c => c.isEnabled && !c.hiddenByAdmin);

export const pieceTitle = (p: Piece, lang: string) => (lang === 'en' && p.titleEn) || p.titleEs || p.bodyEs;
