import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Crown, Tv } from 'lucide-react';
import api from '../services/api';
import { REGION_LABELS, FORTNITE_TEAM_SIZE_LABELS, BRACKET_FORMAT_LABELS, normalizeUrl, useCountdown, AscentLine, RoleBadge } from './tournament-public/shared';
import type { EditionInfo, RankingRow, ParticipantDetail, Sponsor, Prize } from './tournament-public/shared';
import ParticipantDetailView from './tournament-public/ParticipantDetailView';
import BracketSection from './tournament-public/BracketSection';
import TeamsSection from './tournament-public/TeamsSection';
import PlayersSection from './tournament-public/PlayersSection';
import InfoSection from './tournament-public/InfoSection';
import FortniteStandingsSection, { useFortniteStandings, mainScope } from './tournament-public/FortniteStandingsSection';
import MyTournamentModal from './tournament-public/MyTournamentModal';
import RulesModal from './tournament-public/RulesModal';
import { TournamentThemeRoot, BroadcastButton, StatusBug, Chip, SectionTitle, EmptyBlock, PointsBars, CUT, type BarRow } from './tournament-public/broadcast';
import { mix, buildTokens } from './tournament-public/theme';

// Vista publica de un torneo — rediseño "gráfico de transmisión" (2026-09-29, ver
// .dev/torneos/16-rediseno-publico.md). Lleva la marca del streamer (logo, portada,
// colores y fondo claro/oscuro de la pestaña Apariencia) y lo primero que se ve
// cambia segun el estado: inscripciones abiertas → cómo inscribirse y cuándo
// empieza; en curso → en qué va y la clasificación; terminado → el campeón.
//
// "Inscribirme"/"Mi inscripción" abren MyTournamentModal (el panel del jugador, con
// su propia sesion). Las normas van en RulesModal.

type TabId = 'standings' | 'ranking' | 'bracket' | 'teams' | 'players' | 'info';

interface FortniteMatchday {
    sessionName: string;
    sessionStatus: string;
    scheduledAt: string | null;
    gameNumber?: number | null;
    gameStatus?: string | null;
    gamesTotal?: number;
}

const GAME_STATUS_TEXT: Record<string, string> = {
    waiting: 'Por empezar',
    revealed: 'Entrando a la partida',
    playing: 'En juego',
    reporting: 'Reportando resultados',
    closed: 'Terminada',
};

