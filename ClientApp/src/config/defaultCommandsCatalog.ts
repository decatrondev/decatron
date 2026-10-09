// Catálogo compartido de los comandos por defecto: lo usan el panel (Comandos → Por defecto)
// y la documentación (/docs/commands/default). Los textos de cada comando (descripción, alias y
// ejemplos) NO se repiten aquí: salen de Resources/bot-metadata/{es,en}.json, que es también lo
// que lee el backend. Aquí solo va lo que ese archivo no dice.

// Grupos de la lista. Un comando que no está en ningún grupo cae en 'community'.
export const COMMAND_GROUPS: Record<string, string[]> = {
    stream: ['title', 't', 'game', 'g'],
    timer: ['dstart', 'dpause', 'dplay', 'dreset', 'dstop', 'dtimer'],
    community: ['so', 'raffle', 'join', 'followage', 'ia'],
    games: ['rango', 'lp', 'sesion', 'ultimas', 'cuentas', 'juego', 'setrango', 'rankup', 'rankdown', 'win', 'loss', 'matchup', 'build', 'coach', 'vs', 'duo', 'pool', 'meta', 'pred', 'predtop'],
};

export const COMMAND_GROUP_ORDER = ['stream', 'timer', 'community', 'games'] as const;

export function getCommandGroup(commandName: string): string {
    for (const [group, commands] of Object.entries(COMMAND_GROUPS)) {
        if (commands.includes(commandName)) return group;
    }
    return 'community';
}

// Comandos que dependen de una API de Twitch sin equivalente todavía armado del lado de Kick
// — ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md sección 8.17 (6 ago 2026).
//
// "Próximamente": Kick YA expone la API que hace falta (PATCH /public/v1/channels para título
// y categoría); es trabajo pendiente nuestro.
export const KICK_COMING_SOON = new Set(['title', 'game']);
// "No disponible en Kick": la API pública de Kick no tiene el dato que estos comandos
// necesitan (followers/followed_at, clips); no se promete fecha.
//
// "ia" NO va aquí: el modelo de lenguaje se llama siempre, sin depender de Twitch. Solo el
// sub-caso de "elegir a alguien del chat" pide la lista de chatters de Twitch y, si falla, el
// comando sigue respondiendo (ver DecatronAICommand.cs).
export const KICK_UNAVAILABLE = new Set(['followage', 'so']);

// Quién puede usarlos, verificado en el código de cada comando. Un comando que no aparece aquí
// NO afirma nada sobre permisos (la doc no muestra la línea "quién puede usarlo").
//   everyone     - sin comprobación de permisos
//   modsStreamer - solo el streamer y los moderadores
//   changeMods   - consultar es para todos; cambiar, solo streamer y moderadores
//   raffle       - crear/cerrar/sortear/repetir: streamer y moderadores; unirse y ver estado: todos
//   viewMods     - verlo es para todos; fijarlo, solo streamer y moderadores
//   coach        - todos (30 s entre usos, excepto moderadores)
//   configurable - lo decide la configuración del módulo (ver la guía del módulo)
export type CommandAccess = 'everyone' | 'modsStreamer' | 'changeMods' | 'raffle' | 'viewMods' | 'coach' | 'configurable';

export const COMMAND_ACCESS: Record<string, CommandAccess> = {
    title: 'changeMods',
    t: 'changeMods',
    game: 'changeMods',
    dstart: 'modsStreamer',
    dpause: 'modsStreamer',
    dplay: 'modsStreamer',
    dreset: 'modsStreamer',
    dstop: 'modsStreamer',
    dtimer: 'modsStreamer',
    so: 'modsStreamer',
    raffle: 'raffle',
    followage: 'everyone',
    ruleta: 'configurable',
    ia: 'configurable',
    join: 'configurable',
    juego: 'modsStreamer',
    setrango: 'modsStreamer',
    rankup: 'modsStreamer',
    rankdown: 'modsStreamer',
    win: 'modsStreamer',
    loss: 'modsStreamer',
    meta: 'viewMods',
    coach: 'coach',
};
