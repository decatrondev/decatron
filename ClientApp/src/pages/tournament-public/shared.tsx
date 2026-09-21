import { useEffect, useRef, useState, type ReactNode } from 'react';

// Piezas compartidas entre TournamentPublicPage.tsx y sus secciones
// (BracketSection, RegisterModal, ParticipantDetailView). Separado de
// TournamentPublicPage.tsx (que pasaba las 640 líneas) el 15-08-2026.

export interface EditionInfo {
    name: string;
    slug: string;
    mode: string;
    region: string;
    status: string;
    bracketFormat: string | null;
    teamSize: number | null;
    startsAt: string | null;
    endsAt: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    shellItemName: string;
    aegisMechanicName: string;
}

export interface RankingRow {
    id: number;
    displayName: string;
    riotId: string | null;
    riotTagLine: string | null;
    primaryRole: string | null;
    nationality: string | null;
    twitchChannel: string | null;
    kickChannel: string | null;
    currentLp: number | null;
    wins: number;
    losses: number;
    matchesPlayed: number;
    recentForm: string[];
}

export interface ParticipantDetail {
    participant: RankingRow & { twitterHandle: string | null };
    history: {
        riotMatchId: string; occurredAt: string; result: string; champion: string | null;
        kills: number; deaths: number; assists: number; csPerMin: number | null;
        durationSeconds: number; lpBefore: number | null; lpAfter: number | null;
        aegisTriggered: boolean; pentaKills: number;
    }[];
    inventory: { count: number; totalObtained: number; totalThrown: number; totalReceived: number; totalStolen: number } | null;
}

export interface Sponsor {
    name: string;
    logoUrl: string | null;
    ctaText: string | null;
    ctaUrl: string | null;
    slots: string[];
}

export interface Prize {
    name: string;
    description: string | null;
    amount: number | null;
    amountHidden: boolean;
    scope: string;
    rank: number | null;
    role: string | null;
    leader: { displayName: string; value: number } | null;
}

export const EDITION_STATUS_LABELS: Record<string, string> = {
    registration_open: 'Inscripciones abiertas', check_in: 'Check-in', in_progress: 'En curso',
    finished: 'Finalizado', archived: 'Archivado', draft: 'Proximamente',
};

export const ROLE_LABELS: Record<string, string> = { top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP' };

// Platform IDs de Riot que usa el torneo (mismo set que el selector del panel
// admin, ver EditionsPanel.tsx) — centralizado acá para que la pagina publica y
// el panel de inscripcion muestren "LAN"/"LAS"/etc en vez del codigo crudo
// ("la1") que devuelve el backend. Movido de EditionsPanel.tsx el 24-08-2026.
export const REGIONS = [
    { value: 'euw1', label: 'EUW — Europa Oeste' },
    { value: 'eun1', label: 'EUNE — Europa Nordeste' },
    { value: 'na1', label: 'NA — Norteamerica' },
    { value: 'la1', label: 'LAN — Latinoamerica Norte' },
    { value: 'la2', label: 'LAS — Latinoamerica Sur' },
    { value: 'br1', label: 'BR — Brasil' },
    { value: 'kr', label: 'KR — Corea' },
    { value: 'jp1', label: 'JP — Japon' },
    { value: 'oc1', label: 'OCE — Oceania' },
    { value: 'tr1', label: 'TR — Turquia' },
    { value: 'ru', label: 'RU — Rusia' },
];
export const REGION_LABELS: Record<string, string> = Object.fromEntries(REGIONS.map((r) => [r.value, r.label.split(' — ')[0]]));

export const BRACKET_FORMAT_LABELS: Record<string, string> = {
    single_elimination: 'Eliminación simple',
    double_elimination: 'Doble eliminación',
    round_robin: 'Todos contra todos',
    swiss: 'Suizo',
};

// Defensivo: si el link de un sponsor quedo guardado sin protocolo ("midominio.com"),
// un <a href> lo trata como ruta relativa y el click termina en
// "decatron.net/midominio.com" en vez del sitio externo — bug reportado por el
// usuario 24-08-2026. El backend ya normaliza al guardar, esto cubre datos viejos.
export function normalizeUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function renderMarkdown(text: string): string {
    return text
        .split('\n')
        .map(line => {
            if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
            if (line.startsWith('# ')) return `<h2>${line.slice(2)}</h2>`;
            if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
            return line ? `<p>${line}</p>` : '<br/>';
        })
        .join('')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(<li>.*?<\/li>)+/g, m => `<ul>${m}</ul>`);
}

export function useCountdown(endsAt: string | null) {
    const [parts, setParts] = useState<{ d: number; h: number; m: number } | null>(null);
    useEffect(() => {
        if (!endsAt) { setParts(null); return; }
        const tick = () => {
            const diff = new Date(endsAt).getTime() - Date.now();
            if (diff <= 0) { setParts({ d: 0, h: 0, m: 0 }); return; }
            setParts({
                d: Math.floor(diff / 86400000),
                h: Math.floor((diff % 86400000) / 3600000),
                m: Math.floor((diff % 3600000) / 60000),
            });
        };
        tick();
        const id = setInterval(tick, 60000);
        return () => clearInterval(id);
    }, [endsAt]);
    return parts;
}

