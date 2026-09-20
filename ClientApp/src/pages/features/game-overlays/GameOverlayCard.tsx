/**
 * Tarjeta del overlay de juegos: una cuenta, un juego. Renderiza los elementos
 * (emblema, rango, puntos, sesion, ultimas partidas, nombre, campeon en vivo)
 * segun el layout y la visibilidad/fuentes de la config. Es el mismo componente
 * que usa el editor para el preview, asi lo que se ve en el panel es lo que sale
 * en OBS.
 */
import { CSSProperties, useEffect, useState } from 'react';
import { AccountOverlayState, AccountStats, ElementConfig, FontStyle, GameId, GameVisualConfig, LivePhaseInfo, MatchSummary, PointsSample, ROLE_LABELS, SessionState } from './types';
import { CardView, PROMO_MESSAGES } from './slides';

interface Props {
    game: GameId;
    gameName: string;
    config: GameVisualConfig;
    account: AccountOverlayState;
    aggregate?: { wins: number; losses: number; pointsDelta: number | null } | null;
    accountIndex: number;
    accountCount: number;
    switchAnimation: 'fade' | 'slide' | 'none';
    formatTier: (tier: string) => string;
    /** Textos fijos de la tarjeta (por defecto en español; el overlay usa el idioma del canal). */
    labels?: Partial<CardLabels>;
    /** Vista actual de la rotación (ver slides.ts). undefined = principal. */
    view?: CardView;
    lang?: 'es' | 'en';
}

/** Tarjeta de Decatron: logo completo + mensaje + decatron.net. Tapa la tarjeta de la cuenta unos segundos. */
export function PromoCard({ config, lang = 'es', animation }: { config: GameVisualConfig; lang?: 'es' | 'en'; animation?: string }) {
    const accent = config.accent ?? '#3b82f6';
    const bg: CSSProperties = config.background.type === 'transparent'
        ? { background: 'rgba(15,17,21,.9)', borderRadius: 12 }
        : { background: hexToRgba(config.background.color, Math.max(config.background.opacity, 70)), borderRadius: config.background.radius };
    const msgs = PROMO_MESSAGES[lang];
    const line = msgs.lines[Math.floor(Date.now() / 60000) % msgs.lines.length];
    const url = <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: 0.5 }}>decatron<span style={{ color: '#3b82f6' }}>.net</span></div>;
    if (config.layout === 'bar') {
        return (
            <div style={{ ...bg, borderRadius: config.background.type === 'transparent' ? 0 : Math.min(config.background.radius, 8), boxShadow: '0 4px 16px rgba(0,0,0,.35)', borderTop: `3px solid ${accent}`, padding: '6px 18px', display: 'inline-flex', alignItems: 'center', gap: 18, minWidth: 520, animation, fontFamily: 'Inter, system-ui, sans-serif' }}>
                <img src="/brand/decatron-lockup-light.png" alt="Decatron" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
                <span style={{ width: 1, height: 26, background: 'rgba(255,255,255,.12)' }} />
                <div style={{ fontSize: 12, color: '#c9d1d9', whiteSpace: 'normal', maxWidth: 320 }}>{line}</div>
                <span style={{ width: 1, height: 26, background: 'rgba(255,255,255,.12)' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 9, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1 }}>{msgs.title}</span>{url}</div>
            </div>
        );
    }
    return (
        <div style={{ ...bg, boxShadow: '0 4px 16px rgba(0,0,0,.35)', borderLeft: `3px solid ${accent}`, padding: '14px 18px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 280, maxWidth: 360, animation, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}>
            <img src="/brand/decatron-lockup-light.png" alt="Decatron" style={{ width: 200, height: 'auto', objectFit: 'contain' }} />
            <div style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.3, whiteSpace: 'normal' }}>{line}</div>
            <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1 }}>{msgs.title}</div>
            {url}
        </div>
    );
}

export interface CardLabels {
    today: string; inGame: string; noMatches: string;
    winrate: string; last: string; season: string; streakWin: string; streakLoss: string; topChamps: string; mastery: string; lpGraph: string; games: string;
    lobby: string; matchmaking: string; champSelect: string; postGame: string; victory: string; defeat: string; yourTurn: string; bans: string; team: string; enemy: string;
}
export const CARD_LABELS: Record<'es' | 'en', CardLabels> = {
    es: { today: 'Hoy', inGame: 'En partida', noMatches: 'Sin partidas en esta sesión', winrate: 'Winrate', last: 'últimas', season: 'temporada', streakWin: 'victorias seguidas', streakLoss: 'derrotas seguidas', topChamps: 'Top campeones', mastery: 'Maestría', lpGraph: 'LP de hoy', games: 'partidas',
          lobby: 'En lobby', matchmaking: 'Buscando partida', champSelect: 'Selección de campeón', postGame: 'Fin de partida', victory: 'Victoria', defeat: 'Derrota', yourTurn: '¡Tu turno!', bans: 'Bans', team: 'Equipo', enemy: 'Rival' },
    en: { today: 'Today', inGame: 'In game', noMatches: 'No matches this session', winrate: 'Winrate', last: 'last', season: 'season', streakWin: 'win streak', streakLoss: 'loss streak', topChamps: 'Top champions', mastery: 'Mastery', lpGraph: "Today's LP", games: 'games',
          lobby: 'In lobby', matchmaking: 'Finding match', champSelect: 'Champion select', postGame: 'Game over', victory: 'Victory', defeat: 'Defeat', yourTurn: 'Your turn!', bans: 'Bans', team: 'Team', enemy: 'Enemy' },
};

