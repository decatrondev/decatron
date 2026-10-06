import {
    Coins, FlaskConical, History, Image as ImageIcon, Inbox, LayoutTemplate, MessageSquare,
    Palette, PieChart, ShieldAlert, Ticket, Wallet,
} from 'lucide-react';
import type { Tab, WheelSummary } from '../model';

/**
 * La barra de pestañas. Dependen del modo: una rueda de Sorteo no tiene gajos ni
 * creditos, y una de Premios no tiene pool. Mostrar todas siempre seria ofrecer
 * pantallas que no aplican.
 *
 * Las pestanas ENVUELVEN. Con `flex` a secas y diez botones que no se pueden encoger
 * (icono + etiqueta), el ancho minimo de esta barra rondaba los 1200px y arrastraba a
 * toda la pagina: era la otra mitad del scroll horizontal.
 */
export function TabNav({ wheel, tab, pendingCount, onTab, t }: {
    wheel: WheelSummary;
    tab: Tab;
    pendingCount: number;
    onTab: (tab: Tab) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const items = wheel.mode === 'raffle'
        ? ([
            ['raffle', Ticket, t('wheel.tabs.raffle')],
            ['look', Palette, t('wheel.tabs.look')],
            ['canvas', LayoutTemplate, t('wheel.tabs.canvas')],
            ['media', ImageIcon, t('wheel.tabs.media')],
            ['messages', MessageSquare, t('wheel.tabs.messages')],
            // Sin Billeteras: una rueda de Sorteo no cobra creditos.
            ['history', History, t('wheel.tabs.history')],
        ] as const)
        : ([
            ['segments', PieChart, t('wheel.tabs.segments')],
            ['look', Palette, t('wheel.tabs.look')],
            ['canvas', LayoutTemplate, t('wheel.tabs.canvas')],
            ['media', ImageIcon, t('wheel.tabs.media')],
            ['credits', Coins, t('wheel.tabs.credits')],
            ['limits', ShieldAlert, t('wheel.tabs.limits')],
            ['messages', MessageSquare, t('wheel.tabs.messages')],
            ['test', FlaskConical, t('wheel.tabs.test')],
            ['deliveries', Inbox, pendingCount > 0
                ? `${t('wheel.tabs.deliveries')} (${pendingCount})`
                : t('wheel.tabs.deliveries')],
            ['history', History, t('wheel.tabs.history')],
            ['wallets', Wallet, t('wheel.tabs.wallets')],
        ] as const);

    return (
        <nav className="flex flex-wrap gap-1 bg-[#1B1C1D] border border-[#374151] rounded-xl p-1">
            {items.map(([key, Icon, label]) => (
                <button
                    key={key}
                    onClick={() => onTab(key as Tab)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
                        tab === key ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:bg-[#262626]'
                    }`}
                >
                    <Icon className="w-4 h-4" />
                    {label}
                </button>
            ))}
        </nav>
    );
}
