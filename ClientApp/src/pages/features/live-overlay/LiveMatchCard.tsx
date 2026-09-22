/**
 * Tarjeta del overlay "Partida en vivo": una caja fija (size × scale) y una pantalla por
 * fase del Desktop (lobby, buscando, selección, en partida, fin). Mismo componente en
 * el editor y en OBS. Sin fase (o pantalla apagada) no dibuja nada: transparente.
 */
import { CSSProperties, ReactNode } from 'react';
import { CARD_LABELS, CardLabels, ChampIcon, LOSS, NEUTRAL, WIN, fmtDuration, fmtK, fontStyle, formatTierLabel, hexToRgba, useTicker } from '../game-overlays/GameOverlayCard';
import { LivePhaseInfo, ROLE_LABELS } from '../game-overlays/types';
import { LiveElementId, LiveOverlayConfig, LiveScreenId } from './types';

export interface LiveLabels extends CardLabels { searching: string; me: string; noCoach: string; }
export const LIVE_LABELS: Record<'es' | 'en', LiveLabels> = {
    es: { ...CARD_LABELS.es, searching: 'buscando', me: 'tú', noCoach: 'El coach no tiene nada que decir todavía' },
    en: { ...CARD_LABELS.en, searching: 'searching', me: 'you', noCoach: 'The coach has nothing to say yet' },
};

/** Lo último que dijo el coach: nombre + comentario como subtítulo, y la sugerencia/matchup como chip. */
export function CoachSayBlock({ live, font, accent, compact }: { live: LivePhaseInfo; font: CSSProperties; accent: string; compact?: boolean }) {
    const c = live.coach;
    if (!c) return null;
    const chip = c.kind === 'my_turn' && c.suggestion ? c.suggestion : c.kind === 'final' && c.matchup ? null : null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: compact ? 360 : 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>{c.coachName}</span>
                {chip && <span style={{ fontSize: 10, fontWeight: 700, color: '#0f1115', background: accent, borderRadius: 4, padding: '1px 6px', fontFamily: 'Inter, sans-serif' }}>→ {chip}</span>}
            </div>
            <div style={{ ...font, whiteSpace: 'normal', lineHeight: 1.3 }}>{c.comment}</div>
            {c.kind === 'final' && (c.runes || c.spells) && <div style={{ ...font, fontSize: '0.8em', color: NEUTRAL, whiteSpace: 'normal' }}>{[c.runes, c.spells].filter(Boolean).join(' · ')}</div>}
        </div>
    );
}

/**
 * Predicción del chat: barra con el pozo de cada lado (verde gana / rojo pierde) y la cuenta
 * regresiva hasta el cierre; al terminar la partida, el lado ganador y quiénes acertaron.
 */
