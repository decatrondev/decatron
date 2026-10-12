// Registro de diagnóstico del Multi-view: se activa con ?debug en la dirección y muestra, en un panel, cada evento
// del player de Twitch con la visibilidad de la pestaña. Sirve para ver cuándo y por qué una casilla se pausa.
const MAX = 40;
const lines: string[] = [];

export function mvLog(text: string) {
    const t = new Date().toLocaleTimeString('es', { hour12: false });
    lines.push(`${t} ${text}`);
    if (lines.length > MAX) lines.shift();
    window.dispatchEvent(new CustomEvent('mv-log'));
}

export const mvLines = () => lines.slice();
