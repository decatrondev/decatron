/**
 * De qué chat llegó un pedido. Twitch y Kick comparten la cola del canal, así que en la
 * lista se marca cada uno. Los pedidos del dashboard y de la playlist de respaldo no llevan icono.
 */
export function PlatformIcon({ platform, className = 'w-3.5 h-3.5 3xl:w-4 3xl:h-4' }: { platform: string | null | undefined; className?: string }) {
    if (platform === 'twitch') {
        return (
            <svg viewBox="0 0 24 24" className={`inline-block shrink-0 align-[-0.15em] text-[#9146ff] ${className}`} fill="currentColor" role="img" aria-label="Twitch">
                <title>Twitch</title>
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
            </svg>
        );
    }
    if (platform === 'kick') {
        return (
            <svg viewBox="0 0 24 24" className={`inline-block shrink-0 align-[-0.15em] ${className}`} role="img" aria-label="Kick">
                <title>Kick</title>
                <rect width="24" height="24" rx="5" fill="#53fc18" />
                <path d="M5 4h4.5v5h2V7h2V4H18v5h-2v2h-2v2h2v2h2v5h-4.5v-3h-2v-2h-2v5H5z" fill="#000" />
            </svg>
        );
    }
    return null;
}

/** La plataforma de un veto de usuario sale del valor guardado ("kick:login"). */
export function banPlatform(value: string): string | null {
    const prefix = value.split(':', 1)[0];
    return prefix === 'twitch' || prefix === 'kick' ? prefix : null;
}
