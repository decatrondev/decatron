import type { Role } from './types';

// Guía de comandos de song request (SONG_REQUEST_PUBLIC_PLAYLISTS_PLAN.md, fase 0). Una sola lista para el
// dashboard y /sr/{canal}: la sintaxis y el texto van en commands.json → srGuide.cmd.{id}.

/** Qué permiso del canal decide quién lo usa. `playlist` = lo decide cada playlist. */
export type GuidePerm = 'request' | 'skip' | 'manage' | 'review' | 'playlist' | 'playlistLink';

export type GuideGroup = 'request' | 'queue' | 'manage' | 'review' | 'playlists';

export interface GuideCommand {
    id: string;
    group: GuideGroup;
    /** Otros nombres que hacen lo mismo. */
    aliases?: string[];
    examples: string[];
    perm: GuidePerm;
    /** Las claves de "Comandos públicos": si el streamer las ocultó todas, no sale en /sr. */
    keys: string[];
}

export const GUIDE_GROUPS: GuideGroup[] = ['request', 'playlists', 'queue', 'review', 'manage'];

export const GUIDE_COMMANDS: GuideCommand[] = [
    // Pedir y consultar
    { id: 'sr', group: 'request', aliases: ['!songrequest'], examples: ['!sr https://youtu.be/dQw4w9WgXcQ', '!sr daft punk one more time'], perm: 'request', keys: ['sr'] },
    { id: 'srNumber', group: 'request', examples: ['!sr #12'], perm: 'request', keys: ['sr'] },
    { id: 'wrongsong', group: 'request', examples: ['!wrongsong'], perm: 'request', keys: ['wrongsong'] },
    { id: 'song', group: 'request', aliases: ['!currentsong'], examples: ['!song'], perm: 'request', keys: ['song'] },
    { id: 'queue', group: 'request', examples: ['!queue'], perm: 'request', keys: ['queue'] },
    { id: 'myqueue', group: 'request', examples: ['!myqueue'], perm: 'request', keys: ['myqueue'] },
    { id: 'skipVote', group: 'request', examples: ['!skip'], perm: 'request', keys: ['skip'] },
    { id: 'volumeView', group: 'request', examples: ['!srvolume'], perm: 'request', keys: ['srvolume'] },
    // Playlist de fondo (familia !pl, fase 0b)
    { id: 'pl', group: 'playlists', examples: ['!pl'], perm: 'request', keys: ['pl'] },
    { id: 'playlistLink', group: 'playlists', examples: ['!playlist', '!playlist chill'], perm: 'playlistLink', keys: ['playlist'] },
    { id: 'plplay', group: 'playlists', aliases: ['!srplay'], examples: ['!plplay chill', '!plplay #19', '!plplay chill #19'], perm: 'manage', keys: ['plplay', 'srplay'] },
    { id: 'plstop', group: 'playlists', examples: ['!plstop'], perm: 'manage', keys: ['plstop'] },
    { id: 'plnext', group: 'playlists', examples: ['!plnext'], perm: 'skip', keys: ['plnext'] },
    { id: 'plshuffle', group: 'playlists', examples: ['!plshuffle', '!plshuffle on', '!plshuffle off'], perm: 'manage', keys: ['plshuffle'] },
    { id: 'pladd', group: 'playlists', examples: ['!pladd chill https://youtu.be/dQw4w9WgXcQ', '!pladd chill daft punk one more time'], perm: 'playlist', keys: ['pladd'] },
    // Cola
    { id: 'skip', group: 'queue', examples: ['!skip'], perm: 'skip', keys: ['skip'] },
    { id: 'srremove', group: 'queue', examples: ['!srremove 3'], perm: 'skip', keys: ['srremove'] },
    { id: 'srpromote', group: 'queue', examples: ['!srpromote 3'], perm: 'skip', keys: ['srpromote'] },
    // Revisión
    { id: 'srapprove', group: 'review', examples: ['!srapprove', '!srapprove 2'], perm: 'review', keys: ['srapprove'] },
    { id: 'srreject', group: 'review', examples: ['!srreject', '!srreject 2'], perm: 'review', keys: ['srreject'] },
    // Administrar
    { id: 'srmode', group: 'manage', aliases: ['abiertos', 'revisión', 'cerrados'], examples: ['!srmode open', '!srmode playlists', '!srmode review', '!srmode closed'], perm: 'manage', keys: ['srmode'] },
    { id: 'openclose', group: 'manage', examples: ['!sropen', '!srclose'], perm: 'manage', keys: ['sropen', 'srclose'] },
    { id: 'pause', group: 'manage', examples: ['!srpause', '!srresume'], perm: 'manage', keys: ['srpause', 'srresume'] },
    { id: 'volumeSet', group: 'manage', examples: ['!srvolume 40'], perm: 'manage', keys: ['srvolume'] },
    { id: 'srban', group: 'manage', examples: ['!srban', '!srban @viewer123'], perm: 'manage', keys: ['srban'] },
    { id: 'videocover', group: 'manage', examples: ['!srvideo', '!srcover'], perm: 'manage', keys: ['srvideo', 'srcover'] },
];

export interface GuidePermissions { request: Role; skip: Role; manage: Role; review: Role; playlist?: Role }

/** El rol mínimo de un comando con la configuración del canal (null = lo decide cada playlist). */
export function roleFor(cmd: GuideCommand, permissions: GuidePermissions): Role | null {
    if (cmd.perm === 'playlist') return null;
    if (cmd.perm === 'playlistLink') return permissions.playlist ?? 'everyone';
    return permissions[cmd.perm];
}
