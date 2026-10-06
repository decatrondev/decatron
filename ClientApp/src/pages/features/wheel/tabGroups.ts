import { BookOpen, Gauge, Palette, Settings2, SlidersHorizontal, Terminal, type LucideIcon } from 'lucide-react';
import type { Tab } from './model';

/**
 * Como se reparten las pestanas del panel: grupos arriba y sub-pestanas debajo, igual
 * que Song Request. Vive aqui, y no dentro de la barra, porque tambien lo necesitan el
 * coordinador (la pestana recordada tiene que existir en el modo de la rueda) y las
 * pestanas nuevas que se vayan sumando (Guia, Comandos, Plan y limites).
 *
 * Las pestanas dependen del modo: una rueda de Sorteo no tiene gajos ni creditos y una
 * de Premios no tiene pool. Un grupo sin pestanas en el modo actual no se dibuja.
 */
export type GroupId = 'guide' | 'config' | 'operation' | 'design' | 'commands' | 'plan';

export interface TabGroup {
    id: GroupId;
    icon: LucideIcon;
    prizes: readonly Tab[];
    raffle: readonly Tab[];
}

export const TAB_GROUPS: readonly TabGroup[] = [
    // Guia, Comandos y Plan son grupos de una sola pestana: la barra de segundo nivel no se dibuja.
    { id: 'guide', icon: BookOpen, prizes: ['guide'], raffle: ['guide'] },
    {
        id: 'config', icon: Settings2,
        prizes: ['segments', 'credits', 'limits', 'messages'],
        raffle: ['raffle', 'messages'],
    },
    {
        id: 'operation', icon: SlidersHorizontal,
        prizes: ['test', 'deliveries', 'history', 'wallets'],
        // Sin Billeteras ni Entregas: una rueda de Sorteo no cobra creditos ni entrega premios.
        raffle: ['history'],
    },
    {
        id: 'design', icon: Palette,
        prizes: ['look', 'canvas', 'media'],
        raffle: ['look', 'canvas', 'media'],
    },
    { id: 'commands', icon: Terminal, prizes: ['commands'], raffle: ['commands'] },
    { id: 'plan', icon: Gauge, prizes: ['plan'], raffle: ['plan'] },
];

const tabsOf = (g: TabGroup, mode: string) => (mode === 'raffle' ? g.raffle : g.prizes);

/** Los grupos que el modo ofrece, en orden. */
export const groupsForMode = (mode: string) => TAB_GROUPS.filter(g => tabsOf(g, mode).length > 0);

export const tabsForGroup = (g: TabGroup, mode: string) => tabsOf(g, mode);

/** Todas las pestanas del modo, en el orden en que se muestran. */
export const tabsForMode = (mode: string): Tab[] =>
    groupsForMode(mode).flatMap(g => [...tabsOf(g, mode)]);

export const defaultTab = (mode: string): Tab => tabsForMode(mode)[0];

export const groupOfTab = (tab: Tab, mode: string): TabGroup | undefined =>
    groupsForMode(mode).find(g => tabsOf(g, mode).includes(tab));

const KEY = 'wheel-tab';

/** La pestana de la visita anterior, si sigue existiendo en este modo. */
export function readSavedTab(): Tab | null {
    try { return sessionStorage.getItem(KEY) as Tab | null; } catch { return null; }
}

export function saveTab(tab: Tab) {
    try { sessionStorage.setItem(KEY, tab); } catch { /* sin storage */ }
}