const WIN = '#4ade80';
const LOSS = '#f87171';
const NEUTRAL = '#8b949e';

function fontStyle(f?: FontStyle, fallbackSize = 14): CSSProperties {
    return {
        fontFamily: f?.family ? `"${f.family}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif',
        fontSize: f?.size ?? fallbackSize,
        fontWeight: f?.weight ?? 500,
        color: f?.color ?? '#ffffff',
        textShadow: f?.shadow ? '0 1px 3px rgba(0,0,0,.6)' : undefined,
        lineHeight: 1.15,
        whiteSpace: 'nowrap',
    };
}

function hexToRgba(hex: string, opacityPct: number): string {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(100, opacityPct)) / 100})`;
}

function RecentMatches({ matches, cfg, noMatches }: { matches: MatchSummary[]; cfg: ElementConfig; noMatches: string }) {
    const count = cfg.count ?? 5;
    const list = matches.filter(m => m.result !== 'remake').slice(0, count);
    if (list.length === 0) return <span style={{ color: NEUTRAL, fontSize: 12, fontFamily: 'Inter, sans-serif' }}>{noMatches}</span>;

    if (cfg.style === 'icons') {
        return (
            <div style={{ display: 'flex', gap: 5 }}>
                {list.map(m => (
                    <div key={m.id} title={`${m.character ?? ''} ${m.kills ?? ''}/${m.deaths ?? ''}/${m.assists ?? ''}`} style={{
                        width: 30, height: 30, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                        border: `2px solid ${m.result === 'win' ? WIN : LOSS}`, background: '#1c1f26', boxShadow: '0 1px 2px rgba(0,0,0,.4)',
                    }}>
                        {m.characterIcon
                            ? <img src={m.characterIcon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: m.result === 'win' ? WIN : LOSS, fontFamily: 'Inter, sans-serif' }}>{m.result === 'win' ? 'W' : 'L'}</div>}
                    </div>
                ))}
            </div>
        );
    }

    if (cfg.style === 'cards') {
        return (
            <div style={{ display: 'flex', gap: 6 }}>
                {list.map(m => (
                    <div key={m.id} title={m.character ?? ''} style={{
                        minWidth: 44, padding: '4px 6px', borderRadius: 6, textAlign: 'center',
                        background: m.result === 'win' ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)',
                        borderBottom: `2px solid ${m.result === 'win' ? WIN : LOSS}`,
                        fontFamily: 'Inter, sans-serif', color: '#e6edf3',
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{m.result === 'win' ? 'W' : 'L'}</div>
                        {m.kills != null && <div style={{ fontSize: 10, color: NEUTRAL }}>{m.kills}/{m.deaths}/{m.assists}</div>}
                        {m.placement != null && <div style={{ fontSize: 10, color: NEUTRAL }}>#{m.placement}</div>}
                    </div>
                ))}
            </div>
        );
    }

    // dots (default): mas reciente a la izquierda
    return (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {list.map(m => (
                <span key={m.id} title={m.character ?? ''} style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: m.result === 'win' ? WIN : m.result === 'loss' ? LOSS : NEUTRAL,
                    boxShadow: '0 1px 2px rgba(0,0,0,.4)',
                }} />
            ))}
        </div>
    );
}

function fmtK(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)); }

