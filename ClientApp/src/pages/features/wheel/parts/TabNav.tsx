import {
    Coins, FlaskConical, History, Image as ImageIcon, Inbox, LayoutTemplate, MessageSquare,
    Palette, PieChart, ShieldAlert, Ticket, Wallet, type LucideIcon,
} from 'lucide-react';
import type { Tab, WheelSummary } from '../model';
import { groupOfTab, groupsForMode, tabsForGroup, type GroupId } from '../tabGroups';

const TAB_ICONS: Record<Tab, LucideIcon> = {
    segments: PieChart, credits: Coins, limits: ShieldAlert, messages: MessageSquare,
    test: FlaskConical, deliveries: Inbox, raffle: Ticket, look: Palette,
    canvas: LayoutTemplate, media: ImageIcon, history: History, wallets: Wallet,
};

/**
 * La barra de pestanas, en dos niveles como Song Request: los grupos (Configuracion,
 * Operacion, Diseno...) y, debajo, las pestanas del grupo abierto. Doce pestanas planas
 * eran una pared de botones; asi cada vista queda a un clic y ninguna se pierde.
 *
 * Ambas filas ENVUELVEN. Con `flex` a secas los botones no se encogen (icono + etiqueta)
 * y el ancho minimo de la barra arrastraba a toda la pagina: era el scroll horizontal.
 * En movil los grupos pasan a un selector para no gastar tres filas de pantalla.
 */
export function TabNav({ wheel, tab, pendingCount, onTab, t }: {
    wheel: WheelSummary;
    tab: Tab;
    pendingCount: number;
    onTab: (tab: Tab) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const groups = groupsForMode(wheel.mode);
    const active = groupOfTab(tab, wheel.mode) ?? groups[0];
    const tabsOfActive = active ? tabsForGroup(active, wheel.mode) : [];

    const label = (key: Tab) => key === 'deliveries' && pendingCount > 0
        ? `${t('wheel.tabs.deliveries')} (${pendingCount})`
        : t(`wheel.tabs.${key}`);

    const goGroup = (id: GroupId) => {
        const g = groups.find(x => x.id === id);
        if (g) onTab(tabsForGroup(g, wheel.mode)[0]);
    };

    // Entregas pendientes: el aviso tiene que verse aunque el grupo Operacion este cerrado.
    const groupBadge = (id: GroupId) => (id === 'operation' && wheel.mode !== 'raffle' ? pendingCount : 0);

    return (
        <nav className="bg-[#1B1C1D] border border-[#374151] rounded-xl p-2 space-y-2">
            {/* Movil: selector de grupo */}
            <select
                data-wheel-group-select
                aria-label={t('wheel.groups.group')}
                value={active?.id}
                onChange={e => goGroup(e.target.value as GroupId)}
                className="sm:hidden w-full px-3 py-2.5 rounded-lg bg-[#262626] border border-[#374151] text-sm font-bold text-[#f8fafc]"
            >
                {groups.map(g => (
                    <option key={g.id} value={g.id}>
                        {t(`wheel.groups.${g.id}`)}{groupBadge(g.id) > 0 ? ` (${groupBadge(g.id)})` : ''}
                    </option>
                ))}
            </select>

            <div data-wheel-groups className="hidden sm:flex flex-wrap gap-1">
                {groups.map(g => {
                    const Icon = g.icon;
                    const badge = groupBadge(g.id);
                    return (
                        <button
                            key={g.id}
                            onClick={() => goGroup(g.id)}
                            className={`px-4 py-2.5 rounded-lg text-sm 3xl:text-base font-black flex items-center gap-2 whitespace-nowrap transition-colors ${
                                active?.id === g.id ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:bg-[#262626]'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t(`wheel.groups.${g.id}`)}
                            {badge > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-black">{badge}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {tabsOfActive.length > 1 && (
                <div data-wheel-subtabs className="flex flex-wrap gap-1 pt-2 border-t border-[#374151]">
                    {tabsOfActive.map(key => {
                        const Icon = TAB_ICONS[key];
                        return (
                            <button
                                key={key}
                                onClick={() => onTab(key)}
                                className={`px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
                                    tab === key
                                        ? 'bg-[#262626] text-blue-300 ring-1 ring-blue-500/60'
                                        : 'text-[#94a3b8] hover:bg-[#262626]'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label(key)}
                            </button>
                        );
                    })}
                </div>
            )}
        </nav>
    );
}
