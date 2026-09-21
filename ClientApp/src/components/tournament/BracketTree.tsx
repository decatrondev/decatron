import React, { useEffect, useRef, useState } from 'react';

// Arbol de bracket real — conectores calculados geometricamente (sin medir el DOM,
// sin SVG). Cada ronda distribuye sus matches EVENLY dentro de la misma altura total
// fija, en vez de asumir que la cantidad se reduce a la mitad cada ronda (single
// elimination sí lo hace, pero el losers bracket de double elimination no: algunas
// rondas "drop" mantienen la misma cantidad de matches que la anterior en vez de
// fusionar pares). La distribucion pareja tiene una propiedad util: si una ronda
// fusiona pares 2:1 en la siguiente, el centro del match fusionado cae EXACTO en el
// promedio de sus dos origenes — así que un solo esquema de posicionamiento sirve
// para ambos casos (fusion 2:1 e identidad 1:1) sin necesitar formulas distintas.
//
// Escala dinamica (24-08-2026): antes el ancho por match era un pixel fijo — en
// pantallas 2K/4K quedaba chico con scroll horizontal aunque sobrara espacio de
// sobra al costado. Ahora mide el contenedor con ResizeObserver y escala todas las
// constantes (ancho/alto de match, gap entre rondas, tipografia) para llenar el
// espacio disponible, con un techo (MAX_SCALE) para que un bracket de pocas rondas
// en una pantalla enorme no termine con tarjetas gigantes y feas. Si el contenedor
// es mas angosto que el tamaño natural (mobile), escala=1 y cae al scroll horizontal
// de siempre.
//
// Compartido entre el panel de admin (interactivo, con onRecordResult, contenedor
// angosto -> escala se queda en 1x, comportamiento identico al de antes) y la pagina
// publica de torneos (solo lectura, contenedor ancho -> aprovecha el espacio).

export interface BracketNode {
    id: string | number;
    roundNumber: number;
    bracketPosition: number;
    teamAId: number | null;
    teamAName: string | null;
    teamBId: number | null;
    teamBName: string | null;
    winnerId: number | null;
    status: string;
}

const MATCH_H = 52;
const MATCH_W = 208;
const ROUND_GAP = 48;
const MIN_SLOT = 68;
const MAX_SCALE = 1.9;

function useContainerWidth<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width;
            if (w) setWidth(w);
        });
        observer.observe(el);
        setWidth(el.getBoundingClientRect().width);
        return () => observer.disconnect();
    }, []);

    return [ref, width] as const;
}

