import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { TierLimits } from '../hooks/useChannelResources';
import { emptySegment, newUid, type Segment, type SoundAlertOption, type WheelSummary } from '../model';
import { SegmentRow } from '../tabs/SegmentRow';

/** La lista de gajos: agregar, editar, ordenar y quitar. */
export function SegmentsTab({
    segments, palette, wheels, soundAlerts, limits, onSegments, t,
}: {
    segments: Segment[];
    /** La paleta del aspecto: color de los gajos que no tienen uno propio. */
    palette: string[];
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    limits: TierLimits | null;
    onSegments: (update: (prev: Segment[]) => Segment[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    // Que filas tienen el detalle abierto, por `uid` (la fila se identifica aunque se reordene).
    const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
    const alternar = (uid: string) =>
        setAbiertos(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });

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

    // El color de cada gajo como lo dibuja la rueda: el propio, o el de la paleta segun su
    // posicion ENTRE LOS ACTIVOS (los apagados no se dibujan y no cuentan).
    const colores = (() => {
        let k = 0;
        return segments.map(sg => sg.color || (palette.length ? palette[(sg.isEnabled ? k++ : k) % palette.length] : '#E8B455'));
    })();

    const topeAlcanzado = !!(limits && limits.maxSegments >= 0 && segments.length >= limits.maxSegments);

    // Un gajo nuevo nace con el detalle abierto: lo primero que se hace con el es llenarlo.
    const agregar = () => {
        const nuevo = emptySegment(segments.length);
        onSegments(prev => [...prev, nuevo]);
        setAbiertos(prev => new Set(prev).add(nuevo.uid!));
    };

    const duplicar = (index: number) => {
        const origen = segments[index];
        const copia: Segment = {
            ...origen, id: 0, uid: newUid(),
            label: `${origen.label} ${t('wheel.segments.copySuffix')}`.trim(),
            stockRemaining: null, effectivePercentage: undefined,
            prize: { type: origen.prize.type, params: { ...origen.prize.params } },
        };
        onSegments(prev => [...prev.slice(0, index + 1), copia, ...prev.slice(index + 1)]);
        setAbiertos(prev => new Set(prev).add(copia.uid!));
    };

    return (
        <section className="bg-[#1B1C1D] rounded-xl border border-[#374151] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between">
                <h2 className="font-bold text-[#f8fafc]">{t('wheel.segments.title')}</h2>
                <button
                    onClick={agregar}
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
                        key={seg.uid ?? `${seg.id}-${i}`}
                        segment={seg}
                        color={colores[i]}
                        percentage={porcentaje(seg)}
                        open={!!seg.uid && abiertos.has(seg.uid)}
                        onToggle={() => seg.uid && alternar(seg.uid)}
                        canMoveUp={i > 0}
                        canMoveDown={i < segments.length - 1}
                        canDuplicate={!topeAlcanzado}
                        onDuplicate={() => duplicar(i)}
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
