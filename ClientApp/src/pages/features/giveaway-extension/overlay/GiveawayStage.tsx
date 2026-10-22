import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { OVERLAY_CANVAS, PLATFORM_STYLE } from './model';
import type { OverlayAppearance, OverlayBlock, OverlayBlockId, OverlaySnapshot, OverlayWinner } from './model';
import { playFanfare, playTick } from './sounds';

/**
 * El overlay del giveaway dibujado sobre un lienzo de 1920x1080. Es EL MISMO componente en OBS y en la vista previa del
 * editor. No decide nada: fase, ganador y tiempos vienen del servidor. `clockOffsetMs` = hora del servidor - hora local,
 * para que las cuentas regresivas y la ruleta estén sincronizadas aunque el reloj de la PC esté desfasado.
 */

interface Props {
    snapshot: OverlaySnapshot;
    clockOffsetMs: number;
    /** Qué plataforma muestra la lista de entradas */
    source?: 'all' | 'twitch' | 'kick';
    /** Reproduce tic y fanfarria (en OBS sí; en la vista previa del editor no) */
    audio?: boolean;
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const ROW = 116;

function rgba(hex: string, alpha: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return `rgba(15,23,42,${alpha})`;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function PlatformDot({ platform, size = 30 }: { platform: string; size?: number }) {
    const p = PLATFORM_STYLE[platform] ?? { color: '#64748b', letter: '?', label: platform };
    return (
        <span title={p.label} style={{
            width: size, height: size, borderRadius: '50%', background: p.color, color: platform === 'kick' ? '#000' : '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.55, flexShrink: 0,
        }}>{p.letter}</span>
    );
}

function formatClock(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function GiveawayStage({ snapshot, clockOffsetMs, source = 'all', audio = false }: Props) {
    const a = snapshot.appearance;
    const [tick, setTick] = useState(0);

    // Reloj propio: 20 cuadros por segundo solo mientras hay algo animándose o contando
    const animating = snapshot.phase === 'drawing' || snapshot.phase === 'winner' || snapshot.phase === 'open';
    useEffect(() => {
        if (!animating) return;
        const id = window.setInterval(() => setTick((n) => n + 1), 50);
        return () => window.clearInterval(id);
    }, [animating]);
    void tick;

    const serverNow = Date.now() + clockOffsetMs;

    // El servidor republica al cambiar de fase, pero la ruleta termina sola a la hora exacta: sin esperar el siguiente evento
    const drawnAt = snapshot.drawnAt ? Date.parse(snapshot.drawnAt) : 0;
    const revealEnd = drawnAt + snapshot.revealSeconds * 1000;
    const phase = snapshot.phase === 'drawing' && serverNow >= revealEnd ? 'winner' : snapshot.phase;

    const panel = (extra?: CSSProperties): CSSProperties => ({
        background: rgba(a.panel, a.panelOpacity / 100),
        color: a.text,
        borderRadius: 24,
        border: `3px solid ${rgba(a.accent, 0.85)}`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        boxSizing: 'border-box',
        padding: 28,
        ...extra,
    });

    const place = (b: OverlayBlock): CSSProperties => ({ position: 'absolute', left: b.x, top: b.y, width: b.width, height: b.height, boxSizing: 'border-box' });

    const blocks: { id: OverlayBlockId; node: ReactNode }[] = [];
    const entries = snapshot.recent.filter((e) => source === 'all' || e.platform === source);

    if (phase === 'open' || phase === 'cancelled') {
        blocks.push({ id: 'card', node: <CardBlock snapshot={snapshot} phase={phase} serverNow={serverNow} a={a} style={panel()} /> });
        if (phase === 'open') blocks.push({ id: 'entries', node: <EntriesBlock entries={entries} a={a} style={panel({ padding: 22 })} /> });
    }
    if (phase === 'drawing' || phase === 'winner' || phase === 'result') {
        blocks.push({ id: 'reveal', node: <RevealBlock snapshot={snapshot} phase={phase} serverNow={serverNow} drawnAt={drawnAt} a={a} audio={audio} style={panel()} /> });
        // Mientras gira la ruleta el nombre no se adelanta: los ganadores aparecen con el revelado
        if (phase !== 'drawing' && snapshot.winners.length > 0) blocks.push({ id: 'winners', node: <WinnersBlock winners={snapshot.winners} serverNow={serverNow} a={a} style={panel({ padding: 22 })} /> });
    }

    return (
        <div style={{ position: 'relative', width: OVERLAY_CANVAS.width, height: OVERLAY_CANVAS.height, overflow: 'hidden', fontFamily: a.font }}>
            <style>{`
                @keyframes gvSlideIn { from { transform: translateX(-30px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
                @keyframes gvPop { 0% { transform: scale(.6); opacity: 0 } 70% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
                @keyframes gvFall { 0% { transform: translateY(-40px) rotate(0deg); opacity: 1 } 100% { transform: translateY(1100px) rotate(720deg); opacity: 0.9 } }
                @keyframes gvPulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
            `}</style>
            {blocks.map(({ id, node }) => {
                const b = a[id];
                return b.enabled ? <div key={id} style={place(b)}>{node}</div> : null;
            })}
            {phase === 'winner' && a.confetti && <Confetti seed={snapshot.drawnAt ?? 'x'} colors={[a.accent, '#ffffff', '#38bdf8', '#f472b6', '#4ade80']} />}
        </div>
    );
}

// ── Tarjeta: premio, comando, contador y tiempo ─────────────────────────────────

function CardBlock({ snapshot, phase, serverNow, a, style }: { snapshot: OverlaySnapshot; phase: string; serverNow: number; a: OverlayAppearance; style: CSSProperties }) {
    const endsMs = snapshot.endsAt ? Date.parse(snapshot.endsAt) - serverNow : null;
    if (phase === 'cancelled') {
        return <div style={{ ...style, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 800 }}>Giveaway cancelado</div>;
    }
    return (
        <div style={{ ...style, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', animation: 'gvSlideIn .5s ease-out' }}>
            <div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, color: a.accent, textTransform: 'uppercase' }}>🎁 Giveaway</div>
                <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{snapshot.prize}</div>
            </div>
            <div style={{ fontSize: 28 }}>
                Escribe <b style={{ color: a.accent, fontSize: 36 }}>{snapshot.command}</b> para participar
                {snapshot.allowAutoEntry && <div style={{ opacity: 0.75, fontSize: 24 }}>o solo escribe en el chat</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 34, fontWeight: 800 }}>
                <span>👥 {snapshot.participantCount}</span>
                <span style={{ display: 'inline-flex', gap: 8 }}>
                    {snapshot.twitch && <PlatformDot platform="twitch" />}
                    {snapshot.kick && <PlatformDot platform="kick" />}
                </span>
                {endsMs !== null && <span style={{ color: endsMs < 15000 ? '#f87171' : a.text, animation: endsMs < 15000 ? 'gvPulse 1s infinite' : undefined }}>⏱ {formatClock(endsMs)}</span>}
            </div>
        </div>
    );
}

// ── Últimas entradas ────────────────────────────────────────────────────────────

function EntriesBlock({ entries, a, style }: { entries: OverlaySnapshot['recent']; a: OverlayAppearance; style: CSSProperties }) {
    return (
        <div style={{ ...style, height: '100%', overflow: 'hidden' }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, color: a.accent, textTransform: 'uppercase', marginBottom: 12 }}>Últimas entradas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {entries.slice(0, 8).map((e, i) => (
                    <div key={`${e.displayName}-${e.enteredAt}`} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 32, fontWeight: 700, opacity: 1 - i * 0.07, animation: i === 0 ? 'gvSlideIn .4s ease-out' : undefined }}>
                        <PlatformDot platform={e.platform} size={30} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.displayName}</span>
                    </div>
                ))}
                {entries.length === 0 && <div style={{ fontSize: 28, opacity: 0.6 }}>Esperando participantes…</div>}
            </div>
        </div>
    );
}

