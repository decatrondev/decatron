export type TabId2 =
    | 'guide' | 'general' | 'activation' | 'voiceCommands' | 'channelVoice' | 'library'
    | 'requestVoice' | 'myVoices' | 'filters' | 'overlay' | 'credits' | 'history' | 'tests';

/** Emoji = identificador del icono en TabIcon (se dibuja el icono de la librería, no el emoji). */
export const TABS2: { id: TabId2; icon: string }[] = [
    { id: 'guide', icon: '📚' },
    { id: 'general', icon: '⚙️' },
    { id: 'activation', icon: '⚡' },
    { id: 'voiceCommands', icon: '💬' },
    { id: 'channelVoice', icon: '🎙️' },
    { id: 'library', icon: '🎶' },
    { id: 'requestVoice', icon: '📢' },
    { id: 'myVoices', icon: '⭐' },
    { id: 'filters', icon: '🛡️' },
    { id: 'overlay', icon: '🖥️' },
    { id: 'credits', icon: '📊' },
    { id: 'history', icon: '🕒' },
    { id: 'tests', icon: '🧪' },
];