export default function BracketTree({
    matches,
    onRecordResult,
    finalLabel = 'Final',
}: {
    matches: BracketNode[];
    onRecordResult?: (matchId: string | number, winnerId: number) => void;
    finalLabel?: string;
}) {
    const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>();

    if (matches.length === 0) return <p className="font-mono text-xs text-[#7C8AA6]">Sin matches todavía.</p>;

    const rounds = Array.from(new Set(matches.map((m) => m.roundNumber))).sort((a, b) => a - b);
    const maxRound = Math.max(...rounds);
    const roundMatches = rounds.map((r) => matches.filter((m) => m.roundNumber === r).sort((a, b) => a.bracketPosition - b.bracketPosition));
    const maxCount = Math.max(...roundMatches.map((rm) => rm.length));

    const naturalWidth = rounds.length * MATCH_W + (rounds.length - 1) * ROUND_GAP;
    const scale = containerWidth > 0 ? Math.min(Math.max(containerWidth / naturalWidth, 1), MAX_SCALE) : 1;

    const matchW = MATCH_W * scale;
    const matchH = MATCH_H * scale;
    const roundGap = ROUND_GAP * scale;
    const totalHeight = Math.max(maxCount * MIN_SLOT * scale, matchH);

    // Centro vertical de cada match, distribuido parejo dentro de totalHeight segun
    // cuantos matches tenga SU ronda — ver nota arriba sobre por que esto alinea bien
    // tanto fusiones 2:1 como transiciones 1:1.
    const centerOf = (roundIdx: number, position: number) => {
        const count = roundMatches[roundIdx].length;
        return ((position - 0.5) / count) * totalHeight;
    };

    // Casilla de campeon aparte, despues de la final — pedido del usuario
    // (24-08-2026): con las dos casillas de la final lado a lado costaba ver de un
    // vistazo quien gano (habia que fijarse cual de las dos tenia el puntito verde).
    // Solo se muestra si la final ya tiene ganador cargado.
    const finalRoundMatches = roundMatches[roundMatches.length - 1];
    const finalMatch = finalRoundMatches.length === 1 ? finalRoundMatches[0] : null;
    const championName = finalMatch?.winnerId != null
        ? (finalMatch.winnerId === finalMatch.teamAId ? finalMatch.teamAName : finalMatch.winnerId === finalMatch.teamBId ? finalMatch.teamBName : null)
        : null;
    const championCenterY = finalMatch ? centerOf(rounds.length - 1, finalMatch.bracketPosition) : 0;
    const championW = matchW * 0.85;

    return (
        <div ref={containerRef} className="overflow-x-auto pb-3 -mx-1 px-1">
            <div className="flex" style={{ gap: roundGap }}>
                {rounds.map((round, i) => {
                    const isFinal = round === maxRound;
                    const count = roundMatches[i].length;
                    const nextCount = i + 1 < rounds.length ? roundMatches[i + 1].length : null;

                    return (
                        <div key={round} className="relative flex-shrink-0" style={{ width: matchW, height: totalHeight }}>
                            <p
                                className={`absolute left-0 right-0 text-center font-mono uppercase tracking-widest ${
                                    isFinal ? 'text-[#E8B04B]' : 'text-[#7C8AA6]'
                                }`}
                                style={{ top: -24 * scale, fontSize: 10 * scale }}
                            >
                                {isFinal ? finalLabel : `Ronda ${round}`}
                            </p>

                            {roundMatches[i].map((m) => {
                                const centerY = centerOf(i, m.bracketPosition);
                                const top = centerY - matchH / 2;
                                const aWins = m.winnerId != null && m.winnerId === m.teamAId;
                                const bWins = m.winnerId != null && m.winnerId === m.teamBId;
                                const playable = onRecordResult && m.status === 'scheduled' && m.teamAId != null && m.teamBId != null;

                                const isMerge = nextCount !== null && nextCount === Math.ceil(count / 2) && count > nextCount;
                                const isIdentity = nextCount !== null && nextCount === count;
                                const destPosition = isMerge ? Math.ceil(m.bracketPosition / 2) : m.bracketPosition;
                                const destCenterY = nextCount !== null ? ((destPosition - 0.5) / nextCount) * totalHeight : centerY;
                                const isFirstOfPair = !isMerge || m.bracketPosition % 2 === 1;

                                return (
                                    <React.Fragment key={m.id}>
                                        <div
                                            className={`absolute rounded-lg border overflow-hidden transition-colors ${
                                                isFinal ? 'border-[#E8B04B]/50 shadow-[0_0_16px_-4px_rgba(232,176,75,0.35)]' : 'border-[#232C42]'
                                            } bg-[#0F1729]`}
                                            style={{ top, width: matchW, height: matchH }}
                                        >
                                            <TeamRow
                                                name={m.teamAName}
                                                won={aWins}
                                                scale={scale}
                                                onClick={playable ? () => onRecordResult!(m.id, m.teamAId!) : undefined}
                                            />
                                            <div className="bg-[#232C42]" style={{ height: 1 }} />
                                            <TeamRow
                                                name={m.teamBName}
                                                bye={m.status === 'walkover' && !m.teamBName}
                                                won={bWins}
                                                scale={scale}
                                                onClick={playable ? () => onRecordResult!(m.id, m.teamBId!) : undefined}
                                            />
                                        </div>

                                        {(isMerge || isIdentity) && (
                                            <>
                                                <div
                                                    className="absolute bg-[#232C42]"
                                                    style={{ top: centerY - 1, left: matchW, width: roundGap / 2, height: 2 }}
                                                />
                                                {isMerge && isFirstOfPair && (
                                                    <div
                                                        className="absolute bg-[#232C42]"
                                                        style={{
                                                            // destCenterY es el promedio del par (propiedad de la distribucion
                                                            // pareja, ver nota arriba) — el compañero cae simetrico al otro lado.
                                                            top: Math.min(centerY, 2 * destCenterY - centerY) - 1,
                                                            left: matchW + roundGap / 2 - 1,
                                                            width: 2,
                                                            height: Math.abs(centerY - destCenterY) * 2,
                                                        }}
                                                    />
                                                )}
                                                <div
                                                    className="absolute bg-[#232C42]"
                                                    style={{ top: destCenterY - 1, left: matchW + roundGap / 2 - 1, width: roundGap / 2 + 1, height: 2 }}
                                                />
                                            </>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    );
                })}

                {championName && (
                    <div className="relative flex-shrink-0" style={{ width: championW, height: totalHeight }}>
                        <p
                            className="absolute left-0 right-0 text-center font-mono uppercase tracking-widest text-[#E8B04B]"
                            style={{ top: -24 * scale, fontSize: 10 * scale }}
                        >
                            Campeón
                        </p>
                        <div
                            className="absolute bg-[#232C42]"
                            style={{ top: championCenterY - 1, left: -roundGap, width: roundGap, height: 2 }}
                        />
                        <div
                            className="absolute rounded-lg border border-[#E8B04B] bg-[#E8B04B]/10 shadow-[0_0_20px_-4px_rgba(232,176,75,0.5)] flex items-center justify-center px-2 overflow-hidden"
                            style={{ top: championCenterY - matchH / 2, width: championW, height: matchH }}
                        >
                            <span
                                className="font-mono font-bold text-[#E8B04B] truncate"
                                style={{ fontSize: 13 * scale }}
                            >
                                🏆 {championName}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function TeamRow({
    name,
    won,
    bye,
    scale,
    onClick,
}: {
    name: string | null;
    won: boolean;
    bye?: boolean;
    scale: number;
    onClick?: () => void;
}) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`w-full flex items-center justify-between font-mono truncate ${onClick ? 'cursor-pointer hover:bg-[#1a2540]' : ''} ${
                won ? 'text-[#3ED6C4] font-bold' : 'text-[#EDF0F7]'
            }`}
            style={{ height: 25 * scale, paddingLeft: 10 * scale, paddingRight: 10 * scale, fontSize: 12 * scale }}
        >
            <span className="truncate">{name || (bye ? '—' : 'TBD')}</span>
            {won && (
                <span className="text-[#3ED6C4]" style={{ fontSize: 9 * scale }}>
                    ●
                </span>
            )}
        </Tag>
    );
}
