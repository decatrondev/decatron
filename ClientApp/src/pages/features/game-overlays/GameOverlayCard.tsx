/**
 * Tarjeta del overlay de juegos: una cuenta, un juego. Renderiza los elementos
 * (emblema, rango, puntos, sesion, ultimas partidas, nombre, campeon en vivo)
 * segun el layout y la visibilidad/fuentes de la config. Es el mismo componente
 * que usa el editor para el preview, asi lo que se ve en el panel es lo que sale
 * en OBS.
 */
import { CSSProperties } from 'react';
import { AccountOverlayState, AccountStats, ElementConfig, FontStyle, GameId, GameVisualConfig, MatchSummary, PointsSample, ROLE_LABELS, SessionState } from './types';

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
}

export interface CardLabels {
    today: string; inGame: string; noMatches: string;
    winrate: string; last: string; season: string; streakWin: string; streakLoss: string; topChamps: string; mastery: string; lpGraph: string; games: string;
}
export const CARD_LABELS: Record<'es' | 'en', CardLabels> = {
    es: { today: 'Hoy', inGame: 'En partida', noMatches: 'Sin partidas en esta sesión', winrate: 'Winrate', last: 'últimas', season: 'temporada', streakWin: 'victorias seguidas', streakLoss: 'derrotas seguidas', topChamps: 'Top campeones', mastery: 'Maestría', lpGraph: 'LP de hoy', games: 'partidas' },
    en: { today: 'Today', inGame: 'In game', noMatches: 'No matches this session', winrate: 'Winrate', last: 'last', season: 'season', streakWin: 'win streak', streakLoss: 'loss streak', topChamps: 'Top champions', mastery: 'Mastery', lpGraph: "Today's LP", games: 'games' },
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

export function GameOverlayCard({ game, gameName, config, account, aggregate, accountIndex, accountCount, switchAnimation, formatTier, labels }: Props) {
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

    if (layout === 'emblem-only') {
        return (
            <div style={{ ...bg, padding: 10, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: switchAnim, borderLeft: `3px solid ${accent}` }}>
                {rank?.emblem && <img src={rank.emblem} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: emblemSize, height: emblemSize, objectFit: 'contain' }} />}
                {isVisible('rank') && <div style={fontStyle(el.rank?.font, 18)}>{rankText}</div>}
                {isVisible('lp') && pointsText && <div style={fontStyle(el.lp?.font, 13)}>{pointsText}</div>}
            </div>
        );
    }

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
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, ...fontStyle(el.session?.font, 15) }}>
                    <span style={{ color: NEUTRAL, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{L.today}</span>
                    <span><span style={{ color: WIN }}>{wins}W</span> <span style={{ color: NEUTRAL }}>·</span> <span style={{ color: LOSS }}>{losses}L</span></span>
                    {el.session?.showDelta !== false && deltaText && <span style={{ color: deltaColor, fontWeight: 700 }}>{deltaText}</span>}
                </div>
            )}

            {/* Ultimas partidas */}
            {isVisible('recent') && session && (
                <RecentMatches matches={session.matches} cfg={el.recent ?? { visible: true }} noMatches={L.noMatches} />
            )}

            {/* Estadísticas (fase "LoL enriquecido") */}
            <StatsBlocks el={el} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={isVisible} />

            {/* Partida en vivo */}
            {isVisible('liveCharacter') && account.live?.inGame && (
                <div style={{ ...fontStyle(el.liveCharacter?.font, 13), display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: LOSS, boxShadow: `0 0 6px ${LOSS}` }} />
                    {account.live.characterIcon && <img src={account.live.characterIcon} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                    <span>{L.inGame}{account.live.character ? ` · ${account.live.character}` : ''}</span>
                </div>
            )}
        </div>
    );
}
