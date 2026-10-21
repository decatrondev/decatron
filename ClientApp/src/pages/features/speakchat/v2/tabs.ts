export type TabId2 = 'summary' | 'commands' | 'voices' | 'filters' | 'overlay' | 'tests';

/** Emoji = identificador del icono en TabIcon (se dibuja el icono de la librería, no el emoji). */
export const TABS2: { id: TabId2; icon: string }[] = [
    { id: 'summary', icon: '📋' },
    { id: 'commands', icon: '💬' },
    { id: 'voices', icon: '🎙️' },
    { id: 'filters', icon: '🛡️' },
    { id: 'overlay', icon: '🖥️' },
    { id: 'tests', icon: '🧪' },
];
