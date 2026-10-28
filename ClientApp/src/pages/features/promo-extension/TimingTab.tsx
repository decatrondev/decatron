import { useTranslation } from 'react-i18next';
import { Card, NumberInput } from '../../../components/overlay-editor/ui';
import { isPinnedLocked, pieceTitle, type Limits, type OwnCard, type Piece, type PieceOv } from './types';

/** Pestaña «Tiempos»: cuántos segundos queda cada pieza en pantalla, dentro del rango que fija el dueño. */
export function TimingTab({ pieces, cards, limits, overrides, lang, onChange }: {
    pieces: Piece[]; cards: OwnCard[]; limits: Limits; overrides: Record<number, PieceOv>; lang: string;
    onChange: (id: number, patch: Partial<PieceOv>) => void;
}) {
    const { t } = useTranslation('promo');
    return (
        <Card title={t('panel.timing.title')} description={t('panel.timing.description', { min: limits.minDurationSeconds, max: limits.maxDurationSeconds })}>
            <div className="space-y-4">
                {pieces.map(p => {
                    const ov = overrides[p.id];
                    const mineSet = ov?.durationSeconds != null;
                    const floor = isPinnedLocked(p, cards) ? p.durationSeconds : limits.minDurationSeconds;
                    return (
                        <div key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-ds-border bg-ds-raised/40 p-3">
                            <div className="min-w-0 flex-1 basis-56">
                                <h4 className="font-bold text-ds-text text-sm 3xl:text-base truncate">{pieceTitle(p, lang)}</h4>
                                <p className="text-xs 3xl:text-sm text-ds-soft">{floor > limits.minDurationSeconds ? t('panel.timing.pinned', { n: p.durationSeconds }) : mineSet ? t('panel.timing.custom', { n: p.durationSeconds }) : t('panel.timing.default')}</p>
                            </div>
                            <div className="w-40"><NumberInput value={Math.max(floor, ov?.durationSeconds ?? p.durationSeconds)} min={floor} max={limits.maxDurationSeconds}
                                onChange={v => onChange(p.id, { durationSeconds: v === p.durationSeconds ? null : v })} /></div>
                            <span className="text-xs 3xl:text-sm text-ds-soft w-16">{t('panel.timing.unit')}</span>
                            <button className="ds-btn ds-btn--secondary ds-btn--sm" disabled={!mineSet} onClick={() => onChange(p.id, { durationSeconds: null })}>{t('panel.reset')}</button>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
