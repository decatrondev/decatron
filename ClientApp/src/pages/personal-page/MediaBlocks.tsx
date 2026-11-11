import { useCallback, useEffect, useState } from 'react';
import { VIDEO_PLATFORM, embedUrl, isPortraitVideo, parseVideo, type PageLabels, type PersonalPageContent, type PersonalPagePhoto, type PersonalPageVideo } from './shared';

// Videos insertados y fotos de la página personal (subfase 5.4), debajo de redes y enlaces en las cinco plantillas.
// Cada plantilla le pasa sus colores con las variables --mb-* (texto, suave, panel, línea, acento) y su tipografía se
// hereda. El reproductor se carga recién al tocar: antes no se pide nada a YouTube, Twitch, Kick ni TikTok.

function VideoCard({ video, labels, embedded }: { video: PersonalPageVideo; labels: PageLabels; embedded?: boolean }) {
    const ref = parseVideo(video.url);
    const [playing, setPlaying] = useState(false);
    if (!ref) return null;
    const platform = VIDEO_PLATFORM[ref.kind];
    const portrait = isPortraitVideo(ref);
    const title = video.title || labels.videoOf(platform);
    return (
        <figure className={`mb-video${portrait ? ' mb-portrait' : ''}`}>
            <div className="mb-frame">
                {playing ? (
                    <iframe src={embedUrl(ref, window.location.hostname)} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                        allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
                ) : (
                    <button type="button" className="mb-poster" data-pp-target={`video:${video.id}`} onClick={() => !embedded && setPlaying(true)} aria-label={`${labels.play}: ${title}`}>
                        <span className="mb-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
                        <span className="mb-poster-text">
                            <span className="mb-poster-title">{title}</span>
                            <span className="mb-poster-note">{labels.loadsFrom(platform)}</span>
                        </span>
                    </button>
                )}
            </div>
        </figure>
    );
}

function Lightbox({ photos, index, onClose, onMove, labels }: { photos: PersonalPagePhoto[]; index: number; onClose: () => void; onMove: (d: number) => void; labels: PageLabels }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onMove(1);
            if (e.key === 'ArrowLeft') onMove(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, onMove]);
    const photo = photos[index];
    return (
        <div className="mb-lightbox" role="dialog" aria-modal="true" aria-label={photo.caption || labels.photos} onClick={onClose}>
            <img src={photo.mediaUrl} alt={photo.caption} onClick={e => e.stopPropagation()} />
            {photo.caption && <p className="mb-lb-caption">{photo.caption}</p>}
            <button type="button" className="mb-lb-close" onClick={onClose} aria-label={labels.close}>×</button>
            {photos.length > 1 && <>
                <button type="button" className="mb-lb-nav mb-lb-prev" onClick={e => { e.stopPropagation(); onMove(-1); }} aria-label={labels.previous}>‹</button>
                <button type="button" className="mb-lb-nav mb-lb-next" onClick={e => { e.stopPropagation(); onMove(1); }} aria-label={labels.next}>›</button>
            </>}
        </div>
    );
}

export default function MediaBlocks({ content, labels, embedded }: { content: PersonalPageContent; labels: PageLabels; embedded?: boolean }) {
    const videos = (content.videos ?? []).filter(v => v.visible !== false && parseVideo(v.url));
    const photos = content.photos ?? [];
    const [open, setOpen] = useState<number | null>(null);
    const move = useCallback((d: number) => setOpen(i => i === null ? null : (i + d + photos.length) % photos.length), [photos.length]);
    if (videos.length === 0 && photos.length === 0) return null;
    return (
        <section className="mb-root">
            <style>{CSS}</style>
            {videos.length > 0 && (
                <div className="mb-videos">
                    {videos.map(v => <VideoCard key={v.id} video={v} labels={labels} embedded={embedded} />)}
                </div>
            )}
            {photos.length > 0 && (
                <div className="mb-photos">
                    <h2 className="mb-title">{labels.photos}</h2>
                    <ul className="mb-grid">
                        {photos.map((p, i) => (
                            <li key={p.id}>
                                <button type="button" className="mb-thumb" onClick={() => setOpen(i)} aria-label={p.caption || `${labels.photos} ${i + 1}`}>
                                    <img src={p.mediaUrl} alt={p.caption} loading="lazy" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {open !== null && photos[open] && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} onMove={move} labels={labels} />}
        </section>
    );
}

const CSS = `
.mb-root{display:flex;flex-direction:column;gap:1.25em;width:100%;box-sizing:border-box}
.mb-root *{box-sizing:border-box}
.mb-videos{display:flex;flex-direction:column;gap:.9em}
.mb-video{margin:0}
.mb-portrait{max-width:15em;width:100%;align-self:center}
.mb-frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:var(--mb-radius,.75em);overflow:hidden;background:var(--mb-panel);border:1px solid var(--mb-line)}
.mb-portrait .mb-frame{aspect-ratio:9/16}
.mb-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.mb-poster{position:absolute;inset:0;width:100%;height:100%;border:0;background:var(--mb-panel);color:var(--mb-text);font:inherit;cursor:pointer;
  display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:.7em;padding:1em;text-align:left}
.mb-play{width:3.2em;height:3.2em;border-radius:50%;background:var(--mb-accent);color:var(--mb-on-accent);display:flex;align-items:center;justify-content:center}
.mb-poster:hover .mb-play{filter:brightness(1.1)}
.mb-poster-text{display:flex;flex-direction:column;gap:.2em;min-width:0;max-width:100%}
.mb-poster-title{font-weight:800;font-size:1.05em;line-height:1.25;overflow-wrap:anywhere}
.mb-poster-note{font-size:.78em;color:var(--mb-soft)}
.mb-title{margin:0 0 .6em;font-size:.9em;font-weight:800;color:var(--mb-heading,var(--mb-soft))}
.mb-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4em}
.mb-thumb{display:block;width:100%;aspect-ratio:1;padding:0;border:0;border-radius:calc(var(--mb-radius,.75em) * .6);overflow:hidden;background:var(--mb-panel);cursor:zoom-in}
.mb-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.mb-poster:focus-visible,.mb-thumb:focus-visible{outline:2px solid var(--mb-accent);outline-offset:3px}
.mb-lightbox{position:fixed;inset:0;z-index:70;background:rgba(6,8,12,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 16px 24px;gap:12px}
.mb-lightbox img{max-width:100%;max-height:calc(100dvh - 140px);object-fit:contain;border-radius:8px}
.mb-lb-caption{margin:0;color:#E8EAEE;font-size:15px;text-align:center;max-width:40em}
.mb-lb-close{position:absolute;top:10px;right:12px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:28px;line-height:1;cursor:pointer}
.mb-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:64px;border:0;border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font-size:34px;cursor:pointer}
.mb-lb-prev{left:8px}.mb-lb-next{right:8px}
.mb-lightbox button:focus-visible{outline:2px solid #fff;outline-offset:2px}
@container (min-width:700px){.mb-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
`;
