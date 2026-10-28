import type { PromoDesign } from '../../../components/promo-overlay/types';
import type { ZonePlacement } from '../../../components/promo-overlay/PromoPreview';

export interface Piece {
    id: number; kind: string; titleEs: string; titleEn: string; bodyEs: string; bodyEn: string; zone: string; platforms: string;
    durationSeconds: number; priority: number; weight: number; startsAt: string | null; endsAt: string | null; templateId: number | null;
    linkUrl: string | null; showQr: boolean; imageUrl: string | null; icon: string | null;
}
export interface Template { id: number; zone: string; design: PromoDesign }
export interface Zone extends ZonePlacement { key: string; nameEs: string; nameEn: string }
export interface Limits {
    minGapSeconds: number; hourlyCapSeconds: number;
    minDurationSeconds: number; maxDurationSeconds: number; minScalePercent: number; maxScalePercent: number; maxZoneMargin: number; botPerOwn: number; ownMinIntervalMinutes: number;
}
/** Tarjeta propia del streamer (solo texto). */
export interface OwnCard {
    id: number; title: string; body: string; icon: string | null; linkUrl: string | null; showQr: boolean; zone: string; templateId: number | null;
    durationSeconds: number; intervalMinutes: number; isEnabled: boolean; hiddenByAdmin: boolean;
}
/** Lo que el streamer cambió de una pieza; null = usa el valor del dueño. */
export interface PieceOv { durationSeconds: number | null; templateId: number | null; scalePercent: number | null }
/** Dónde puso el streamer una zona; si no hay entrada, usa la del dueño. */
export interface ZoneOv { anchor: ZonePlacement['anchor']; marginX: number; marginY: number }

export const emptyPieceOv: PieceOv = { durationSeconds: null, templateId: null, scalePercent: null };
export const isEmptyPieceOv = (o: PieceOv | undefined) => !o || (o.durationSeconds == null && o.templateId == null && o.scalePercent == null);

export interface PieceChange { piece: Piece; ov: PieceOv | undefined; set: (patch: Partial<PieceOv>) => void; reset: () => void }

export const pieceTitle = (p: Piece, lang: string) => (lang === 'en' && p.titleEn) || p.titleEs || p.bodyEs;