function ChampRow({ name, icon, right, sub, font }: { name: string; icon?: string | null; right: string; sub?: string; font: CSSProperties }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 5, overflow: 'hidden', background: '#1c1f26', flexShrink: 0 }}>
                {icon && <img src={icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
            </div>
            <div style={{ ...font, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                {sub && <span style={{ fontSize: '0.8em', color: NEUTRAL }}>{sub}</span>}
            </div>
            <span style={{ ...font, fontWeight: 700 }}>{right}</span>
        </div>
    );
}

function LpGraph({ history, height, accent, label }: { history: PointsSample[]; height: number; accent: string; label: string }) {
    if (history.length < 2) return null;
    const w = 220, h = height, pad = 3;
    const vals = history.map(p => p.absolute);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = Math.max(1, max - min);
    const x = (i: number) => pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
    const d = history.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.absolute).toFixed(1)}`).join(' ');
    const delta = vals[vals.length - 1] - vals[0];
    const color = delta > 0 ? WIN : delta < 0 ? LOSS : accent;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: NEUTRAL, fontFamily: 'Inter, sans-serif' }}>
                <span>{label}</span><span style={{ color, fontWeight: 700 }}>{delta > 0 ? '+' : ''}{delta}</span>
            </div>
            <svg width={w} height={h} style={{ display: 'block' }}>
                <path d={`${d} L${x(history.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`} fill={color} opacity={0.15} />
                <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(history.length - 1)} cy={y(vals[vals.length - 1])} r={3} fill={color} />
            </svg>
        </div>
    );
}

/** Reloj de 1 s solo mientras hay partida en curso (para el mm:ss). */
function useTicker(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [active]);
    return now;
}

function fmtDuration(sec: number): string { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${s.toString().padStart(2, '0')}`; }

function ChampIcon({ champ, size = 30, ring, dim }: { champ?: { name: string; icon?: string | null } | null; size?: number; ring?: string; dim?: boolean }) {
    return (
        <div title={champ?.name ?? ''} style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden', background: '#1c1f26', flexShrink: 0, border: ring ? `2px solid ${ring}` : '2px solid transparent', opacity: dim ? 0.45 : 1, boxShadow: ring ? `0 0 8px ${ring}` : undefined }}>
            {champ?.icon && <img src={champ.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
        </div>
    );
}

/** Línea de estado en vivo: lobby / buscando / selección / en partida mm:ss / fin. Reemplaza al "En partida" de la Riot API cuando hay Desktop. */
function LiveStatusLine({ live, font, L, accent, now }: { live: LivePhaseInfo; font: CSSProperties; L: CardLabels; accent: string; now: number }) {
    const dot = (color: string) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />;
    const row = (children: JSX.Element | (JSX.Element | string | null)[]) => <div style={{ ...font, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>;
    switch (live.phase) {
        case 'lobby': {
            const others = live.lobby.filter(m => !m.isMe).map(m => m.name);
            return row([dot(NEUTRAL), <span key="t">{L.lobby}{live.queueName ? ` · ${live.queueName}` : ''}{others.length ? ` · ${others.join(', ')}` : ''}</span>]);
        }
        case 'matchmaking':
            return row([dot(accent), <span key="t">{L.matchmaking}{live.queueName ? ` · ${live.queueName}` : ''}</span>]);
        case 'champselect': {
            const cs = live.champSelect;
            return row([dot(accent), <span key="t">{L.champSelect}{cs?.myPick ? ` · ${cs.myPick.name}` : ''}{cs?.myTurn ? <span style={{ color: accent, marginLeft: 6, fontWeight: 800 }}>{L.yourTurn}</span> : null}</span>]);
        }
        case 'ingame': {
            const g = live.game;
            const started = g?.startedAt ? new Date(g.startedAt).getTime() : null;
            const elapsed = started ? Math.max(0, (now - started) / 1000) : null;
            return row([dot(LOSS), g?.champion && <ChampIcon key="i" champ={g.champion} size={20} />, <span key="t">{L.inGame}{g?.champion ? ` · ${g.champion.name}` : ''}{g?.position ? ` · ${ROLE_LABELS[g.position] ?? g.position}` : ''}{elapsed != null ? ` · ${fmtDuration(elapsed)}` : ''}</span>]);
        }
        case 'postgame': {
            const pg = live.postGame;
            if (!pg) return row([dot(NEUTRAL), <span key="t">{L.postGame}</span>]);
            return row([dot(pg.win ? WIN : LOSS), <span key="t" style={{ color: pg.win ? WIN : LOSS, fontWeight: 800 }}>{pg.win ? L.victory : L.defeat}</span>, <span key="k">{pg.kills}/{pg.deaths}/{pg.assists}</span>]);
        }
        default:
            return null;
    }
}

/** Selección de campeón en vivo: picks de mi equipo (el mío resaltado) vs. rival, y bans. */
function ChampSelectBlock({ live, font, L, accent }: { live: LivePhaseInfo; font: CSSProperties; L: CardLabels; accent: string }) {
    const cs = live.champSelect;
    if (!cs) return null;
    const label = (t: string) => <span style={{ color: NEUTRAL, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', width: 44, flexShrink: 0 }}>{t}</span>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...font }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {label(L.team)}
                {cs.myTeam.map(p => <ChampIcon key={p.cellId} champ={p.champion} ring={p.isMe ? accent : p.locked ? undefined : undefined} dim={!!p.champion && !p.locked && !p.isMe} />)}
            </div>
            {cs.theirTeam.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {label(L.enemy)}
                    {cs.theirTeam.map(p => <ChampIcon key={p.cellId} champ={p.champion} dim={!!p.champion && !p.locked} />)}
                </div>
            )}
            {(cs.myBans.length > 0 || cs.theirBans.length > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {label(L.bans)}
                    {[...cs.myBans, ...cs.theirBans].map((b, i) => <div key={`${b.id}-${i}`} style={{ position: 'relative' }}><ChampIcon champ={b} size={20} dim /><span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LOSS, fontWeight: 900, fontSize: 14 }}>✕</span></div>)}
                </div>
            )}
        </div>
    );
}

/** Tarjeta de fin de partida: resultado, KDA, CS, daño, duración, ±LP. */
function PostGameBlock({ live, font, L }: { live: LivePhaseInfo; font: CSSProperties; L: CardLabels }) {
    const pg = live.postGame;
    if (!pg) return null;
    const color = pg.win ? WIN : LOSS;
    const kda = pg.deaths === 0 ? pg.kills + pg.assists : (pg.kills + pg.assists) / pg.deaths;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 8, background: pg.win ? 'rgba(74,222,128,.12)' : 'rgba(248,113,113,.12)', borderLeft: `3px solid ${color}` }}>
            <ChampIcon champ={pg.champion} size={40} ring={color} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, ...font }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ color, fontWeight: 800, fontSize: '1.15em' }}>{pg.win ? L.victory : L.defeat}</span>
                    {pg.pointsDelta != null && <span style={{ color: pg.pointsDelta >= 0 ? WIN : LOSS, fontWeight: 700 }}>{pg.pointsDelta > 0 ? '+' : ''}{pg.pointsDelta} LP</span>}
                    <span style={{ color: NEUTRAL, fontSize: '0.8em' }}>{fmtDuration(pg.durationSeconds)}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: '0.9em' }}>
                    <span><b>{pg.kills}/{pg.deaths}/{pg.assists}</b> <span style={{ color: NEUTRAL, fontSize: '0.85em' }}>{kda.toFixed(1)} KDA</span></span>
                    {pg.cs != null && <span>{pg.cs} CS</span>}
                    {pg.damage != null && <span>{fmtK(pg.damage)} DMG</span>}
                    {pg.visionScore != null && <span>{pg.visionScore} VS</span>}
                </div>
            </div>
        </div>
    );
}