// ── Revelado: ruleta de nombres → ganador ───────────────────────────────────────

function RevealBlock({ snapshot, phase, serverNow, drawnAt, a, audio, style }: {
    snapshot: OverlaySnapshot; phase: string; serverNow: number; drawnAt: number; a: OverlayAppearance; audio: boolean; style: CSSProperties;
}) {
    const winner = snapshot.winners[0];
    const names = snapshot.candidates.length > 0 ? snapshot.candidates : [winner?.displayName ?? '…'];
    const total = 52;
    // La ruleta recorre nombres reales y se detiene en el ganador, que el servidor ya había elegido
    const reel = useMemo(() => {
        const winnerName = winner?.displayName ?? names[0];
        // Relleno sin el nombre del ganador, para que no aparezca repetido junto a sí mismo antes de detenerse
        const others = names.filter((n) => n !== winnerName);
        const filler = others.length > 0 ? others : names;
        const list: string[] = [];
        for (let i = 0; i < total - 1; i++) list.push(filler[i % filler.length]);
        list.push(winnerName);
        // Dos filas más debajo: la ventana muestra una fila antes y otra después del ganador
        list.push(filler[(total - 1) % filler.length], filler[total % filler.length]);
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snapshot.drawnAt, winner?.displayName, names.join('|')]);

    const duration = Math.max(1, snapshot.revealSeconds) * 1000;
    const t = Math.min(1, Math.max(0, (serverNow - drawnAt) / duration));
    const pos = easeOutQuart(t) * (total - 1);

    const lastRow = useRef(-1);
    useEffect(() => {
        if (!audio || phase !== 'drawing') return;
        const row = Math.floor(pos);
        if (row !== lastRow.current) { lastRow.current = row; if (a.tickSound) playTick(a.volume); }
    });
    const fanfared = useRef('');
    useEffect(() => {
        if (audio && phase === 'winner' && a.fanfareSound && fanfared.current !== snapshot.drawnAt) {
            fanfared.current = snapshot.drawnAt ?? '';
            playFanfare(a.volume);
        }
    });

    if (phase === 'drawing') {
        const windowH = ROW * 3;
        return (
            <div style={{ ...style, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4, color: a.accent, textTransform: 'uppercase' }}>Sorteando…</div>
                <div style={{ position: 'relative', width: '100%', height: windowH, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(transparent, #000 28%, #000 72%, transparent)', maskImage: 'linear-gradient(transparent, #000 28%, #000 72%, transparent)' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: ROW, height: ROW, borderTop: `3px solid ${a.accent}`, borderBottom: `3px solid ${a.accent}`, background: rgba(a.accent, 0.12) }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${ROW - pos * ROW}px)` }}>
                        {reel.map((n, i) => (
                            <div key={i} style={{ height: ROW, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 62, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const timeLeft = winner?.deadline ? Date.parse(winner.deadline) - serverNow : null;
    return (
        <div style={{ ...style, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', animation: 'gvPop .6s ease-out' }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4, color: a.accent, textTransform: 'uppercase' }}>🏆 {phase === 'result' ? 'Ganador' : '¡Felicidades!'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, maxWidth: '100%' }}>
                {winner && <PlatformDot platform={winner.platform} size={64} />}
                <span style={{ fontSize: 96, fontWeight: 900, lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{winner?.displayName}</span>
            </div>
            <div style={{ fontSize: 34, opacity: 0.9 }}>{snapshot.prize}</div>
            {phase === 'winner' && timeLeft !== null && (
                <div style={{ fontSize: 34, fontWeight: 800, color: timeLeft < 10000 ? '#f87171' : a.text }}>Escribe en el chat · {formatClock(timeLeft)}</div>
            )}
            {phase === 'result' && winner?.state === 'responded' && <div style={{ fontSize: 34, fontWeight: 800, color: '#4ade80' }}>✓ Respondió</div>}
        </div>
    );
}

// ── Ganadores y su estado ───────────────────────────────────────────────────────

function WinnersBlock({ winners, serverNow, a, style }: { winners: OverlayWinner[]; serverNow: number; a: OverlayAppearance; style: CSSProperties }) {
    return (
        <div style={{ ...style, height: '100%', overflow: 'hidden' }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, color: a.accent, textTransform: 'uppercase', marginBottom: 10 }}>Ganadores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {winners.slice(0, 4).map((w) => {
                    const left = w.deadline ? Date.parse(w.deadline) - serverNow : null;
                    const chip = w.state === 'responded' ? { t: '✓ Respondió', c: '#4ade80' } : w.state === 'timeout' ? { t: '✗ No respondió', c: '#f87171' } : { t: left !== null ? `⏱ ${formatClock(left)}` : 'Esperando', c: a.text };
                    return (
                        <div key={w.position} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 700 }}>
                            <span style={{ opacity: 0.6, width: 36 }}>#{w.position}</span>
                            <PlatformDot platform={w.platform} size={28} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.displayName}</span>
                            {w.wasBackup && <span style={{ fontSize: 22, opacity: 0.7 }}>respaldo</span>}
                            <span style={{ color: chip.c, fontWeight: 800 }}>{chip.t}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Confetti({ seed, colors }: { seed: string; colors: string[] }) {
    const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
        left: (i * 137) % 1920, delay: ((i * 53) % 1800) / 1000, dur: 2.8 + ((i * 29) % 20) / 10, size: 12 + ((i * 7) % 12),
        color: colors[i % colors.length], round: i % 3 === 0,
    })), [seed]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {pieces.map((p, i) => (
                <span key={i} style={{ position: 'absolute', top: 0, left: p.left, width: p.size, height: p.size * 0.6, background: p.color, borderRadius: p.round ? '50%' : 2, animation: `gvFall ${p.dur}s ${p.delay}s ease-in forwards`, opacity: 0 }} />
            ))}
        </div>
    );
}
