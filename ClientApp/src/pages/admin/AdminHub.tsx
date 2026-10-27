import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, KeyRound, Cpu, MessageSquare, Heart, Star, TrendingUp, Coins, FileText, Mail, Gamepad2, Mic, Activity, Palette, Sparkles, Users, Languages, CircleDollarSign, Megaphone, Wallet, Image as ImageIcon, ShieldCheck, Clapperboard, MessagesSquare, Search, ChevronRight, X } from 'lucide-react';

interface AdminItem {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    route: string;
    ready: boolean;
}

interface AdminGroup {
    id: string;
    title: string;
    items: AdminItem[];
}

const ic = 'w-5 h-5';

const GROUPS: AdminGroup[] = [
    {
        id: 'business', title: 'Negocio', items: [
            { id: 'finance', name: 'Finanzas', description: 'Ingresos, costos y beneficio de la plataforma', icon: <Wallet className={ic} />, route: '/admin/finance', ready: true },
            { id: 'donations', name: 'Donaciones', description: 'Gestiona las donaciones recibidas en la plataforma', icon: <Heart className={ic} />, route: '/admin/donations', ready: true },
            { id: 'economy', name: 'Economía', description: 'DecaCoins, paquetes, cupones, referidos y usuarios', icon: <Coins className={ic} />, route: '/admin/economy', ready: true },
            { id: 'tts-credits', name: 'Créditos TTS', description: 'Saldo, historial y ajustes manuales de créditos por canal', icon: <Coins className={ic} />, route: '/admin/tts-credits', ready: true },
            { id: 'supporters', name: 'Supporters', description: 'Gestiona los supporters y benefactores de la plataforma', icon: <Star className={ic} />, route: '/admin/supporters', ready: true },
        ],
    },
    {
        id: 'ai', title: 'IA y voz', items: [
            { id: 'decatron-ai', name: 'Decatron AI', description: 'Administración global del sistema de inteligencia artificial', icon: <Cpu className={ic} />, route: '/admin/decatron-ai', ready: true },
            { id: 'decatron-chat', name: 'Decatron Chat', description: 'Administración global del sistema de chat', icon: <MessageSquare className={ic} />, route: '/admin/decatron-chat', ready: true },
            { id: 'ai-costs', name: 'Costos de IA', description: 'Gasto por modelo y saldo de créditos de los proveedores', icon: <CircleDollarSign className={ic} />, route: '/admin/ai-costs', ready: true },
            { id: 'live-translation', name: 'Traducción en vivo', description: 'Uso, costo estimado por proveedor, sesiones activas y límites', icon: <Languages className={ic} />, route: '/admin/live-translation', ready: true },
            { id: 'tts-lab', name: 'Laboratorio de voces', description: 'Compara las voces de Piper (gratis, en el servidor) con Polly: calidad, tiempo y coste', icon: <Mic className={ic} />, route: '/admin/tts-lab', ready: true },
            { id: 'fish-voices', name: 'Voces de personaje', description: 'Catálogo de voces de Fish Audio: buscar, probar, aprobar y anotar la licencia', icon: <Mic className={ic} />, route: '/admin/fish-voices', ready: true },
        ],
    },
    {
        id: 'platform', title: 'Plataforma', items: [
            { id: 'channels-visibility', name: 'Canales del carrusel', description: 'Qué canales de Twitch y Kick aparecen en la página pública', icon: <Users className={ic} />, route: '/admin/channels', ready: true },
            { id: 'channel-mods', name: 'Mod en canales', description: 'Da o quita mod al bot y a ti en los canales de Twitch, con el token del streamer', icon: <ShieldCheck className={ic} />, route: '/admin/mods', ready: true },
            { id: 'global-emotes', name: 'Emotes globales', description: 'El set de emotes de Decatron que se ve en todos los canales, y quién puede manejarlo', icon: <ImageIcon className={ic} />, route: '/admin/global-emotes', ready: true },
            { id: 'platform-waitlist', name: 'Lista de espera (decatron.top)', description: 'Quién se anotó en la landing de la plataforma: confirmados, pendientes, exportar y borrar', icon: <ListChecks className={ic} />, route: '/admin/platform-waitlist', ready: true },
            { id: 'platform-tenants', name: 'Tenants de la plataforma', description: 'Cargar la app de Twitch de cada comprador (secretos solo de escritura, validados contra Twitch)', icon: <KeyRound className={ic} />, route: '/admin/platform-tenants', ready: true },
            { id: 'clip-command', name: 'Comando !clip', description: 'Disco, uso por canal y tope mensual de descargas', icon: <Clapperboard className={ic} />, route: '/admin/clip-command', ready: true },
            { id: 'ranking', name: 'Ranking global', description: 'Configura el leaderboard global de la plataforma', icon: <TrendingUp className={ic} />, route: '/admin/ranking', ready: false },
        ],
    },
    {
        id: 'content', title: 'Juegos y contenido', items: [
            { id: 'tcg', name: 'TCG · Upgrades en curso', description: 'Cartas en gradeo y las que esperan pago de upgrade', icon: <Sparkles className={ic} />, route: '/admin/tcg', ready: true },
            { id: 'tcg-art-queue', name: 'TCG · Cola de arte', description: 'Cartas que llegaron a nivel 3/6/9 y esperan la ilustración nueva', icon: <Palette className={ic} />, route: '/admin/tcg-art-queue', ready: true },
            { id: 'fortnite', name: 'Fortnite Spirit Tracker', description: 'Catálogo de sprites de Fortnite y estadísticas de colección', icon: <Gamepad2 className={ic} />, route: '/admin/fortnite', ready: true },
            { id: 'game-overlay-promos', name: 'Anuncios en overlays', description: 'Anuncios de Decatron en Game Overlays y Song Request: mensajes, imagen, peso y frecuencia', icon: <Megaphone className={ic} />, route: '/admin/game-overlay-promos', ready: true },
        ],
    },
    {
        id: 'comms', title: 'Comunicación', items: [
            { id: 'email', name: 'Email campaigns', description: 'Crea plantillas visuales y envía emails a streamers con Resend', icon: <Mail className={ic} />, route: '/admin/email', ready: true },
            { id: 'promo', name: 'Promociones (overlay)', description: 'Piezas, plantillas y topes del overlay de promoción opcional que usan los streamers. No son los anuncios obligatorios de !sr', icon: <Sparkles className={ic} />, route: '/admin/promo', ready: true },
            { id: 'discord-server', name: 'Servidor de Discord', description: 'Vista previa y carga de la plantilla del servidor de Decatron', icon: <MessagesSquare className={ic} />, route: '/admin/discord-server', ready: true },
        ],
    },
    {
        id: 'brand', title: 'Marca y diseño', items: [
            { id: 'brand', name: 'Logos de la marca', description: 'Cómo se ve el logo en cada lugar del sitio: imagen, texto, tamaño y posición', icon: <ImageIcon className={ic} />, route: '/admin/brand', ready: true },
            { id: 'estilo', name: 'Guía de estilo', description: 'Todos los componentes y sus estados, en claro y oscuro', icon: <Palette className={ic} />, route: '/admin/estilo', ready: true },
            { id: 'logo', name: 'Logo de Decatron', description: 'Guía para elegir la mascota y generar los 7 prompts derivados', icon: <Palette className={ic} />, route: '/admin/logo', ready: true },
        ],
    },
    {
        id: 'internal', title: 'Interno', items: [
            { id: 'dev-docs', name: 'Dev Docs', description: 'Documentación interna del proyecto, auditorías y planes', icon: <FileText className={ic} />, route: '/admin/dev-docs', ready: true },
            { id: 'project-analysis', name: 'Radiografía del proyecto', description: 'Tamaño, composición, crecimiento y dónde se concentra el riesgo', icon: <Activity className={ic} />, route: '/admin/project-analysis', ready: true },
        ],
    },
];

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Row({ item, first }: { item: AdminItem; first: boolean }) {
    const body = (
        <>
            <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-md border border-ds-border bg-ds-bg ${item.ready ? 'text-ds-accent-text' : 'text-ds-soft'}`}>{item.icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ds-text">{item.name}</span>
                <span className="block text-[13px] leading-snug text-ds-soft line-clamp-2">{item.description}</span>
            </span>
            {item.ready
                ? <ChevronRight className="h-4 w-4 flex-none text-ds-soft transition-transform group-hover:translate-x-0.5 group-hover:text-ds-text" />
                : <span className="ds-badge flex-none">Próximamente</span>}
        </>
    );
    const cls = `flex items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-ds-border'}`;
    return item.ready
        ? <Link to={item.route} className={`group ${cls} transition-colors hover:bg-ds-bg focus-visible:bg-ds-bg focus-visible:outline-none`} data-admin-row>{body}</Link>
        : <div className={`${cls} opacity-60`} aria-disabled="true">{body}</div>;
}

export default function AdminHub() {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // "/" salta al buscador desde cualquier parte de la página (como en los paneles de documentación).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
            if (e.key === '/' && !typing) { e.preventDefault(); inputRef.current?.focus(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const groups = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return GROUPS;
        return GROUPS
            .map(g => ({ ...g, items: g.items.filter(i => normalize(`${i.name} ${i.description} ${g.title}`).includes(q)) }))
            .filter(g => g.items.length > 0);
    }, [query]);

    const total = groups.reduce((n, g) => n + g.items.length, 0);

    const openFirst = () => {
        const first = document.querySelector<HTMLAnchorElement>('[data-admin-row]');
        first?.click();
    };

    return (
        <div className="panel-scale space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl font-black text-ds-text">Admin</h1>
                    <p className="mt-1 text-ds-soft">Herramientas de administración de la plataforma</p>
                </div>
                <div className="relative w-full sm:w-80 3xl:w-96">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-soft" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') openFirst(); if (e.key === 'Escape') { setQuery(''); inputRef.current?.blur(); } }}
                        placeholder="Buscar herramienta"
                        aria-label="Buscar herramienta"
                        className="ds-input !pl-9 !pr-16"
                    />
                    {query
                        ? <button type="button" onClick={() => setQuery('')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ds-soft hover:text-ds-text"><X className="h-4 w-4" /></button>
                        : <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-ds-border px-1.5 text-[11px] text-ds-soft">/</kbd>}
                </div>
            </div>

            {total === 0 ? (
                <div className="rounded-lg border border-dashed border-ds-border px-6 py-16 text-center">
                    <p className="font-semibold text-ds-text">Sin resultados para «{query}»</p>
                    <p className="mt-1 text-sm text-ds-soft">Prueba con otra palabra, por ejemplo «finanzas», «voz» o «logo».</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-2 3xl:grid-cols-3">
                    {groups.map(g => (
                        <section key={g.id} aria-labelledby={`admin-g-${g.id}`}>
                            <h2 id={`admin-g-${g.id}`} className="mb-2 flex items-baseline gap-2 px-1 text-[12px] font-bold uppercase tracking-wider text-ds-soft">
                                {g.title}<span className="font-medium normal-case tracking-normal">{g.items.length}</span>
                            </h2>
                            <div className="overflow-hidden rounded-lg border border-ds-border bg-ds-surface">
                                {g.items.map((item, i) => <Row key={item.id} item={item} first={i === 0} />)}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