// Elemento firma: la racha V/D se lee como una linea de ascenso acumulada (+1 por
// victoria, -1 por derrota) — no LP crudo, porque el historico backfillado no varia
// entre partidas viejas (ver ESTADO.md). Sube con cada victoria: "la escalada" literal.
export function AscentLine({ form }: { form: string[] }) {
    if (form.length === 0) {
        return <div className="w-20 h-7 flex items-center"><span className="text-[10px] text-[#7C8AA6]">sin datos</span></div>;
    }
    let cum = 0;
    const points = form.map(r => { cum += r === 'win' ? 1 : -1; return cum; });
    const min = Math.min(0, ...points);
    const max = Math.max(0, ...points);
    const range = max - min || 1;
    const w = 80, h = 28, pad = 3;
    const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
    const toY = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
    const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * stepX} ${toY(v)}`).join(' ');
    const rising = points[points.length - 1] >= points[0];

    return (
        <svg width={w} height={h} className="overflow-visible flex-shrink-0">
            <path d={path} fill="none" stroke={rising ? '#3ED6C4' : '#E8677A'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pad + (points.length - 1) * stepX} cy={toY(points[points.length - 1])} r={2.5} fill={rising ? '#3ED6C4' : '#E8677A'} />
        </svg>
    );
}

// Sin numeracion (01/02) — con el rail lateral (premios/datos corriendo en
// paralelo a la columna principal) el numero ya no describe un orden real de
// lectura, asi que se saco. Ver nota de layout en TournamentPublicPage.tsx.
export function SectionLabel({ title, accent = '#3ED6C4' }: { title: string; accent?: string }) {
    return (
        <div className="flex items-baseline gap-3 mb-4 4xl:mb-6">
            <span className="w-2.5 h-2.5 4xl:w-3 4xl:h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: accent }} />
            <h2 className="font-display font-bold text-xl 4xl:text-2xl 5xl:text-3xl text-[#EDF0F7]">{title}</h2>
            <div className="flex-1 h-px bg-[#232C42]" />
        </div>
    );
}

export function EmptyState({ text }: { text: string }) {
    return <p className="font-mono text-xs 4xl:text-sm text-[#7C8AA6] border border-dashed border-[#232C42] rounded-lg px-4 4xl:px-6 py-6 4xl:py-8 text-center">{text}</p>;
}

// Revela una seccion con fade-in-up (reusa la animacion global de index.css) la
// primera vez que entra al viewport — pedido explicito del usuario (24-08-2026):
// "sin movimiento... no se siente en vivo". Dispara una sola vez (no repite al
// volver a scrollear) para no marear.
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.15 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className={`${className} ${visible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            {children}
        </div>
    );
}

const ROLE_COLORS: Record<string, string> = {
    top: '#E8677A', jungle: '#3ED6C4', mid: '#E8B04B', adc: '#7dd3fc', support: '#b483e0',
};

// Insignia de rol — cuadrado solido con la inicial, un color fijo por rol (no
// depende de ningun asset externo de Data Dragon, cero riesgo de imagen rota).
export function RoleBadge({ role }: { role: string }) {
    const color = ROLE_COLORS[role] || '#7C8AA6';
    return (
        <span
            className="inline-flex items-center justify-center w-5 h-5 rounded font-mono text-[9px] font-bold flex-shrink-0"
            style={{ backgroundColor: `${color}26`, color, border: `1px solid ${color}66` }}
            title={ROLE_LABELS[role] || role}
        >
            {(ROLE_LABELS[role] || role).slice(0, 1)}
        </span>
    );
}

const AVATAR_PALETTE = ['#3ED6C4', '#E8B04B', '#E8677A', '#7dd3fc', '#b483e0', '#53fc18'];

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
}

// Avatar generado deterministicamente a partir del nombre — no hay fotos reales de
// los participantes (torneo amateur, sin sistema de perfiles con foto), pero un
// bloque de color + inicial ancla visualmente cada fila mucho mejor que texto
// plano. Mismo nombre siempre da el mismo color, asi que un jugador es reconocible
// de un vistazo entre ranking, equipos y bracket.
export function NameAvatar({ name, size = 32 }: { name: string; size?: number }) {
    const color = AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length];
    const initial = name.trim().slice(0, 1).toUpperCase() || '?';
    return (
        <span
            className="inline-flex items-center justify-center rounded-lg font-display font-bold flex-shrink-0"
            style={{ width: size, height: size, backgroundColor: `${color}22`, color, border: `1px solid ${color}55`, fontSize: size * 0.42 }}
        >
            {initial}
        </span>
    );
}
