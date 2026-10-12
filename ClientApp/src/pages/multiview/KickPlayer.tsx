interface Props { channel: string; muted: boolean }

/**
 * Player de Kick en iframe. Kick no ofrece API de control: el silencio solo se decide al cargar (parámetro de la
 * URL), así que cambiar de casilla con audio recarga la de Kick; el volumen y la calidad no se pueden fijar desde aquí.
 */
export default function KickPlayer({ channel, muted }: Props) {
    return (
        <iframe
            key={String(muted)}
            title={`kick-${channel}`}
            src={`https://player.kick.com/${encodeURIComponent(channel)}?autoplay=true&muted=${muted}`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
        />
    );
}