export function PredictionBlock({ live, font, L, accent, now, compact }: { live: LivePhaseInfo; font: CSSProperties; L: CardLabels; accent: string; now: number; compact?: boolean }) {
    const p = live.prediction;
    if (!p) return null;
    const total = p.poolWin + p.poolLoss;
    const pctWin = total > 0 ? Math.round(p.poolWin * 100 / total) : 50;
    const secsLeft = Math.max(0, Math.floor((new Date(p.closesAt).getTime() - now) / 1000));
    const resolved = !!p.result;
    const label = { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' as const, fontFamily: 'Inter, sans-serif', fontWeight: 700 };
    const width = compact ? 220 : 280;

    let status: JSX.Element;
    if (resolved && p.result === 'refund') status = <span style={{ color: NEUTRAL }}>{L.predRefund}</span>;
    else if (resolved) status = <span style={{ color: p.result === 'win' ? WIN : LOSS, fontWeight: 700 }}>{p.result === 'win' ? L.predWin : L.predLoss} · {p.winners} {L.predWinners}</span>;
    else if (secsLeft > 0) status = <span style={{ color: NEUTRAL }}>{L.predClosesIn} <span style={{ color: '#e6edf3', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(secsLeft)}</span> · <span style={{ color: accent }}>{L.predHint}</span></span>;
    else status = <span style={{ color: NEUTRAL }}>{L.predClosed}</span>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width }}>
            <span style={{ ...label, color: accent }}>{L.prediction}{p.champion ? <span style={{ color: NEUTRAL, fontWeight: 500 }}> · {p.champion}</span> : null}</span>
            <div style={{ ...font, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: WIN }}>{L.predWin} {fmtK(p.poolWin)} <span style={{ fontSize: '0.75em', color: NEUTRAL }}>({p.betsWin})</span></span>
                <span style={{ color: LOSS }}><span style={{ fontSize: '0.75em', color: NEUTRAL }}>({p.betsLoss})</span> {fmtK(p.poolLoss)} {L.predLoss}</span>
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,.1)' }}>
                {total > 0 && <>
                    <span style={{ width: `${pctWin}%`, background: WIN, opacity: resolved && p.result !== 'win' ? 0.35 : 1, transition: 'width .4s ease' }} />
                    <span style={{ flex: 1, background: LOSS, opacity: resolved && p.result !== 'loss' ? 0.35 : 1 }} />
                </>}
            </div>
            <div style={{ ...font, fontSize: '0.8em', whiteSpace: 'normal' }}>{total === 0 && !resolved ? <span style={{ color: NEUTRAL }}>{L.predNoBets} · <span style={{ color: accent }}>{L.predHint}</span></span> : status}</div>
            {resolved && p.top.length > 0 && <div style={{ ...font, fontSize: '0.75em', color: NEUTRAL, whiteSpace: 'normal' }}>{p.top.join(' · ')}</div>}
        </div>
    );
}

interface Props {
    config: LiveOverlayConfig;
    phase: LivePhaseInfo | null | undefined;
    lang?: 'es' | 'en';
    animation?: string;
    /** Solo editor: sin caja fija, para medir. */
    measure?: boolean;
}

/** La caja: tamaño fijo, escala, fondo, línea de acento y sombra (igual que CardBox de Games). */
function LiveBox({ config, animation, measure, children, style }: { config: LiveOverlayConfig; animation?: string; measure?: boolean; children: ReactNode; style?: CSSProperties }) {
    const isBar = config.layout === 'bar';
    const scale = config.scale || 1;
    const radius = config.background.type === 'transparent' ? 0 : isBar ? Math.min(config.background.radius, 8) : config.background.radius;
    const bg: CSSProperties = config.background.type === 'transparent' ? {} : { background: hexToRgba(config.background.color, config.background.opacity), borderRadius: radius };
    const accentLine: CSSProperties = config.chrome.accentLine
        ? (isBar ? { borderTop: `${config.chrome.accentWidth}px solid ${config.accent}` } : { borderLeft: `${config.chrome.accentWidth}px solid ${config.accent}` })
        : {};
    const box: CSSProperties = {
        ...bg, ...accentLine, ...style,
        boxSizing: 'border-box',
        boxShadow: config.chrome.shadow ? '0 4px 16px rgba(0,0,0,.35)' : undefined,
        overflow: measure ? 'visible' : 'hidden',
        width: measure ? undefined : config.size.width,
        height: measure ? undefined : config.size.height,
        display: measure ? 'inline-flex' : 'flex',
        fontFamily: 'Inter, system-ui, sans-serif',
        animation,
    };
    return (
        <div style={{ position: 'relative', width: measure ? undefined : config.size.width * scale, height: measure ? undefined : config.size.height * scale, display: measure ? 'inline-block' : undefined }}>
            <style>{'.lv-box>*{flex-shrink:0}'}</style>
            <div style={{ transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: 'top left', width: measure ? undefined : config.size.width }}>
                <div className="lv-box" style={box}>{children}</div>
            </div>
        </div>
    );
}

