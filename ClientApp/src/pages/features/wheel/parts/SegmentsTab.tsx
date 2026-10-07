import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { TierLimits } from '../hooks/useChannelResources';
import { emptySegment, newUid, type Segment, type SoundAlertOption, type WheelSummary } from '../model';
import { exportGajos, parseGajos } from '../namesIO';
import { SegmentRow } from '../tabs/SegmentRow';
import { prizeSummary } from '../tabs/PrizeParams';
import { ExportMenu, ImportButton, ImportPanel, TOOL_BTN } from './NamesTools';

/** Desde cuantos gajos aparece el buscador. */
const SEARCH_FROM = 8;

/** Negro o blanco, el que se lea mejor sobre ese color. */
function inkOn(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return '#12101B';
    const n = parseInt(m[1], 16);
    const y = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
    return y >= 150 ? '#12101B' : '#FFFFFF';
}

/** La lista de gajos: la tira del reparto, agregar, importar, exportar, buscar, ordenar y editar. */
export function SegmentsTab({
    segments, palette, slug, wheels, soundAlerts, limits, onSegments, t,
}: {
    segments: Segment[];
    /** La paleta del aspecto: color de los gajos que no tienen uno propio. */
    palette: string[];
    slug: string;
    wheels: WheelSummary[];
    soundAlerts: SoundAlertOption[];
    limits: TierLimits | null;
    onSegments: (update: (prev: Segment[]) => Segment[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    // Que filas tienen el detalle abierto, por `uid` (la fila se identifica aunque se reordene).
    const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
    const abrir = (uid: string) => setAbiertos(prev => new Set(prev).add(uid));
    const alternar = (uid: string) =>
        setAbiertos(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });

    const [filtro, setFiltro] = useState('');
    const [importando, setImportando] = useState(false);
    const [texto, setTexto] = useState('');
    const [reemplazar, setReemplazar] = useState(false);
    const [desde, setDesde] = useState<number | null>(null);
    const [sobre, setSobre] = useState<number | null>(null);

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

    const moveTo = (from: number, to: number) => {
        if (from === to) return;
        onSegments(prev => {
            const next = [...prev];
            const [x] = next.splice(from, 1);
            next.splice(to, 0, x);
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

    const max = limits && limits.maxSegments >= 0 ? limits.maxSegments : Infinity;
    const topeAlcanzado = segments.length >= max;

    // Un gajo nuevo nace con el detalle abierto: lo primero que se hace con el es llenarlo.
    const agregar = () => {
        const nuevo = emptySegment(segments.length);
        onSegments(prev => [...prev, nuevo]);
        abrir(nuevo.uid!);
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
        abrir(copia.uid!);
    };

    // ---------------------------------------------------------------- buscar
    const q = filtro.trim().toLowerCase();
    const filtrando = q !== '';
    const visibles = useMemo(
        () => segments
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => !q || s.label.toLowerCase().includes(q)
                || prizeSummary(s.prize, soundAlerts, wheels, t).text.toLowerCase().includes(q)),
        [segments, q, soundAlerts, wheels, t],
    );

    // ---------------------------------------------------------------- importar
    const parsed = useMemo(() => parseGajos(texto), [texto]);
    const base = reemplazar ? 0 : segments.length;
    const cabe = Math.max(0, max - base);
    const aCrear = Math.min(parsed.length, cabe);
    const omitidos = parsed.length - aCrear;

    const importar = () => {
        const nuevos: Segment[] = parsed.slice(0, aCrear).map((it, k) => ({
            ...emptySegment((reemplazar ? 0 : segments.length) + k),
            label: it.name,
            weight: it.weight ?? 1,
        }));
        onSegments(prev => [...(reemplazar ? [] : prev), ...nuevos]);
        setTexto('');
        setImportando(false);
        setReemplazar(false);
    };

    // ---------------------------------------------------------------- exportar
    const textoExportado = () => exportGajos(segments.map(s => ({
        label: s.label, weight: s.weight, prize: prizeSummary(s.prize, soundAlerts, wheels, t).text,
    })));

    // ---------------------------------------------------------------- tira
    const irA = (uid: string) => {
        abrir(uid);
        setFiltro('');
        window.setTimeout(() => document.getElementById(`gajo-${uid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    };

    const tramos = segments
        .map((s, i) => ({ s, i, pct: porcentaje(s), color: colores[i] }))
        .filter(x => x.pct > 0);

    return (
        <section className="bg-[#1B1C1D] rounded-xl border border-[#374151] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#374151] flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold text-[#f8fafc]">{t('wheel.segments.title')}</h2>
                <div className="flex flex-wrap items-center gap-2">
                    {segments.length >= SEARCH_FROM && (
                        <label className="relative">
                            <Search className="w-4 h-4 text-[#64748b] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="search"
                                value={filtro}
                                onChange={e => setFiltro(e.target.value)}
                                placeholder={t('wheel.segments.search')}
                                aria-label={t('wheel.segments.search')}
                                className="pl-8 pr-3 py-1.5 w-44 bg-[#262626] border border-[#374151] rounded-lg text-sm text-[#f8fafc] focus:outline-none focus:border-blue-500"
                            />
                        </label>
                    )}
                    <ImportButton open={importando} onClick={() => setImportando(v => !v)} t={t} />
                    <ExportMenu
                        text={textoExportado}
                        filename={`rueda-${slug}-gajos.csv`}
                        disabled={segments.length === 0}
                        t={t}
                    />
                    <button
                        onClick={agregar}
                        disabled={topeAlcanzado}
                        title={topeAlcanzado ? t('wheel.quota.segmentsReached', { max: limits!.maxSegments }) : undefined}
                        className={TOOL_BTN}
                    >
                        <Plus className="w-4 h-4" />
                        {t('wheel.segments.add')}
                    </button>
                </div>
            </div>

            {importando && (
                <ImportPanel
                    help={t('wheel.io.gajosHelp')}
                    placeholder={t('wheel.io.gajosPlaceholder')}
                    text={texto}
                    onText={setTexto}
                    summary={parsed.length === 0
                        ? t('wheel.io.nothingYet')
                        : t('wheel.io.gajosSummary', { count: aCrear })}
                    warning={omitidos > 0 ? t('wheel.io.overLimit', { count: omitidos, max: max === Infinity ? 0 : max }) : null}
                    applyLabel={reemplazar ? t('wheel.io.replaceApply') : t('wheel.io.addApply')}
                    canApply={aCrear > 0}
                    onApply={importar}
                    onClose={() => { setImportando(false); setTexto(''); setReemplazar(false); }}
                    t={t}
                >
                    <label className="flex items-start gap-2 text-sm text-[#cbd5e1] cursor-pointer">
                        <input type="checkbox" checked={reemplazar} onChange={e => setReemplazar(e.target.checked)} className="mt-1 accent-blue-500" />
                        <span>
                            {t('wheel.io.replace')}
                            <span className="block text-xs text-[#94a3b8]">{t('wheel.io.replaceHelp')}</span>
                        </span>
                    </label>
                </ImportPanel>
            )}

            {/* La tira del reparto: la rueda en una linea. Cada tramo mide lo que mide su
                probabilidad; un clic abre ese gajo. */}
            {tramos.length > 0 && (
                <div className="px-5 pt-4">
                    <div
                        className="flex h-8 rounded-lg overflow-hidden border border-[#374151]"
                        role="list"
                        aria-label={t('wheel.segments.strip')}
                    >
                        {tramos.map(({ s, i, pct, color }) => (
                            <button
                                key={s.uid ?? i}
                                role="listitem"
                                onClick={() => s.uid && irA(s.uid)}
                                title={`${s.icon ? `${s.icon} ` : ''}${s.label || t('wheel.segments.labelPlaceholder')} · ${pct.toFixed(1)}%`}
                                style={{ flex: `${pct} 1 0`, background: color, color: inkOn(color) }}
                                className="min-w-[3px] border-r border-[#12101B]/60 last:border-r-0 text-[11px] font-bold px-1 truncate hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                            >
                                {pct >= 9 ? `${s.icon ? `${s.icon} ` : ''}${s.label}` : ''}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-4 divide-y divide-[#374151] border-t border-[#374151]">
                {visibles.map(({ s: seg, i }) => (
                    <div
                        key={seg.uid ?? `${seg.id}-${i}`}
                        id={seg.uid ? `gajo-${seg.uid}` : undefined}
                        onDragOver={e => { if (desde !== null) { e.preventDefault(); if (sobre !== i) setSobre(i); } }}
                        onDrop={e => { e.preventDefault(); if (desde !== null) moveTo(desde, i); setDesde(null); setSobre(null); }}
                        // La linea azul marca donde va a caer: arriba si sube, abajo si baja.
                        style={desde !== null && sobre === i && desde !== i
                            ? { boxShadow: desde > i ? 'inset 0 3px 0 #3b82f6' : 'inset 0 -3px 0 #3b82f6' }
                            : undefined}
                        className={desde === i ? 'opacity-40' : ''}
                    >
                        <SegmentRow
                            segment={seg}
                            color={colores[i]}
                            percentage={porcentaje(seg)}
                            open={!!seg.uid && abiertos.has(seg.uid)}
                            onToggle={() => seg.uid && alternar(seg.uid)}
                            canMoveUp={!filtrando && i > 0}
                            canMoveDown={!filtrando && i < segments.length - 1}
                            canDuplicate={!topeAlcanzado}
                            onDuplicate={() => duplicar(i)}
                            drag={{
                                disabled: filtrando,
                                onDragStart: e => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', String(i));
                                    const fila = (e.currentTarget as HTMLElement).closest('[id^="gajo-"]');
                                    if (fila) e.dataTransfer.setDragImage(fila, 24, 24);
                                    setDesde(i);
                                },
                                onDragEnd: () => { setDesde(null); setSobre(null); },
                            }}
                            onChange={changes => patch(i, changes)}
                            onRemove={() => onSegments(prev => prev.filter((_, j) => j !== i))}
                            onMoveUp={() => move(i, -1)}
                            onMoveDown={() => move(i, 1)}
                            wheels={wheels}
                            soundAlerts={soundAlerts}
                            t={t}
                        />
                    </div>
                ))}
            </div>

            {filtrando && visibles.length === 0 && (
                <p className="px-5 py-4 text-sm text-[#94a3b8]">{t('wheel.segments.noMatches')}</p>
            )}

            {segments.length < 2 && (
                <p className="px-5 py-4 text-sm text-[#94a3b8]">{t('wheel.segments.needTwo')}</p>
            )}
        </section>
    );
}
