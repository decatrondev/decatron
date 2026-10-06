import { Plus } from 'lucide-react';
import type { TierLimits } from '../hooks/useChannelResources';
import { emptySegment, type Segment, type SoundAlertOption, type WheelSummary } from '../model';
import { SegmentRow } from '../tabs/SegmentRow';

/** La lista de gajos: agregar, editar, ordenar y quitar. */
export function SegmentsTab({
    segments, wheels, soundAlerts, limits, onSegments, t,
}: {
    segments: Segment[];
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    limits: TierLimits | null;
    onSegments: (update: (prev: Segment[]) => Segment[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const patch = (index: number, changes: Partial<Segment>) =>
        onSegments(prev => prev.map((s, i) => (i === index ? { ...s, ...changes } : s)));

    const move = (index: number, delta: number) => {
        const to = index + delta;
        if (to < 0 || to >= segments.length) return;
        onSegments(prev => {
            const next = [...prev];
            [next[index], next[to]] = [next[to], next[index]];
            return next;
        });
    };

    // Los % del panel se recalculan mientras se escribe; el servidor los vuelve a
    // calcular al guardar, pero esperar al guardado para ver el efecto de un peso
    // hace imposible ajustar la rueda.
    const activos = segments.filter(s => s.isEnabled && s.weight > 0);
    const totalPeso = activos.reduce((sum, s) => sum + Number(s.weight || 0), 0);
    const porcentaje = (s: Segment) =>
        !s.isEnabled || s.weight <= 0 || totalPeso <= 0 ? 0 : (Number(s.weight) / totalPeso) * 100;

    const topeAlcanzado = !!(limits && limits.maxSegments >= 0 && segments.length >= limits.maxSegments);

    return (
        <section className="bg-[#1B1C1D] rounded-xl border border-[#374151] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between">
                <h2 className="font-bold text-[#f8fafc]">{t('wheel.segments.title')}</h2>
                <button
                    onClick={() => onSegments(prev => [...prev, emptySegment(prev.length)])}
                    disabled={topeAlcanzado}
                    title={topeAlcanzado ? t('wheel.quota.segmentsReached', { max: limits!.maxSegments }) : undefined}
                    className="px-3 py-1.5 text-sm bg-[#262626] hover:bg-[#333] disabled:opacity-40 border border-[#374151] text-[#f8fafc] rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    {t('wheel.segments.add')}
                </button>
            </div>

            <div className="divide-y divide-[#374151]">
                {segments.map((seg, i) => (
                    <SegmentRow
                        key={`${seg.id}-${i}`}
                        segment={seg}
                        percentage={porcentaje(seg)}
                        onChange={changes => patch(i, changes)}
                        onRemove={() => onSegments(prev => prev.filter((_, j) => j !== i))}
                        onMoveUp={() => move(i, -1)}
                        onMoveDown={() => move(i, 1)}
                        wheels={wheels}
                        soundAlerts={soundAlerts}
                        t={t}
                    />
                ))}
            </div>

            {segments.length < 2 && (
                <p className="px-5 py-4 text-sm text-[#94a3b8]">{t('wheel.segments.needTwo')}</p>
            )}
        </section>
    );
}