export default function TournamentPublicPage() {
    const { channelName, editionSlug } = useParams<{ channelName: string; editionSlug: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [edition, setEdition] = useState<(EditionInfo & { bannerUrl?: string | null; secondaryColor?: string | null; theme?: string }) | null>(null);
    const [ranking, setRanking] = useState<RankingRow[]>([]);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [matchday, setMatchday] = useState<FortniteMatchday | null>(null);
    const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading');
    const [isLive, setIsLive] = useState(false);
    const [expandedId, setExpandedId] = useState<string | number | null>(null);
    const [detail, setDetail] = useState<ParticipantDetail | null>(null);
    const [bracketChampion, setBracketChampion] = useState<string | null>(null);
    const [showPanelModal, setShowPanelModal] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);

    const running = edition?.status === 'in_progress' || edition?.status === 'check_in';
    const isFortnite = edition?.game === 'fortnite';

    // Datos de la portada; mientras el torneo corre se refrescan (en vivo, en qué partida va).
    useEffect(() => {
        const load = async (first: boolean) => {
            try {
                const [homeRes, prizesRes] = await Promise.all([
                    api.get(`/public/tournament/${channelName}/${editionSlug}`),
                    first ? api.get(`/public/tournament/${channelName}/${editionSlug}/prizes`) : Promise.resolve(null),
                ]);
                if (!homeRes.data?.success) {
                    if (first) setStatus('notfound');
                    return;
                }
                setEdition(homeRes.data.edition);
                setIsLive(!!homeRes.data.isLive);
                setRanking(homeRes.data.ranking || []);
                setSponsors(homeRes.data.sponsors || []);
                setMatchday(homeRes.data.matchday || null);
                if (prizesRes) setPrizes(prizesRes.data?.prizes || []);
                setStatus('ok');
            } catch {
                if (first) setStatus('notfound');
            }
        };
        load(true);
        const t = setInterval(() => load(false), 30000);
        return () => clearInterval(t);
    }, [channelName, editionSlug]);

    useEffect(() => {
        if (edition?.name) document.title = `${edition.name} — Torneo`;
    }, [edition?.name]);

    // En 2K/4K la pagina escala entera (ver html.t-scale en index.css).
    useEffect(() => {
        document.documentElement.classList.add('t-scale');
        return () => document.documentElement.classList.remove('t-scale');
    }, []);

    const fortnite = useFortniteStandings(channelName!, editionSlug!, isFortnite && running);

    // Campeon de un torneo de bracket terminado: ganador de la gran final o de la ultima ronda.
    useEffect(() => {
        if (!edition || edition.game === 'fortnite' || edition.mode === 'solo_q_climb') return;
        if (edition.status !== 'finished' && edition.status !== 'archived') return;
        api.get(`/public/tournament/${channelName}/${editionSlug}/bracket`)
            .then((res) => {
                const matches: { roundNumber: number; bracketSide: string | null; winnerName: string | null }[] = res.data?.matches || [];
                const pool = matches.some((m) => m.bracketSide === 'grand_final') ? matches.filter((m) => m.bracketSide === 'grand_final') : matches;
                const last = [...pool].sort((a, b) => b.roundNumber - a.roundNumber).find((m) => m.winnerName);
                setBracketChampion(last?.winnerName ?? null);
            })
            .catch(() => {});
    }, [edition?.status, edition?.game, edition?.mode, channelName, editionSlug]);

    const tabs = useMemo((): { id: TabId; label: string }[] => {
        if (!edition) return [];
        const single = edition.teamSize === 1;
        if (isFortnite)
            return [
                { id: 'standings', label: 'Clasificación' },
                ...(single ? [] : [{ id: 'teams' as TabId, label: 'Equipos' }]),
                { id: 'players', label: 'Jugadores' },
                { id: 'info', label: 'Info' },
            ];
        if (edition.mode === 'solo_q_climb')
            return [
                { id: 'ranking', label: 'Clasificación' },
                { id: 'info', label: 'Info' },
            ];
        return [
            { id: 'bracket', label: 'Bracket' },
            ...(single ? [] : [{ id: 'teams' as TabId, label: 'Equipos' }]),
            { id: 'players', label: 'Jugadores' },
            { id: 'info', label: 'Info' },
        ];
    }, [edition, isFortnite]);

    const activeTab = tabs.find((t) => t.id === searchParams.get('tab'))?.id || tabs[0]?.id;
    const setActiveTab = (tab: string) =>
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set('tab', tab);
                return next;
            },
            { replace: true },
        );

    const bannerSponsors = sponsors.filter((s) => s.slots.includes('home-banner'));
    const footerSponsors = sponsors.filter((s) => s.slots.includes('footer'));

    const toggleExpand = async (key: string | number) => {
        if (expandedId === key) {
            setExpandedId(null);
            return;
        }
        setExpandedId(key);
        setDetail(null);
        try {
            const res = await api.get(`/public/tournament/${channelName}/${editionSlug}/participants/${key}`);
            setDetail(res.data);
        } catch {
            /* la fila queda abierta sin detalle */
        }
    };

    if (status === 'loading') return <div className="min-h-screen bg-[#080B12]" />;
    if (status === 'notfound' || !edition) {
        return (
            <div className="min-h-screen bg-[#080B12] text-[#F2F5FA] font-barlow flex items-center justify-center px-6 text-center">
                <div>
                    <p className="font-scoreboard font-black text-5xl">Torneo no encontrado</p>
                    <p className="mt-2 text-[#9AA4B6]">Revisa el link: puede que el torneo todavía no esté publicado.</p>
                </div>
            </div>
        );
    }

    // Campeon para la cabecera de un torneo terminado.
    const finished = edition.status === 'finished' || edition.status === 'archived';
    const fortniteMain = fortnite.scopes ? mainScope(fortnite.scopes) : undefined;
    const champion: { name: string; detail?: string } | null = !finished
        ? null
        : isFortnite
          ? (() => {
                const r = fortniteMain?.rows.find((x) => x.champion) || fortniteMain?.rows[0];
                return r && r.points > 0 ? { name: r.teamName, detail: `${r.points} puntos${r.members.length > 1 ? ` · ${r.members.join(', ')}` : ''}` } : null;
            })()
          : edition.mode === 'solo_q_climb'
            ? ranking[0]
                ? { name: ranking[0].displayName, detail: ranking[0].currentLp != null ? `${ranking[0].currentLp} LP` : undefined }
                : null
            : bracketChampion
              ? { name: bracketChampion }
              : null;

    const appearance = { primaryColor: edition.primaryColor, secondaryColor: edition.secondaryColor, theme: edition.theme, logoUrl: edition.logoUrl, bannerUrl: edition.bannerUrl };

    return (
        <TournamentThemeRoot appearance={appearance} className="min-h-screen">
            <Hero
                edition={edition}
                isLive={isLive}
                matchday={matchday}
                champion={champion}
                registeredCount={ranking.length}
                onRegister={() => setShowPanelModal(true)}
                onRules={() => setShowRulesModal(true)}
            />

            {edition.status === 'registration_open' && <HowToJoin isFortnite={!!isFortnite} />}

            {bannerSponsors.length > 0 && (
                <div style={{ background: 'var(--t-surface)', borderBottom: '1px solid var(--t-line)' }}>
                    <div className="max-w-[1440px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-4 md:px-8 py-4 flex items-center gap-8 overflow-x-auto">
                        <span className="text-sm flex-shrink-0" style={{ color: 'var(--t-muted)' }}>
                            Con el apoyo de
                        </span>
                        {bannerSponsors.map((s, i) => (
                            <a key={i} href={normalizeUrl(s.ctaUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity">
                                {s.logoUrl && <img src={s.logoUrl} alt={s.name} className="h-8 4xl:h-10 w-auto" />}
                                <span className="font-scoreboard font-extrabold text-lg 4xl:text-xl">{s.name}</span>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Pestañas fijas arriba al bajar */}
            <nav className="sticky top-0 z-30 backdrop-blur-md" style={{ background: 'color-mix(in srgb, var(--t-bg) 88%, transparent)', borderBottom: '1px solid var(--t-line)' }}>
                <div className="max-w-[1440px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-4 md:px-8 flex items-center gap-1 overflow-x-auto" role="tablist">
                    {tabs.map((t) => {
                        const on = activeTab === t.id;
                        return (
                            <button
                                key={t.id}
                                role="tab"
                                aria-selected={on}
                                onClick={() => setActiveTab(t.id)}
                                className="relative px-4 4xl:px-6 py-4 4xl:py-5 font-scoreboard font-extrabold text-xl 4xl:text-2xl whitespace-nowrap transition-colors"
                                style={{ color: on ? 'var(--t-ink)' : 'var(--t-muted)' }}
                            >
                                {t.label}
                                {on && <span className="absolute left-3 right-3 bottom-0 h-1" style={{ background: 'var(--t-primary)' }} />}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setShowRulesModal(true)}
                        className="ml-auto px-4 py-4 font-scoreboard font-extrabold text-xl 4xl:text-2xl whitespace-nowrap"
                        style={{ color: 'var(--t-muted)' }}
                    >
                        Normas
                    </button>
                </div>
            </nav>

            <main className="max-w-[1440px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-4 md:px-8 py-8 md:py-12 4xl:py-16">
                <div className={`grid grid-cols-1 gap-10 4xl:gap-14 items-start ${isLive ? 'lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px] 4xl:grid-cols-[minmax(0,1fr)_560px]' : ''}`}>
                    <div className="min-w-0">
                        {activeTab === 'standings' && (
                            <FortniteStandingsSection channelName={channelName!} editionSlug={editionSlug!} teamSize={edition.teamSize || 1} live={running} />
                        )}
                        {activeTab === 'ranking' && (
                            <LolRanking ranking={ranking} expandedId={expandedId} detail={detail} shellName={edition.shellItemName} onToggle={toggleExpand} />
                        )}
                        {activeTab === 'bracket' && <BracketSection channelName={channelName!} editionSlug={editionSlug!} />}
                        {activeTab === 'teams' && <TeamsSection channelName={channelName!} editionSlug={editionSlug!} />}
                        {activeTab === 'players' && <PlayersSection channelName={channelName!} editionSlug={editionSlug!} />}
                        {activeTab === 'info' && <InfoSection edition={edition} prizes={prizes} />}
                    </div>

                    {isLive && (
                        <aside id="stream" className="lg:sticky lg:top-24">
                            <div className="aspect-video bg-ds-input" style={{ boxShadow: '0 0 0 1px var(--t-line)' }}>
                                <iframe
                                    src={`https://player.twitch.tv/?channel=${channelName}&parent=${window.location.hostname}&muted=true&autoplay=false`}
                                    title={`${channelName} en Twitch`}
                                    allowFullScreen
                                    className="w-full h-full"
                                />
                            </div>
                            <a
                                href={`https://twitch.tv/${channelName}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 flex items-center justify-center gap-2 py-2 text-sm 4xl:text-base font-semibold hover:underline"
                                style={{ color: 'var(--t-muted)' }}
                            >
                                <Tv className="w-4 h-4" /> Abrir en twitch.tv/{channelName}
                            </a>
                        </aside>
                    )}
                </div>
            </main>

            <footer style={{ borderTop: '1px solid var(--t-line)' }}>
                <div className="max-w-[1440px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-5 flex-wrap justify-center">
                        {footerSponsors.map((s, i) => (
                            <a key={i} href={normalizeUrl(s.ctaUrl)} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline" style={{ color: 'var(--t-muted)' }}>
                                {s.name}
                            </a>
                        ))}
                    </div>
                    <a href="https://decatron.net" className="text-sm hover:underline" style={{ color: 'var(--t-muted)' }}>
                        Torneo organizado con Decatron
                    </a>
                </div>
            </footer>

            {showPanelModal && <MyTournamentModal channelName={channelName!} editionSlug={editionSlug!} onClose={() => setShowPanelModal(false)} />}
            {showRulesModal && (
                <RulesModal channelName={channelName!} editionSlug={editionSlug!} shellItemName={edition.shellItemName} onClose={() => setShowRulesModal(false)} />
            )}
        </TournamentThemeRoot>
    );
}

// ─── Cabecera ────────────────────────────────────────────────────────────────

function Hero({
    edition,
    isLive,
    matchday,
    champion,
    registeredCount,
    onRegister,
    onRules,
}: {
    edition: EditionInfo & { bannerUrl?: string | null; secondaryColor?: string | null; theme?: string };
    isLive: boolean;
    matchday: FortniteMatchday | null;
    champion: { name: string; detail?: string } | null;
    registeredCount: number;
    onRegister: () => void;
    onRules: () => void;
}) {
    const t = buildTokens({ primaryColor: edition.primaryColor, secondaryColor: edition.secondaryColor, theme: edition.theme });
    const isFortnite = edition.game === 'fortnite';
    const open = edition.status === 'registration_open';
    const running = edition.status === 'in_progress' || edition.status === 'check_in';
    const tall = open || !!champion;

    // Con inscripciones abiertas se cuenta hasta el inicio; en curso, hasta el cierre.
    const countdown = useCountdown(open ? edition.startsAt : running ? edition.endsAt : null);

    const facts: ReactNode[] = [
        isFortnite ? 'Fortnite' : 'League of Legends',
        isFortnite && edition.teamSize
            ? FORTNITE_TEAM_SIZE_LABELS[edition.teamSize]
            : edition.mode === 'solo_q_climb'
              ? 'Climb SoloQ'
              : BRACKET_FORMAT_LABELS[edition.bracketFormat || ''] || null,
        REGION_LABELS[edition.region] || edition.region.toUpperCase(),
    ].filter(Boolean);

    // Portada del streamer o, sin portada, sus colores en diagonal con lineas de velocidad.
    const backdrop: CSSProperties = edition.bannerUrl
        ? {}
        : {
              background: `repeating-linear-gradient(115deg, transparent 0 22px, ${t.isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'} 22px 24px), linear-gradient(115deg, ${mix(
                  t.brandPrimary,
                  t.bg,
                  t.isDark ? 0.35 : 0.2,
              )} 0%, ${mix(t.brandSecondary, t.bg, t.isDark ? 0.55 : 0.45)} 55%, ${t.bg} 100%)`,
          };

    return (
        <header className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--t-line)' }}>
            <div className="absolute inset-0" style={backdrop}>
                {edition.bannerUrl && <img src={edition.bannerUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            {/* Oscurece (o aclara) hacia abajo y a la izquierda para que el texto se lea sobre cualquier portada */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(to top, ${t.bg} 2%, ${hexA(t.bg, 0.55)} 45%, ${hexA(t.bg, edition.bannerUrl ? 0.15 : 0)} 100%), linear-gradient(to right, ${hexA(t.bg, 0.8)} 0%, ${hexA(
                        t.bg,
                        0,
                    )} 70%)`,
                }}
            />

            <div
                className={`relative max-w-[1440px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-4 md:px-8 flex flex-col lg:flex-row lg:items-end justify-between gap-8 ${
                    tall ? 'pt-24 md:pt-36 4xl:pt-48 pb-10 md:pb-14' : 'pt-16 md:pt-24 4xl:pt-32 pb-8 md:pb-10'
                }`}
            >
                <div className="min-w-0 max-w-4xl 4xl:max-w-6xl motion-safe:animate-fade-in-up">
                    <div className="flex items-center gap-4 mb-5">
                        {edition.logoUrl ? (
                            <img
                                src={edition.logoUrl}
                                alt=""
                                className="w-16 h-16 md:w-24 md:h-24 4xl:w-32 4xl:h-32 object-contain p-1.5"
                                style={{ background: 'var(--t-surface)', boxShadow: '0 0 0 1px var(--t-line)' }}
                            />
                        ) : null}
                        <StatusBug status={edition.status} isLive={isLive} />
                    </div>
                    <h1 className="font-scoreboard font-black uppercase leading-[0.88] tracking-tight text-5xl sm:text-6xl md:text-7xl xl:text-8xl 4xl:text-9xl 5xl:text-[10rem] break-words">
                        {edition.name}
                    </h1>
                    <div className="mt-5 flex flex-wrap gap-1.5">
                        {facts.map((f, i) => (
                            <Chip key={i}>{f}</Chip>
                        ))}
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                        {open ? (
                            <BroadcastButton size="lg" onClick={onRegister}>
                                Inscribirme
                            </BroadcastButton>
                        ) : (
                            <BroadcastButton size="lg" variant={running ? 'primary' : 'secondary'} onClick={onRegister}>
                                Mi inscripción
                            </BroadcastButton>
                        )}
                        {open && (
                            <BroadcastButton size="lg" variant="secondary" onClick={onRegister}>
                                Ya me inscribí
                            </BroadcastButton>
                        )}
                        <BroadcastButton size="lg" variant="ghost" onClick={onRules}>
                            Normas
                        </BroadcastButton>
                    </div>
                </div>

                <HeroPanel
                    edition={edition}
                    isLive={isLive}
                    matchday={matchday}
                    champion={champion}
                    countdown={countdown}
                    registeredCount={registeredCount}
                />
            </div>
        </header>
    );
}

/** Lo que cambia segun el estado: cuenta regresiva, en que va el torneo, o el campeon. */
function HeroPanel({
    edition,
    isLive,
    matchday,
    champion,
    countdown,
    registeredCount,
}: {
    edition: EditionInfo;
    isLive: boolean;
    matchday: FortniteMatchday | null;
    champion: { name: string; detail?: string } | null;
    countdown: { d: number; h: number; m: number } | null;
    registeredCount: number;
}) {
    const box = 'w-full lg:w-auto lg:min-w-[340px] 4xl:min-w-[460px] p-5 4xl:p-7 backdrop-blur-md';
    const boxStyle: CSSProperties = { background: 'color-mix(in srgb, var(--t-surface) 82%, transparent)', boxShadow: '0 0 0 1px var(--t-line)' };

    if (champion) {
        return (
            <div className={box} style={{ ...boxStyle, boxShadow: 'inset 0 4px 0 var(--t-gold), 0 0 0 1px var(--t-line)' }}>
                <p className="flex items-center gap-2 font-scoreboard font-extrabold text-xl 4xl:text-2xl" style={{ color: 'var(--t-gold)' }}>
                    <Crown className="w-5 h-5 4xl:w-6 4xl:h-6" /> Campeón
                </p>
                <p className="font-scoreboard font-black text-5xl 4xl:text-7xl leading-none mt-2 break-words">{champion.name}</p>
                {champion.detail && (
                    <p className="mt-2 text-base 4xl:text-lg" style={{ color: 'var(--t-muted)' }}>
                        {champion.detail}
                    </p>
                )}
            </div>
        );
    }

    if (edition.status === 'registration_open') {
        return (
            <div className={box} style={boxStyle}>
                <p className="font-scoreboard font-extrabold text-xl 4xl:text-2xl" style={{ color: 'var(--t-muted)' }}>
                    {countdown ? 'Empieza en' : 'Fecha por anunciar'}
                </p>
                {countdown && <CountdownDigits parts={countdown} />}
                <p className="mt-4 text-base 4xl:text-lg">
                    <span className="font-scoreboard font-black text-3xl 4xl:text-4xl">{registeredCount}</span>{' '}
                    <span style={{ color: 'var(--t-muted)' }}>{registeredCount === 1 ? 'inscrito aprobado' : 'inscritos aprobados'}</span>
                </p>
            </div>
        );
    }

    if (edition.status === 'in_progress' || edition.status === 'check_in') {
        const fortniteLine =
            matchday && matchday.sessionStatus !== 'scheduled'
                ? matchday.sessionStatus === 'check_in'
                    ? 'Check-in abierto'
                    : matchday.gameNumber
                      ? `Partida ${matchday.gameNumber} de ${matchday.gamesTotal}`
                      : null
                : null;
        return (
            <div className={box} style={boxStyle}>
                {matchday && (
                    <p className="font-scoreboard font-extrabold text-xl 4xl:text-2xl" style={{ color: 'var(--t-muted)' }}>
                        {matchday.sessionName}
                    </p>
                )}
                <p className="font-scoreboard font-black text-5xl 4xl:text-7xl leading-none mt-1">{fortniteLine ?? (edition.status === 'check_in' ? 'Check-in' : 'En curso')}</p>
                {matchday?.gameStatus && matchday.sessionStatus === 'in_progress' && (
                    <p className="mt-2 text-base 4xl:text-lg" style={{ color: 'var(--t-muted)' }}>
                        {GAME_STATUS_TEXT[matchday.gameStatus] || matchday.gameStatus}
                    </p>
                )}
                {matchday?.sessionStatus === 'scheduled' && matchday.scheduledAt && (
                    <p className="mt-2 text-base 4xl:text-lg" style={{ color: 'var(--t-muted)' }}>
                        Próxima sesión: {new Date(matchday.scheduledAt.endsWith('Z') ? matchday.scheduledAt : matchday.scheduledAt + 'Z').toLocaleString()}
                    </p>
                )}
                {!matchday && countdown && (
                    <>
                        <p className="mt-3 text-base" style={{ color: 'var(--t-muted)' }}>
                            Termina en
                        </p>
                        <CountdownDigits parts={countdown} />
                    </>
                )}
                {isLive && (
                    <a
                        href="#stream"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 font-scoreboard font-extrabold text-lg"
                        style={{ background: 'var(--t-live)', color: '#fff', clipPath: CUT }}
                    >
                        <Tv className="w-4 h-4" /> Ver la transmisión
                    </a>
                )}
            </div>
        );
    }

    return null;
}

function CountdownDigits({ parts }: { parts: { d: number; h: number; m: number } }) {
    const cells: [number, string][] = [
        [parts.d, parts.d === 1 ? 'día' : 'días'],
        [parts.h, 'horas'],
        [parts.m, 'min'],
    ];
    return (
        <div className="mt-2 flex gap-2" aria-live="polite">
            {cells.map(([v, label]) => (
                <div key={label} className="px-3 4xl:px-4 py-2 text-center min-w-[4.5rem] 4xl:min-w-[6rem]" style={{ background: 'var(--t-surface-raised)' }}>
                    <span className="block font-scoreboard font-black text-4xl 4xl:text-6xl leading-none tabular-nums">{String(v).padStart(2, '0')}</span>
                    <span className="block text-sm mt-1" style={{ color: 'var(--t-muted)' }}>
                        {label}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Pasos para inscribirse (es un proceso en orden, por eso va numerado). */
function HowToJoin({ isFortnite }: { isFortnite: boolean }) {
    const steps = [
        { title: 'Inicia sesión', text: 'Con tu cuenta de Twitch, Kick o Discord en Decatron.' },
        isFortnite
            ? { title: 'Vincula tu cuenta de Epic', text: 'Desde Settings o al inscribirte. Con el login de Epic queda verificada.' }
            : { title: 'Vincula tu cuenta de Riot', text: 'En Settings, y verifícala con el ícono que te pide.' },
        { title: 'Inscríbete', text: 'Toca Inscribirme y espera a que el organizador te apruebe.' },
    ];
    return (
        <section style={{ background: 'var(--t-surface)', borderBottom: '1px solid var(--t-line)' }}>
            <ol className="max-w-[1440px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-4 md:px-8 py-6 4xl:py-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                {steps.map((s, i) => (
                    <li key={s.title} className="flex gap-4">
                        <span className="font-scoreboard font-black text-5xl 4xl:text-6xl leading-none" style={{ color: 'var(--t-accent)' }}>
                            {i + 1}
                        </span>
                        <span>
                            <span className="block font-scoreboard font-extrabold text-2xl 4xl:text-3xl leading-tight">{s.title}</span>
                            <span className="block text-base 4xl:text-lg" style={{ color: 'var(--t-muted)' }}>
                                {s.text}
                            </span>
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

// ─── Clasificacion de LoL (SoloQ Climb) ─────────────────────────────────────

function LolRanking({
    ranking,
    expandedId,
    detail,
    shellName,
    onToggle,
}: {
    ranking: RankingRow[];
    expandedId: string | number | null;
    detail: ParticipantDetail | null;
    shellName: string;
    onToggle: (key: string | number) => void;
}) {
    const rows: BarRow[] = ranking.map((r, i) => ({
        key: r.id,
        rank: i + 1,
        name: r.displayName,
        sub: (
            <span className="inline-flex items-center gap-2">
                <span>{r.riotId ? `${r.riotId}#${r.riotTagLine}` : 'Sin cuenta vinculada'}</span>
                <span>
                    {r.wins}V · {r.losses}D
                </span>
                <AscentLine form={r.recentForm} />
            </span>
        ),
        value: r.currentLp,
        valueText: r.currentLp != null ? `${r.currentLp}` : '—',
        badges: r.primaryRole ? <RoleBadge role={r.primaryRole} /> : undefined,
        detail:
            expandedId === r.id ? (
                detail ? (
                    <ParticipantDetailView detail={detail} shellName={shellName} />
                ) : (
                    <p className="pt-4 text-sm" style={{ color: 'var(--t-muted)' }}>
                        Cargando…
                    </p>
                )
            ) : (
                <span />
            ),
    }));

    return (
        <section>
            <SectionTitle meta="Puntos de liga (LP) en SoloQ">Clasificación</SectionTitle>
            {rows.length === 0 ? <EmptyBlock>Los jugadores aparecen aquí cuando el organizador aprueba su inscripción.</EmptyBlock> : <PointsBars rows={rows} expandedKey={expandedId} onToggle={onToggle} />}
        </section>
    );
}

/** #RRGGBB con transparencia. */
function hexA(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