const clip: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
const caption = (t: string, color = NEUTRAL): CSSProperties => ({ color, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', fontWeight: 700 });

export function LiveMatchCard({ config, phase, lang = 'es', animation, measure }: Props) {
    const L = LIVE_LABELS[lang];
    const el = config.elements;
    const accent = config.accent;
    const on = (id: LiveElementId) => el[id]?.visible !== false;
    const font = (id: LiveElementId, fallback: number) => fontStyle(el[id]?.font, fallback);
    const screen = (phase?.phase ?? 'none') as LiveScreenId | 'none';
    const now = useTicker(screen === 'matchmaking' || screen === 'ingame' || screen === 'champselect' || (!!phase?.prediction && !phase.prediction.result));
    if (!phase || screen === 'none' || !config.screens[screen]?.enabled) return null;

    const isBar = config.layout === 'bar';
    const compact = config.layout !== 'panel';
    const dot = (color: string) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />;
    const sep = <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />;

    // ─── Cabecera: punto + fase + cola ──────────────────────────────────────
    const titleText: Record<LiveScreenId, string> = { lobby: L.lobby, matchmaking: L.matchmaking, champselect: L.champSelect, ingame: L.inGame, postgame: L.postGame };
    const titleColor: Record<LiveScreenId, string> = { lobby: NEUTRAL, matchmaking: accent, champselect: accent, ingame: LOSS, postgame: phase.postGame ? (phase.postGame.win ? WIN : LOSS) : NEUTRAL };
    const title = on('title') && (
        <div style={{ ...font('title', 13), display: 'flex', alignItems: 'center', gap: 6 }}>
            {dot(titleColor[screen])}
            <span style={clip}>{titleText[screen]}{phase.queueName ? <span style={{ color: NEUTRAL, fontWeight: 500 }}> · {phase.queueName}</span> : null}</span>
        </div>
    );

    const blocks: ReactNode[] = [];
    if (title) blocks.push(<div key="title">{title}</div>);

    // ─── Lobby ───────────────────────────────────────────────────────────────
    if (screen === 'lobby' && on('lobbyMembers')) {
        const f = font('lobbyMembers', 13);
        const members = phase.lobby.length ? phase.lobby : [];
        blocks.push(
            <div key="lobby" style={{ display: 'flex', flexDirection: isBar ? 'row' : 'column', gap: isBar ? 14 : 4, minWidth: 0 }}>
                {members.map((m, i) => {
                    const sc = m.scout;
                    const chips: ReactNode[] = [];
                    if (sc && on('scoutRank') && sc.tier) chips.push(<span key="r" style={{ ...font('scoutRank', 12), color: el.scoutRank?.font?.color ?? '#c9d1d9' }}>{formatTierLabel(sc.tier)}{sc.division ? ` ${sc.division}` : ''}{sc.lp != null ? ` · ${sc.lp} LP` : ''}</span>);
                    if (sc && on('scoutWinRate') && sc.winRate != null && sc.games >= 5) chips.push(<span key="w" style={{ ...font('scoutWinRate', 12), color: sc.winRate >= 55 ? WIN : sc.winRate < 45 ? LOSS : el.scoutWinRate?.font?.color ?? '#c9d1d9' }}>{sc.winRate}% <span style={{ color: NEUTRAL, fontSize: '0.85em' }}>({sc.games})</span></span>);
                    if (sc && on('scoutStreak') && Math.abs(sc.streak) >= 2) chips.push(<span key="s" style={{ ...font('scoutStreak', 12), color: sc.streak > 0 ? WIN : LOSS }}>{sc.streak > 0 ? '🔥' : '❄️'} {Math.abs(sc.streak)}</span>);
                    const top = sc && on('scoutTopChamps') && sc.topChampions.length ? <span style={{ ...font('scoutTopChamps', 11), color: el.scoutTopChamps?.font?.color ?? NEUTRAL }}>{sc.topChampions.slice(0, 3).join(' · ')}</span> : null;
                    return (
                        <div key={i} style={{ display: 'flex', flexDirection: isBar ? 'row' : 'column', gap: isBar ? 8 : 1, minWidth: 0, alignItems: isBar ? 'center' : 'stretch' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span style={{ ...f, fontWeight: m.isMe ? 800 : f.fontWeight, color: m.isMe ? accent : f.color }}>{m.name}{m.isLeader ? ' 👑' : ''}</span>
                                {chips.length > 0 && <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>{chips}</span>}
                            </div>
                            {top && !isBar && <div style={{ paddingLeft: 2, ...clip }}>{top}</div>}
                            {top && isBar && top}
                        </div>
                    );
                })}
            </div>
        );
    }

    // ─── Buscando partida ────────────────────────────────────────────────────
    if (screen === 'matchmaking' && on('searchTime')) {
        const since = new Date(phase.updatedAt).getTime();
        const secs = Math.max(0, Math.floor((now - since) / 1000));
        blocks.push(<div key="search" style={{ ...font('searchTime', 13), display: 'flex', gap: 6, alignItems: 'baseline' }}><span style={{ color: NEUTRAL, fontSize: '0.85em' }}>{L.searching}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(secs)}</span></div>);
    }

    // ─── Selección de campeón ────────────────────────────────────────────────
    if (screen === 'champselect' && phase.champSelect) {
        const cs = phase.champSelect;
        const label = (t: string) => <span style={{ ...caption(t), width: 44, flexShrink: 0 }}>{t}</span>;
        const row = (key: string, text: string, picks: typeof cs.myTeam, mine: boolean) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {label(text)}
                {picks.map(p => <ChampIcon key={p.cellId} champ={p.champion} size={compact ? 26 : 30} ring={mine && p.isMe ? accent : undefined} dim={!!p.champion && !p.locked && !p.isMe} />)}
            </div>
        );
        const head: ReactNode[] = [];
        if (on('timer') && cs.remainingMs != null) head.push(<span key="t" style={{ ...font('timer', 12), fontVariantNumeric: 'tabular-nums' }}>{Math.max(0, Math.ceil(cs.remainingMs / 1000))}s</span>);
        if (on('yourTurn') && cs.myTurn) head.push(<span key="y" style={{ ...font('yourTurn', 12), color: accent }}>{L.yourTurn}</span>);
        if (cs.myPick) head.push(<span key="p" style={{ ...font('timer', 12), color: NEUTRAL }}>{cs.myPick.name}{cs.myPosition ? ` · ${ROLE_LABELS[cs.myPosition] ?? cs.myPosition}` : ''}</span>);
        if (head.length) blocks.push(<div key="cshead" style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>{head}</div>);
        const picks: ReactNode[] = [];
        if (on('myTeamPicks')) picks.push(row('my', L.team, cs.myTeam, true));
        if (on('theirTeamPicks') && cs.theirTeam.length) picks.push(row('their', L.enemy, cs.theirTeam, false));
        if (on('bans') && (cs.myBans.length || cs.theirBans.length)) picks.push(
            <div key="bans" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {label(L.bans)}
                {[...cs.myBans, ...cs.theirBans].map((b, i) => <div key={`${b.id}-${i}`} style={{ position: 'relative' }}><ChampIcon champ={b} size={20} dim /><span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LOSS, fontWeight: 900, fontSize: 14 }}>✕</span></div>)}
            </div>
        );
        if (picks.length) blocks.push(<div key="picks" style={{ display: 'flex', flexDirection: isBar ? 'row' : 'column', gap: isBar ? 12 : 5, ...font('myTeamPicks', 12) }}>{picks}</div>);
        if (on('coachSay') && phase.coach) blocks.push(<CoachSayBlock key="coach" live={phase} font={font('coachSay', 13)} accent={accent} compact={compact} />);
    }

    // ─── En partida ──────────────────────────────────────────────────────────
    if (screen === 'ingame') {
        const g = phase.game;
        const started = g?.startedAt ? new Date(g.startedAt).getTime() : null;
        const elapsed = started ? Math.max(0, (now - started) / 1000) : null;
        const parts: ReactNode[] = [];
        if (on('champion') && g?.champion) parts.push(<span key="c" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><ChampIcon champ={g.champion} size={compact ? 26 : 34} ring={accent} /><span style={{ ...font('champion', 14), ...clip }}>{g.champion.name}{g.position ? <span style={{ color: NEUTRAL, fontWeight: 500, fontSize: '0.8em' }}> · {ROLE_LABELS[g.position] ?? g.position}</span> : null}</span></span>);
        if (on('gameTime') && elapsed != null) parts.push(<span key="t" style={{ ...font('gameTime', 13), fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(elapsed)}</span>);
        if (parts.length) blocks.push(<div key="game" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>{parts}</div>);
        if (on('prediction') && phase.prediction) blocks.push(<PredictionBlock key="pred" live={phase} font={font('prediction', 13)} L={L} accent={accent} now={now} compact={compact} />);
    }

    // ─── Fin de partida ──────────────────────────────────────────────────────
    if (screen === 'postgame') {
        const pg = phase.postGame;
        if (pg) {
            const color = pg.win ? WIN : LOSS;
            const kda = pg.deaths === 0 ? pg.kills + pg.assists : (pg.kills + pg.assists) / pg.deaths;
            blocks.push(
                <div key="result" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: compact ? '4px 8px' : '8px 10px', borderRadius: 8, background: pg.win ? 'rgba(74,222,128,.12)' : 'rgba(248,113,113,.12)', borderLeft: `3px solid ${color}`, minWidth: 0 }}>
                    <ChampIcon champ={pg.champion} size={compact ? 30 : 40} ring={color} />
                    <div style={{ display: 'flex', flexDirection: isBar ? 'row' : 'column', gap: isBar ? 12 : 3, alignItems: isBar ? 'baseline' : 'stretch', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            {on('result') && <span style={{ ...font('result', 16), color }}>{pg.win ? L.victory : L.defeat}</span>}
                            {on('lpDelta') && pg.pointsDelta != null && <span style={{ ...font('lpDelta', 14), color: pg.pointsDelta >= 0 ? WIN : LOSS }}>{pg.pointsDelta > 0 ? '+' : ''}{pg.pointsDelta} LP</span>}
                            <span style={{ ...font('stats', 12), color: NEUTRAL }}>{fmtDuration(pg.durationSeconds)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                            {on('kda') && <span style={font('kda', 14)}>{pg.kills}/{pg.deaths}/{pg.assists} <span style={{ color: NEUTRAL, fontSize: '0.8em', fontWeight: 500 }}>{kda.toFixed(1)} KDA</span></span>}
                            {on('stats') && <span style={{ ...font('stats', 12), display: 'flex', gap: 8 }}>{pg.cs != null && <span>{pg.cs} CS</span>}{pg.damage != null && <span>{fmtK(pg.damage)} DMG</span>}{pg.visionScore != null && <span>{pg.visionScore} VS</span>}</span>}
                        </div>
                    </div>
                </div>
            );
        }
        if (on('coachSay') && phase.coach) blocks.push(<CoachSayBlock key="coach" live={phase} font={font('coachSay', 13)} accent={accent} compact={compact} />);
        if (on('coachTips') && phase.coach?.tips?.length) blocks.push(
            <ul key="tips" style={{ ...font('coachTips', 12), whiteSpace: 'normal', margin: 0, paddingLeft: 16, display: 'flex', flexDirection: isBar ? 'row' : 'column', gap: isBar ? 14 : 2, listStyle: isBar ? 'none' : 'disc' }}>
                {phase.coach.tips.slice(0, 3).map((t, i) => <li key={i}>{t}</li>)}
            </ul>
        );
        if (on('prediction') && phase.prediction) blocks.push(<PredictionBlock key="pred" live={phase} font={font('prediction', 13)} L={L} accent={accent} now={now} compact={compact} />);
    }

    if (blocks.length === 0) return null;

    if (isBar) {
        return (
            <LiveBox config={config} animation={animation} measure={measure} style={{ padding: '6px 18px', alignItems: 'center', gap: 14 }}>
                {blocks.flatMap((b, i) => i === 0 ? [b] : [<span key={`sep-${i}`} style={{ display: 'contents' }}>{sep}</span>, b])}
            </LiveBox>
        );
    }
    return (
        <LiveBox config={config} animation={animation} measure={measure} style={{ padding: compact ? '10px 14px' : '14px 18px', flexDirection: 'column', gap: compact ? 6 : 10 }}>
            {blocks}
        </LiveBox>
    );
}
