// Iconos de los servicios de música (los mismos que usaba el overlay de Now Playing).

const LASTFM_ICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#D51007"><path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.284 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.627-3.932l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.594 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.825 1.869 1.676 0 1.017-.88 1.456-2.529 1.456-2.447 0-3.464-1.29-4.04-3.052l-.907-2.803c-1.237-3.793-3.216-4.893-6.765-4.893C2.089 5.71 0 8.423 0 12.635c0 4.04 2.089 6.27 5.993 6.27 3.326 0 4.591-1.1 4.591-1.1v-.595z"/></svg>`)}`;
const SPOTIFY_ICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`)}`;

const ICONS: Record<string, { src: string; alt: string }> = {
    spotify: { src: SPOTIFY_ICON, alt: 'Spotify' },
    lastfm: { src: LASTFM_ICON, alt: 'Last.fm' },
};

const key = (service: string | null | undefined) => (service ?? '').toLowerCase().replace('.', '');

export function hasServiceIcon(service: string | null | undefined): boolean {
    return key(service) in ICONS;
}

export default function ServiceIcon({ service, size }: { service: string | null | undefined; size: number }) {
    const icon = ICONS[key(service)];
    if (!icon) return null;
    return <img src={icon.src} alt={icon.alt} style={{ width: size, height: size, flexShrink: 0 }} />;
}
