import { useEffect, useState } from 'react';
import { ShieldBan, Settings, Link2, Terminal, MessageSquareWarning, Siren, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FilterSwitch, fetchModerationOverview, saveModerationFilter, type ModerationFilterState, type ModerationPlatform } from './moderation/filterSwitch';
import { SPAM_FILTERS } from './moderation/SpamFilters';
import api from '../../services/api';

interface ModerationCard {
    key: string;
    /** Clave del filtro en el backend; sin filtro, la tarjeta no lleva interruptor */
    filter?: string;
    /** Grupo de filtros: la tarjeta muestra cuántos están activos */
    group?: string[];
    name: string;
    description: string;
    icon: React.ReactNode;
    route: string;
}

// Los filtros solo se muestran si el backend los conoce
const CARDS: ModerationCard[] = [
    {
        key: 'banned_words',
        filter: 'banned_words',
        name: 'Palabras prohibidas',
        description: 'Palabras y frases que no se pueden usar en el chat, cada una con su severidad',
        icon: <ShieldBan className="w-6 h-6 shrink-0 text-[#2563eb]" />,
        route: '/features/moderation/banned-words'
    },
    {
        key: 'links',
        filter: 'links',
        name: 'Links',
        description: 'Bloquea los links del chat, también los disfrazados, salvo los dominios que permitas o con !permit',
        icon: <Link2 className="w-6 h-6 shrink-0 text-[#2563eb]" />,
        route: '/features/moderation/links'
    },
    {
        key: 'spam',
        group: SPAM_FILTERS.map(f => f.key),
        name: 'Spam',
        description: 'Mayúsculas, símbolos, emotes, mensajes largos o repetidos, copypasta, zalgo y menciones',
        icon: <MessageSquareWarning className="w-6 h-6 shrink-0 text-[#2563eb]" />,
        route: '/features/moderation/spam'
    },
    {
        key: 'raids',
        group: ['account_age', 'bot_phrases'],
        name: 'Raids y bots',
        description: 'Modo pánico (!panico), cuentas nuevas y frases de bots que venden viewers',
        icon: <Siren className="w-6 h-6 shrink-0 text-[#2563eb]" />,
        route: '/features/moderation/raids'
    },
    {
        key: 'commands',
        name: 'Comandos de mods',
        description: '!permit, !strikes, !nuke, !panico y más: quién puede usar cada uno',
        icon: <Terminal className="w-6 h-6 shrink-0 text-[#2563eb]" />,
        route: '/features/moderation/commands'
    },
    {
        key: 'history',
        name: 'Historial',
        description: 'Quién fue sancionado, por qué y quién lo hizo; deshacer timeouts, bans y strikes',
        icon: <History className="w-6 h-6 shrink-0 text-[#2563eb]" />,
        route: '/features/moderation/history'
    }
];

export default function ModerationHub() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState<ModerationFilterState[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [panicActive, setPanicActive] = useState(false);
    const [platform, setPlatform] = useState<ModerationPlatform>('twitch');

    useEffect(() => {
        fetchModerationOverview()
            .then(o => { setFilters(o.filters); setPlatform(o.platform); })
            .catch(() => setError('No se pudo cargar el estado de los filtros'));
        api.get('/moderation/panic')
            .then(res => setPanicActive(Boolean(res.data.state?.active)))
            .catch(() => { });
    }, []);

    const toggle = async (key: string, next: boolean) => {
        if (!filters) return;
        const previous = filters;
        setFilters(filters.map(f => (f.key === key ? { ...f, enabled: next } : f)));
        try {
            if (!(await saveModerationFilter(key, { enabled: next }))) throw new Error();
        } catch {
            setFilters(previous);
            setError('No se pudo guardar el cambio');
        }
    };

    const cards = CARDS.filter(card => !card.filter || !filters || filters.some(f => f.key === card.filter));

    return (
        <div className="panel-scale space-y-6">
            <div>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Moderación</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                    Cada filtro se activa por separado y viene apagado. El streamer, los Lead Moderators y los moderadores nunca son sancionados.
                </p>
            </div>

            {platform === 'kick' && (
                <div className="p-4 rounded-lg bg-[#53fc18]/10 border border-[#53fc18]/40 text-sm text-[#1e293b] dark:text-[#f8fafc] max-w-7xl">
                    <strong>Canal de Kick.</strong> Funcionan los filtros, los comandos de mods y el historial. El modo pánico y el filtro de cuentas nuevas no están disponibles: la API de Kick no permite cambiar los modos del chat ni informa la antigüedad de las cuentas.
                </div>
            )}

            {error && (
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl">
                {cards.map((card) => {
                    const state = card.filter ? filters?.find(f => f.key === card.filter) : undefined;
                    // En Kick, de "Raids y bots" solo existen las frases de bots
                    const group = platform === 'kick' && card.key === 'raids' ? ['bot_phrases'] : card.group;
                    const groupActive = group && filters?.filter(f => group.includes(f.key) && f.enabled).length;
                    return (
                        <div
                            key={card.key}
                            className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] hover:shadow-lg transition-all flex flex-col"
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    {card.icon}
                                    <h3 className="text-lg font-black leading-tight text-[#1e293b] dark:text-[#f8fafc]">
                                        {card.name}
                                    </h3>
                                </div>
                                {state && (
                                    <FilterSwitch
                                        on={state.enabled}
                                        onChange={(next) => toggle(card.filter!, next)}
                                        label={`Activar ${card.name}`}
                                    />
                                )}
                            </div>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] flex-1">
                                {card.description}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                <span className={`text-xs font-bold whitespace-nowrap ${(state?.enabled || (groupActive ?? 0) > 0) ? 'text-green-600 dark:text-green-400' : 'text-[#64748b] dark:text-[#94a3b8]'}`}>
                                    {card.key === 'raids' && panicActive ? <span className="text-red-600 dark:text-red-400">PÁNICO ACTIVO</span>
                                        : state ? (state.enabled ? 'Activo' : 'Apagado')
                                        : group && filters ? `${groupActive} de ${group.length} activos` : ''}
                                </span>
                                <button
                                    onClick={() => navigate(card.route)}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm"
                                >
                                    <Settings className="w-4 h-4" />
                                    Configurar
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
