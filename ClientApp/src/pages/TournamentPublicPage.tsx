import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../services/api';
import {
    EDITION_STATUS_LABELS, REGION_LABELS, normalizeUrl, useCountdown, AscentLine, SectionLabel, EmptyState, Reveal, RoleBadge, NameAvatar,
} from './tournament-public/shared';
import type { EditionInfo, RankingRow, ParticipantDetail, Sponsor, Prize } from './tournament-public/shared';
import ParticipantDetailView from './tournament-public/ParticipantDetailView';
import BracketSection from './tournament-public/BracketSection';
import TeamsSection from './tournament-public/TeamsSection';
import PlayersSection from './tournament-public/PlayersSection';
import InfoSection from './tournament-public/InfoSection';
import MyTournamentModal from './tournament-public/MyTournamentModal';
import RulesModal from './tournament-public/RulesModal';

const TEAM_MODE_TABS = [
    { id: 'bracket', label: 'Bracket' },
    { id: 'teams', label: 'Equipos' },
    { id: 'players', label: 'Jugadores' },
    { id: 'info', label: 'Info' },
] as const;

const SOLO_Q_TABS = [
    { id: 'ranking', label: 'Ranking' },
    { id: 'info', label: 'Info' },
] as const;

// Milestone 1 — frontend publico del modulo de Torneos. Ver
// .dev/torneos/11-frontend-publico.md. Diseno propio ("La Escalada" — ver nota de
// diseno en el PR/conversacion): el ranking se lee como una linea de ascenso, no
// como un dashboard generico. Pagina fija en modo oscuro (no sigue el toggle del
// resto del sitio) — se piensa como grafico de transmision en vivo.
//
// "Inscribirme"/"Mi inscripción" abren MyTournamentModal (mismo contenido de
// MyTournamentPage/mi-panel, que exige login con la cuenta de Twitch propia del
// participante — no la del streamer — antes de dejar inscribirse o vincular Riot,
// decision de producto 15-08-2026, ver ESTADO.md). Volvio a ser modal el
// 24-08-2026 — la pagina /mi-panel aparte se veia perdida en pantallas 2K/4K;
// sigue existiendo como deep link (destino del redirect de login).
//
// Las secciones grandes (BracketSection, ParticipantDetailView) y las piezas
// compartidas (tipos, AscentLine, SectionLabel, EmptyState, etc.) viven
// en ./tournament-public/ — separado de este archivo (que pasaba las 640 líneas)
// el 15-08-2026.