/** Lo último que dijo el coach: nombre + comentario como subtítulo, y la sugerencia/matchup como chip. */
function CoachSayBlock({ live, font, accent, compact }: { live: LivePhaseInfo; font: CSSProperties; accent: string; compact?: boolean }) {
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

function StatsBlocks({ el, stats, session, rank, L, accent, isVisible }: {
    el: GameVisualConfig['elements']; stats?: AccountStats | null; session?: SessionState | null; rank?: AccountOverlayState['rank'];
    L: CardLabels; accent: string; isVisible: (id: keyof GameVisualConfig['elements']) => boolean;
}) {
    const hasSession = !!session && session.wins >= 0 && session.losses >= 0;
    const blocks: JSX.Element[] = [];

    if (isVisible('winrate')) {
        const scope = el.winrate?.scope ?? 'ranked';
        let value: number | null | undefined; let sub = '';
        if (scope === 'session' && hasSession) { value = session!.winRate; sub = `${session!.wins}W ${session!.losses}L · ${L.today.toLowerCase()}`; }
        else if (scope === 'recent' && stats) { value = stats.winRate; sub = `${L.last} ${stats.sampleSize} ${L.games}`; }
        else if (rank && !rank.isUnranked) { value = rank.winRate; sub = `${rank.wins}W ${rank.losses}L · ${L.season}`; }
        if (value != null) {
            const color = value >= 55 ? WIN : value < 45 ? LOSS : '#e6edf3';
            blocks.push(
                <div key="winrate" style={{ display: 'flex', alignItems: 'baseline', gap: 8, ...fontStyle(el.winrate?.font, 14) }}>
                    <span style={{ color: NEUTRAL, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{L.winrate}</span>
                    <span style={{ color, fontWeight: 700 }}>{Math.round(value)}%</span>
                    <span style={{ color: NEUTRAL, fontSize: '0.8em' }}>{sub}</span>
                </div>
            );
        }
    }

    if (isVisible('kdaCs') && stats && stats.sampleSize > 0) {
        const metrics = el.kdaCs?.metrics ?? ['kda', 'cs'];
        const parts: { k: string; v: string }[] = [];
        if (metrics.includes('kda') && stats.avgKda != null) parts.push({ k: 'KDA', v: `${stats.avgKda.toFixed(1)} (${stats.avgKills?.toFixed(1)}/${stats.avgDeaths?.toFixed(1)}/${stats.avgAssists?.toFixed(1)})` });
        if (metrics.includes('cs') && stats.avgCsPerMin != null) parts.push({ k: 'CS/min', v: stats.avgCsPerMin.toFixed(1) });
        if (metrics.includes('damage') && stats.avgDamage != null) parts.push({ k: 'DMG', v: fmtK(stats.avgDamage) });
        if (metrics.includes('vision') && stats.avgVisionScore != null) parts.push({ k: 'VS', v: stats.avgVisionScore.toFixed(0) });
        if (parts.length) blocks.push(
            <div key="kdaCs" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, ...fontStyle(el.kdaCs?.font, 13) }}>
                {parts.map(p => <span key={p.k}><span style={{ color: NEUTRAL, fontSize: '0.8em', marginRight: 4 }}>{p.k}</span>{p.v}</span>)}
                {stats.mainRole && <span style={{ color: accent, fontSize: '0.8em', fontWeight: 700 }}>{ROLE_LABELS[stats.mainRole] ?? stats.mainRole}</span>}
            </div>
        );
    }

    if (isVisible('streak')) {
        const streak = hasSession && session!.streak ? session!.streak : stats?.streak ?? 0;
        if (Math.abs(streak) >= 2) blocks.push(
            <div key="streak" style={{ display: 'flex', alignItems: 'center', gap: 6, ...fontStyle(el.streak?.font, 13) }}>
                <span style={{ color: streak > 0 ? WIN : LOSS }}>{streak > 0 ? '🔥' : '❄️'} {Math.abs(streak)}</span>
                <span style={{ color: NEUTRAL, fontSize: '0.85em' }}>{streak > 0 ? L.streakWin : L.streakLoss}</span>
            </div>
        );
    }

    if (isVisible('topChamps') && stats && stats.topCharacters.length) {
        const font = fontStyle(el.topChamps?.font, 12);
        blocks.push(
            <div key="topChamps" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: NEUTRAL, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>{L.topChamps}</span>
                {stats.topCharacters.slice(0, el.topChamps?.count ?? 3).map(c => (
                    <ChampRow key={c.name} name={c.name} icon={c.icon} font={font}
                        right={`${c.winRate ?? Math.round(100 * c.wins / Math.max(1, c.games))}%`}
                        sub={`${c.wins}W ${c.losses}L${c.avgKda != null ? ` · ${c.avgKda.toFixed(1)} KDA` : ''}`} />
                ))}
            </div>
        );
    }

    if (isVisible('mastery') && stats && stats.mastery.length) {
        const font = fontStyle(el.mastery?.font, 12);
        blocks.push(
            <div key="mastery" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: NEUTRAL, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>{L.mastery}</span>
                {stats.mastery.slice(0, el.mastery?.count ?? 3).map(m => (
                    <ChampRow key={m.name} name={m.name} icon={m.icon} font={font} right={`M${m.level}`} sub={`${fmtK(m.points)} pts`} />
                ))}
            </div>
        );
    }

    if (isVisible('lpGraph') && hasSession && session!.pointsHistory && session!.pointsHistory.length >= 2) {
        blocks.push(<LpGraph key="lpGraph" history={session!.pointsHistory} height={el.lpGraph?.height ?? 48} accent={accent} label={L.lpGraph} />);
    }

    return blocks.length ? <>{blocks}</> : null;
}

export function GameOverlayCard({ game, gameName, config, account, aggregate, accountIndex, accountCount, switchAnimation, formatTier, labels, view, lang }: Props) {
    const L = { ...CARD_LABELS.es, ...labels };
    const el = config.elements;
    const accent = config.accent ?? '#c8aa6e';
    const rank = account.rank;
    const session = account.session;
    // Offline (canal sin stream) el backend manda wins/losses = -1: hay rango y
    // partidas pero no sesion -> se oculta la fila "Hoy".
    const hasSession = !!session && session.wins >= 0 && session.losses >= 0;
    const wins = aggregate?.wins ?? session?.wins ?? 0;
    const losses = aggregate?.losses ?? session?.losses ?? 0;
    const delta = aggregate ? aggregate.pointsDelta : session?.pointsDelta ?? null;
    const pointsLabel = rank?.pointsLabel ?? '';
    const isVisible = (id: keyof typeof el) => el[id]?.visible !== false;
    const live = account.livePhase && account.livePhase.phase !== 'none' ? account.livePhase : null;
    const now = useTicker(live?.phase === 'ingame');

    const bg: CSSProperties = config.background.type === 'transparent'
        ? {}
        : { background: hexToRgba(config.background.color, config.background.opacity), borderRadius: config.background.radius, boxShadow: '0 4px 16px rgba(0,0,0,.35)' };

    const switchAnim = switchAnimation === 'none' ? undefined : `go-${switchAnimation}-in 0.35s ease`;
    const emblemSize = el.emblem?.size ?? 96;

    const rankText = rank
        ? `${formatTier(rank.tier)}${rank.division ? ` ${rank.division}` : ''}`
        : '—';
    const queueTag = rank?.queue === 'RANKED_FLEX_SR' ? 'Flex' : null;
    const pointsText = rank && !rank.isUnranked && rank.points != null
        ? `${rank.points} ${pointsLabel}${rank.isExact ? '' : ' ≈'}`.trim()
        : rank?.isUnranked ? '' : '';

    const deltaText = delta == null ? null : `${delta > 0 ? '+' : ''}${delta}${pointsLabel ? ' ' + pointsLabel : ''}`;
    const deltaColor = delta == null ? NEUTRAL : delta > 0 ? WIN : delta < 0 ? LOSS : NEUTRAL;

    const layout = config.layout;
    const horizontal = layout === 'compact' || layout === 'bar';

    if (view === 'promo') return <PromoCard config={config} lang={lang} animation={switchAnim} />;

    if (layout === 'emblem-only') {
        return (
            <div style={{ ...bg, padding: 10, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: switchAnim, borderLeft: `3px solid ${accent}` }}>
                {rank?.emblem && <img src={rank.emblem} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: emblemSize, height: emblemSize, objectFit: 'contain' }} />}
                {isVisible('rank') && <div style={fontStyle(el.rank?.font, 18)}>{rankText}</div>}
                {isVisible('lp') && pointsText && <div style={fontStyle(el.lp?.font, 13)}>{pointsText}</div>}
            </div>
        );
    }

    // Vistas de la rotación ("tipo GIF"): misma cabecera, cuerpo distinto. Fuerzan
    // visibles los elementos de la vista aunque estén apagados en la principal.
    if (view && view !== 'main') {
        const header = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {rank?.emblem && <img src={rank.emblem} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: emblemSize * 0.5, height: emblemSize * 0.5, objectFit: 'contain', flexShrink: 0 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ ...fontStyle(el.rank?.font, 26), fontSize: (el.rank?.font?.size ?? 26) * 0.7 }}>{rankText}{pointsText ? <span style={{ ...fontStyle(el.lp?.font, 16), fontSize: '0.65em', marginLeft: 8 }}>{pointsText}</span> : null}</div>
                    {isVisible('accountName') && <div style={fontStyle(el.accountName?.font, 13)}>{account.displayName}</div>}
                </div>
            </div>
        );
        const on = (ids: (keyof typeof el)[], extra?: Partial<Record<keyof typeof el, Partial<ElementConfig>>>) => {
            const e: typeof el = { ...el };
            for (const id of ids) e[id] = { ...(el[id] ?? { visible: true }), ...(extra?.[id] ?? {}), visible: true };
            return e;
        };
        let body: JSX.Element | null = null;
        if (view === 'stats') {
            const e = on(['winrate', 'kdaCs', 'streak'], { winrate: { scope: el.winrate?.scope ?? 'recent' }, kdaCs: { metrics: el.kdaCs?.metrics?.length ? el.kdaCs.metrics : ['kda', 'cs', 'damage', 'vision'] } });
            body = <StatsBlocks el={e} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={id => ['winrate', 'kdaCs', 'streak'].includes(id as string)} />;
        } else if (view === 'champs') {
            const e = on(['topChamps', 'mastery']);
            body = <div style={{ display: 'flex', gap: 18 }}><StatsBlocks el={e} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={id => ['topChamps', 'mastery'].includes(id as string)} /></div>;
        } else if (view === 'graph') {
            const e = on(['lpGraph'], { lpGraph: { height: Math.max(el.lpGraph?.height ?? 48, 64) } });
            body = (
                <>
                    {(hasSession || aggregate) && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, ...fontStyle(el.session?.font, 15), fontSize: (el.session?.font?.size ?? 15) * 1.2 }}>
                            <span style={{ color: NEUTRAL, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{L.today}</span>
                            <span><span style={{ color: WIN }}>{wins}W</span> <span style={{ color: NEUTRAL }}>·</span> <span style={{ color: LOSS }}>{losses}L</span></span>
                            {deltaText && <span style={{ color: deltaColor, fontWeight: 700 }}>{deltaText}</span>}
                        </div>
                    )}
                    <StatsBlocks el={e} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={id => id === 'lpGraph'} />
                    {session && <RecentMatches matches={session.matches} cfg={{ ...(el.recent ?? { visible: true }), style: el.recent?.style === 'dots' ? 'icons' : el.recent?.style }} noMatches={L.noMatches} />}
                </>
            );
        }
        // En Barra/Compacto la vista también va en horizontal (cabecera | cuerpo) para no cambiar de forma al rotar.
        const isBar = layout === 'bar';
        return (
            <div style={{
                ...bg, padding: horizontal ? (isBar ? '6px 18px' : '10px 16px') : '14px 18px', display: 'inline-flex',
                flexDirection: horizontal ? 'row' : 'column', alignItems: horizontal ? 'center' : 'stretch', gap: horizontal ? 16 : 10,
                minWidth: isBar ? 520 : horizontal ? undefined : 280, animation: switchAnim,
                ...(isBar ? { borderTop: `3px solid ${accent}`, borderRadius: config.background.type === 'transparent' ? 0 : Math.min(config.background.radius, 8) } : { borderLeft: `3px solid ${accent}` }),
            }}>
                {isVisible('gameLogo') && <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>{gameName}</div>}
                {header}
                {horizontal ? <div style={{ display: 'flex', flexDirection: isBar ? 'row' : 'column', gap: isBar ? 16 : 6, alignItems: isBar ? 'center' : 'stretch', borderLeft: '1px solid rgba(255,255,255,.12)', paddingLeft: 14 }}>{body}</div> : body}
            </div>
        );
    }

    // Barra: una tira horizontal fina para el borde superior/inferior del stream.
    // Todo en una linea con separadores, sin borde de acento lateral (lleva una linea
    // de acento arriba), y las stats/ultimas partidas van inline en vez de apiladas.
    if (layout === 'bar') {
        const sep = <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />;
        const items: JSX.Element[] = [];
        if (isVisible('emblem') && rank?.emblem) items.push(<img key="emblem" src={rank.emblem} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: emblemSize * 0.4, height: emblemSize * 0.4, objectFit: 'contain', flexShrink: 0 }} />);
        if (isVisible('rank')) items.push(<span key="rank" style={{ ...fontStyle(el.rank?.font, 26), fontSize: (el.rank?.font?.size ?? 26) * 0.7 }}>{rankText}{queueTag ? <span style={{ fontSize: '0.5em', color: accent, marginLeft: 6, letterSpacing: 1 }}>{queueTag.toUpperCase()}</span> : null}</span>);
        if (isVisible('lp') && pointsText) items.push(<span key="lp" style={fontStyle(el.lp?.font, 16)}>{pointsText}</span>);
        if (isVisible('session') && (hasSession || aggregate)) items.push(
            <span key="session" style={{ ...fontStyle(el.session?.font, 15), display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ color: NEUTRAL, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{L.today}</span>
                <span><span style={{ color: WIN }}>{wins}W</span> <span style={{ color: LOSS }}>{losses}L</span></span>
                {el.session?.showDelta !== false && deltaText && <span style={{ color: deltaColor, fontWeight: 700 }}>{deltaText}</span>}
            </span>);
        if (isVisible('recent') && session) items.push(<span key="recent"><RecentMatches matches={session.matches} cfg={{ ...(el.recent ?? { visible: true }), count: Math.min(el.recent?.count ?? 5, 8) }} noMatches="" /></span>);
        const stats = <StatsBlocks el={{ ...el, topChamps: { ...el.topChamps, visible: false }, mastery: { ...el.mastery, visible: false }, lpGraph: { ...el.lpGraph, visible: false } } as typeof el} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={id => el[id]?.visible === true} />;
        if (isVisible('accountName')) items.push(<span key="name" style={{ ...fontStyle(el.accountName?.font, 13), color: el.accountName?.font?.color ?? NEUTRAL }}>{account.displayName}{accountCount > 1 ? ` ${accountIndex + 1}/${accountCount}` : ''}</span>);
        if (live && isVisible('champSelect') && live.phase === 'champselect') items.push(<span key="cs"><ChampSelectBlock live={live} font={fontStyle(el.champSelect?.font, 12)} L={L} accent={accent} /></span>);
        if (live && isVisible('postGame') && live.phase === 'postgame') items.push(<span key="pg"><PostGameBlock live={live} font={fontStyle(el.postGame?.font, 13)} L={L} /></span>);
        if (live && isVisible('coachSay') && live.coach && live.phase !== 'ingame') items.push(<span key="coach"><CoachSayBlock live={live} font={fontStyle(el.coachSay?.font, 12)} accent={accent} compact /></span>);
        if (live && isVisible('liveCharacter')) items.push(<span key="live"><LiveStatusLine live={live} font={fontStyle(el.liveCharacter?.font, 13)} L={L} accent={accent} now={now} /></span>);
        else if (isVisible('liveCharacter') && account.live?.inGame) items.push(
            <span key="live" style={{ ...fontStyle(el.liveCharacter?.font, 13), display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: LOSS, boxShadow: `0 0 6px ${LOSS}` }} />
                {account.live.characterIcon && <img src={account.live.characterIcon} alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />}
                {L.inGame}{account.live.character ? ` · ${account.live.character}` : ''}
            </span>);
        return (
            <div style={{ ...bg, borderRadius: config.background.type === 'transparent' ? 0 : Math.min(config.background.radius, 8), borderTop: `3px solid ${accent}`, padding: '6px 18px', display: 'inline-flex', alignItems: 'center', gap: 14, minWidth: 520, animation: switchAnim }}>
                {isVisible('gameLogo') && <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>{gameName}</span>}
                {items.flatMap((it, i) => i === 0 ? [it] : [<span key={`sep-${i}`} style={{ display: 'contents' }}>{sep}</span>, it])}
                <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>{stats}</span>
            </div>
        );
    }

    // Compacto: tarjeta chica de dos columnas (emblema | rango + LP + sesion en una
    // fila) pensada para una esquina. Las stats extra se apilan debajo en letra chica.
    return (
        <div style={{
            ...bg,
            padding: horizontal ? '10px 16px' : '14px 18px',
            display: 'inline-flex',
            flexDirection: horizontal ? 'row' : 'column',
            alignItems: horizontal ? 'center' : 'stretch',
            gap: horizontal ? 16 : 10,
            minWidth: horizontal ? undefined : 280,
            borderLeft: `3px solid ${accent}`,
            animation: switchAnim,
        }}>
            {/* Cabecera: emblema + rango + puntos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {isVisible('emblem') && rank?.emblem && (
                    <img src={rank.emblem} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: horizontal ? emblemSize * 0.6 : emblemSize, height: horizontal ? emblemSize * 0.6 : emblemSize, objectFit: 'contain', flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {isVisible('gameLogo') && <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>{gameName}</div>}
                    {isVisible('rank') && (
                        <div style={{ ...fontStyle(el.rank?.font, 26), display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span>{rankText}</span>
                            {queueTag && <span style={{ fontSize: '0.45em', fontWeight: 600, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}>{queueTag}</span>}
                        </div>
                    )}
                    {isVisible('lp') && pointsText && <div style={fontStyle(el.lp?.font, 16)}>{pointsText}</div>}
                    {isVisible('accountName') && (
                        <div style={{ ...fontStyle(el.accountName?.font, 13), display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span>{account.displayName}</span>
                            {accountCount > 1 && <span style={{ color: NEUTRAL, fontSize: 11 }}>{accountIndex + 1}/{accountCount}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Sesion */}
            {isVisible('session') && (hasSession || aggregate) && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, ...fontStyle(el.session?.font, 15), ...(horizontal ? { flexDirection: 'column', gap: 2, borderLeft: '1px solid rgba(255,255,255,.12)', paddingLeft: 14 } : {}) }}>
                    <span style={{ color: NEUTRAL, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{L.today}</span>
                    <span><span style={{ color: WIN }}>{wins}W</span> <span style={{ color: NEUTRAL }}>·</span> <span style={{ color: LOSS }}>{losses}L</span></span>
                    {el.session?.showDelta !== false && deltaText && <span style={{ color: deltaColor, fontWeight: 700 }}>{deltaText}</span>}
                </div>
            )}

            {/* Ultimas partidas */}
            {isVisible('recent') && session && (
                <RecentMatches matches={session.matches} cfg={el.recent ?? { visible: true }} noMatches={L.noMatches} />
            )}

            {/* Estadísticas (fase "LoL enriquecido"); en compacto van en una columna aparte */}
            {horizontal
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '1px solid rgba(255,255,255,.12)', paddingLeft: 14 }}><StatsBlocks el={el} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={isVisible} /></div>
                : <StatsBlocks el={el} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={isVisible} />}

            {/* En vivo desde el Desktop: selección de campeón y fin de partida */}
            {live && isVisible('champSelect') && live.phase === 'champselect' && <ChampSelectBlock live={live} font={fontStyle(el.champSelect?.font, 12)} L={L} accent={accent} />}
            {live && isVisible('postGame') && live.phase === 'postgame' && <PostGameBlock live={live} font={fontStyle(el.postGame?.font, 14)} L={L} />}
            {live && isVisible('coachSay') && live.coach && live.phase !== 'ingame' && <CoachSayBlock live={live} font={fontStyle(el.coachSay?.font, 13)} accent={accent} />}

            {/* Estado en vivo: con Desktop, la fase real; sin Desktop, "En partida" de la Riot API */}
            {isVisible('liveCharacter') && (live
                ? <LiveStatusLine live={live} font={fontStyle(el.liveCharacter?.font, 13)} L={L} accent={accent} now={now} />
                : account.live?.inGame && (
                    <div style={{ ...fontStyle(el.liveCharacter?.font, 13), display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: LOSS, boxShadow: `0 0 6px ${LOSS}` }} />
                        {account.live.characterIcon && <img src={account.live.characterIcon} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                        <span>{L.inGame}{account.live.character ? ` · ${account.live.character}` : ''}</span>
                    </div>
                ))}
        </div>
    );
}