export default function TournamentPublicPage() {
    const { channelName, editionSlug } = useParams<{ channelName: string; editionSlug: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [edition, setEdition] = useState<EditionInfo | null>(null);
    const [ranking, setRanking] = useState<RankingRow[]>([]);
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading');
    const [isLive, setIsLive] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [detail, setDetail] = useState<ParticipantDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showPanelModal, setShowPanelModal] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);

    const isTeamMode = edition != null && edition.mode !== 'solo_q_climb';
    // En 1 vs 1 (teamSize 1) "Equipos" y "Jugadores" muestran lo mismo — un jugador
    // por equipo — asi que se saca "Equipos" para no duplicar tabs (pedido del
    // usuario 24-08-2026).
    const tabs = isTeamMode
        ? (edition?.teamSize === 1 ? TEAM_MODE_TABS.filter(t => t.id !== 'teams') : TEAM_MODE_TABS)
        : SOLO_Q_TABS;
    const activeTab = tabs.find(t => t.id === searchParams.get('tab'))?.id || tabs[0].id;
    const setActiveTab = (tab: string) => setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
    }, { replace: true });

    const countdown = useCountdown(edition?.endsAt || null);
    const top3 = useMemo(() => ranking.slice(0, 3), [ranking]);
    const bannerSponsors = useMemo(() => sponsors.filter(s => s.slots.includes('home-banner')), [sponsors]);
    const footerSponsors = useMemo(() => sponsors.filter(s => s.slots.includes('footer')), [sponsors]);

    useEffect(() => {
        (async () => {
            try {
                const [homeRes, prizesRes] = await Promise.all([
                    api.get(`/public/tournament/${channelName}/${editionSlug}`),
                    api.get(`/public/tournament/${channelName}/${editionSlug}/prizes`),
                ]);
                if (homeRes.data?.success) {
                    setEdition(homeRes.data.edition);
                    setIsLive(!!homeRes.data.isLive);
                    setRanking(homeRes.data.ranking || []);
                    setSponsors(homeRes.data.sponsors || []);
                    setPrizes(prizesRes.data?.prizes || []);
                    setStatus('ok');
                } else {
                    setStatus('notfound');
                }
            } catch {
                setStatus('notfound');
            }
        })();
    }, [channelName, editionSlug]);

    const toggleExpand = async (participantId: number) => {
        if (expandedId === participantId) { setExpandedId(null); return; }
        setExpandedId(participantId);
        setDetail(null);
        setDetailLoading(true);
        try {
            const res = await api.get(`/public/tournament/${channelName}/${editionSlug}/participants/${participantId}`);
            setDetail(res.data);
        } catch (err) {
            console.error('Error cargando detalle', err);
        } finally {
            setDetailLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0B1120]">
                <Loader2 className="w-8 h-8 animate-spin text-[#3ED6C4]" />
            </div>
        );
    }

    if (status === 'notfound' || !edition) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0B1120] text-center px-4">
                <div>
                    <p className="font-mono text-xs tracking-[0.3em] text-[#7C8AA6] mb-3">404 — RUTA PERDIDA</p>
                    <h1 className="font-display text-3xl font-bold text-[#EDF0F7]">Este torneo no existe</h1>
                    <p className="text-[#7C8AA6] mt-2">Revisá el link — puede que todavía no esté publicado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B1120] text-[#EDF0F7] selection:bg-[#3ED6C4] selection:text-[#0B1120]">
            {/* HERO — splash art de fondo (Data Dragon, asset publico y estable, sin
                key ni llamado a la Riot API) para anclar visualmente "esto es LoL",
                mas una secuencia de entrada escalonada (fade-in-up, reusa la animacion
                ya definida en index.css) para que la pagina no se sienta estatica. */}
            <header className="relative overflow-hidden border-b border-[#232C42]">
                <div
                    className="absolute inset-0 bg-cover bg-[position:50%_20%] opacity-[0.16]"
                    style={{ backgroundImage: 'url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-[#0B1120]/85 to-[#0B1120]/40" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(232,176,75,0.14),transparent)]" />
                <div className="relative max-w-[1400px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-5 4xl:px-8 pt-12 4xl:pt-20 pb-10 4xl:pb-16">
                    <div className="flex items-center gap-2 mb-4 animate-fade-in-up">
                        <span className="relative flex w-2 h-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[#3ED6C4] opacity-75 animate-ping" />
                            <span className="relative inline-flex rounded-full w-2 h-2 bg-[#3ED6C4]" />
                        </span>
                        <p className="font-mono text-[11px] tracking-[0.25em] text-[#7C8AA6] uppercase">
                            {EDITION_STATUS_LABELS[edition.status] || edition.status} · {REGION_LABELS[edition.region] || edition.region.toUpperCase()}
                        </p>
                    </div>

                    <h1
                        className="font-display font-extrabold text-4xl md:text-6xl 4xl:text-7xl 5xl:text-8xl leading-[0.95] tracking-tight text-[#EDF0F7] animate-fade-in-up"
                        style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
                    >
                        {edition.name}
                    </h1>

                    <div
                        className="mt-6 flex items-end justify-between flex-wrap gap-6 animate-fade-in-up"
                        style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
                    >
                        {countdown && (
                            <div>
                                <p className="font-mono text-[10px] tracking-[0.25em] text-[#7C8AA6] uppercase mb-1.5">Cierra en</p>
                                <div className="font-mono font-bold text-2xl md:text-3xl 4xl:text-4xl text-[#EDF0F7] flex items-baseline gap-1.5">
                                    <span>{countdown.d}<span className="text-sm text-[#7C8AA6]">d</span></span>
                                    <span>{String(countdown.h).padStart(2, '0')}<span className="text-sm text-[#7C8AA6]">h</span></span>
                                    <span>{String(countdown.m).padStart(2, '0')}<span className="text-sm text-[#7C8AA6]">m</span></span>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            {edition.status === 'registration_open' && (
                                <button onClick={() => setShowPanelModal(true)}
                                    className="font-mono text-xs tracking-wider uppercase px-4 py-2.5 rounded bg-[#3ED6C4] text-[#0B1120] font-bold hover:bg-[#5EE8D8] hover:shadow-[0_0_20px_-2px_rgba(62,214,196,0.6)] transition-all">
                                    Inscribirme
                                </button>
                            )}
                            <button onClick={() => setShowPanelModal(true)}
                                className="font-mono text-xs tracking-wider uppercase px-4 py-2.5 rounded border border-[#232C42] text-[#7C8AA6] hover:text-[#EDF0F7] hover:border-[#3ED6C4]/50 transition-colors">
                                Mi inscripción
                            </button>
                            <button onClick={() => setShowRulesModal(true)}
                                className="font-mono text-xs tracking-wider uppercase px-4 py-2.5 rounded border border-[#232C42] text-[#7C8AA6] hover:text-[#EDF0F7] hover:border-[#3ED6C4]/50 transition-colors">
                                Ver normas
                            </button>
                        </div>
                    </div>

                    {/* Podio top 3 — plataformas escalonadas */}
                    {top3.length > 0 && (
                        <div
                            className="mt-10 flex items-end gap-3 md:gap-4 animate-fade-in-up"
                            style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
                        >
                            {[top3[1], top3[0], top3[2]].filter(Boolean).map((p, visualIdx) => {
                                const rank = top3.indexOf(p) + 1;
                                const heights = ['h-24', 'h-32', 'h-20'];
                                const isFirst = rank === 1;
                                return (
                                    <button key={p.id} onClick={() => toggleExpand(p.id)}
                                        className="flex-1 flex flex-col items-center group">
                                        <div className="mb-2 flex flex-col items-center text-center gap-1.5">
                                            <NameAvatar name={p.displayName} size={isFirst ? 40 : 32} />
                                            <p className={`font-display font-bold text-sm truncate max-w-[110px] ${isFirst ? 'text-[#E8B04B]' : 'text-[#EDF0F7]'}`}>{p.displayName}</p>
                                            <p className="font-mono text-xs text-[#7C8AA6]">{p.currentLp != null ? `${p.currentLp} LP` : '—'}</p>
                                        </div>
                                        <div className={`w-full ${heights[visualIdx]} rounded-t-md border-t-2 flex items-start justify-center pt-2 transition-transform group-hover:-translate-y-1 ${
                                            isFirst
                                                ? 'bg-gradient-to-b from-[#E8B04B]/25 to-[#E8B04B]/5 border-[#E8B04B] shadow-[0_0_24px_-8px_rgba(232,176,75,0.7)]'
                                                : 'bg-[#131B2E] border-[#232C42]'
                                        }`}>
                                            <span className={`font-mono font-bold text-lg ${isFirst ? 'text-[#E8B04B]' : 'text-[#7C8AA6]'}`}>{rank}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </header>

            {bannerSponsors.length > 0 && (
                <div className="border-b border-[#232C42] bg-[#0F1729]">
                    <div className="max-w-[1400px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-5 4xl:px-8 py-4 4xl:py-6 flex items-center gap-8 4xl:gap-10 overflow-x-auto">
                        <span className="font-mono text-[10px] tracking-[0.2em] text-[#7C8AA6] uppercase flex-shrink-0">Con el apoyo de</span>
                        {bannerSponsors.map((s, i) => (
                            <a key={i} href={normalizeUrl(s.ctaUrl)} target="_blank" rel="noreferrer"
                                className="flex items-center gap-2.5 flex-shrink-0 text-[#EDF0F7] hover:text-[#E8B04B] transition-colors group">
                                {s.logoUrl && <img src={s.logoUrl} alt={s.name} className="h-8 4xl:h-10 w-auto transition-transform group-hover:scale-105" />}
                                <span className="font-display font-bold text-base 4xl:text-lg">{s.name}</span>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/*
              Rail lateral (24-08-2026): antes premios/ranking/bracket iban todos
              apilados en una sola columna, y esa columna nunca superaba ~1280px de
              ancho real aunque el contenedor creciera en 2K/4K — pedido del usuario:
              "mucho espacio no se usa los lados, que no sea una landing todo en uno".
              Ahora el contenido en vivo (ranking o bracket, lo que sea largo/variable)
              ocupa la columna principal ancha, y lo auxiliar (premios, datos fijos del
              torneo) corre en paralelo en un rail angosto — deja de ser una lista
              unica de secciones apiladas y usa el ancho real de la pantalla.
            */}
            <main className="max-w-[1400px] 4xl:max-w-[1900px] 5xl:max-w-[2500px] mx-auto px-5 4xl:px-8 py-10 4xl:py-16">
                <div className={`grid grid-cols-1 gap-10 4xl:gap-16 items-start ${isLive ? 'lg:grid-cols-[1fr_320px] 4xl:grid-cols-[1fr_440px]' : ''}`}>
                <div className="min-w-0 space-y-8 4xl:space-y-10">
                {/* NAV DE TABS — reestructuracion 24-08-2026: antes ranking/equipos/bracket
                    vivian apilados en la misma vista larga, pedido del usuario fue separar
                    en secciones navegables por boton en vez de una landing de scroll unico. */}
                <div className="flex items-center gap-1.5 border-b border-[#232C42] overflow-x-auto">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`font-mono text-xs uppercase tracking-wider px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                                activeTab === t.id
                                    ? 'border-[#3ED6C4] text-[#EDF0F7]'
                                    : 'border-transparent text-[#7C8AA6] hover:text-[#EDF0F7]'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <Reveal key={activeTab}>
                {activeTab === 'ranking' && (
                <section>
                    <SectionLabel title="Ranking" />
                    {ranking.length === 0 ? (
                        <EmptyState text="Todavía no hay participantes cargados." />
                    ) : (
                        <div className="border border-[#232C42] rounded-lg overflow-hidden divide-y divide-[#232C42]">
                            {ranking.map((row, idx) => (
                                <div key={row.id} className="bg-[#0F1729]">
                                    <button onClick={() => toggleExpand(row.id)}
                                        className="w-full text-left px-4 4xl:px-6 py-3.5 4xl:py-5 flex items-center gap-4 4xl:gap-6 hover:bg-[#131B2E] transition-colors">
                                        <span className={`font-mono font-bold text-sm w-6 text-right ${idx === 0 ? 'text-[#E8B04B]' : 'text-[#7C8AA6]'}`}>{idx + 1}</span>
                                        <NameAvatar name={row.displayName} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-display font-bold text-[#EDF0F7] truncate 4xl:text-lg">{row.displayName}</span>
                                                {row.primaryRole && <RoleBadge role={row.primaryRole} />}
                                            </div>
                                            <p className="font-mono text-[11px] text-[#7C8AA6] truncate">{row.riotId ? `${row.riotId}#${row.riotTagLine}` : 'sin cuenta vinculada'}</p>
                                        </div>
                                        <AscentLine form={row.recentForm} />
                                        <div className="text-right w-24 flex-shrink-0">
                                            <p className="font-mono font-bold text-[#EDF0F7]">{row.currentLp != null ? row.currentLp : '—'}<span className="text-[10px] text-[#7C8AA6] ml-1">LP</span></p>
                                            <p className="font-mono text-[11px] text-[#7C8AA6]">
                                                <span className="text-[#3ED6C4]">{row.wins}V</span> — <span className="text-[#E8677A]">{row.losses}D</span>
                                            </p>
                                        </div>
                                    </button>

                                    {expandedId === row.id && (
                                        <div className="border-t border-[#232C42] px-4 py-4 bg-[#0B1120]">
                                            {detailLoading ? (
                                                <p className="font-mono text-xs text-[#7C8AA6]">Cargando...</p>
                                            ) : detail ? (
                                                <ParticipantDetailView detail={detail} shellName={edition.shellItemName} />
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
                )}

                {activeTab === 'teams' && <TeamsSection channelName={channelName!} editionSlug={editionSlug!} />}
                {activeTab === 'bracket' && <BracketSection channelName={channelName!} editionSlug={editionSlug!} />}
                {activeTab === 'players' && <PlayersSection channelName={channelName!} editionSlug={editionSlug!} />}
                {activeTab === 'info' && <InfoSection edition={edition} prizes={prizes} />}
                </Reveal>
                </div>

                {/* RAIL — solo canal en vivo (24-08-2026: "El torneo" y "Premios" se
                    fusionaron en la tab Info para no duplicar la misma info en dos lugares) */}
                {isLive && (
                <aside className="lg:sticky lg:top-10">
                    <Reveal>
                        <section>
                            <SectionLabel title="En vivo" accent="#E8677A" />
                            <div className="rounded-lg overflow-hidden border border-[#232C42] bg-black aspect-video">
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
                                className="mt-2 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#7C8AA6] hover:text-[#E8677A] transition-colors"
                            >
                                Ver en twitch.tv/{channelName} →
                            </a>
                        </section>
                    </Reveal>
                </aside>
                )}
                </div>
            </main>

            <footer className="border-t border-[#232C42] py-8 space-y-4">
                {footerSponsors.length > 0 && (
                    <div className="flex items-center justify-center gap-6 flex-wrap px-5">
                        {footerSponsors.map((s, i) => (
                            <a key={i} href={normalizeUrl(s.ctaUrl)} target="_blank" rel="noreferrer"
                                className="text-[#7C8AA6] hover:text-[#EDF0F7] transition-colors font-mono text-xs">
                                {s.name}
                            </a>
                        ))}
                    </div>
                )}
                <p className="text-center font-mono text-[10px] tracking-[0.2em] text-[#7C8AA6] uppercase">Torneo powered by Decatron</p>
            </footer>

            {showPanelModal && (
                <MyTournamentModal channelName={channelName!} editionSlug={editionSlug!} onClose={() => setShowPanelModal(false)} />
            )}
            {showRulesModal && (
                <RulesModal channelName={channelName!} editionSlug={editionSlug!} shellItemName={edition.shellItemName} onClose={() => setShowRulesModal(false)} />
            )}
        </div>
    );
}
