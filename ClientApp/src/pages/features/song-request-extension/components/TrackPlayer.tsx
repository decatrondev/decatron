import YouTubePlayer from './YouTubePlayer';
import SoundCloudPlayer from './SoundCloudPlayer';

// El reproductor que corresponde a la fuente del pedido actual. Sin pedido queda el de YouTube
// (vacío y liviano); con uno de SoundCloud se cambia a su widget y al terminar se vuelve.

export interface TrackItem {
    id: number;
    source: string | null;
    sourceId: string;
}

interface Props {
    item: TrackItem | null;
    paused: boolean;
    volume: number;
    onEnded: (itemId: number) => void;
    onError: (itemId: number, code: number) => void;
    onProgress: (itemId: number, position: number, duration: number, playing: boolean) => void;
}

export default function TrackPlayer({ item, ...rest }: Props) {
    if (item?.source === 'soundcloud') {
        return <SoundCloudPlayer item={{ id: item.id, sourceId: item.sourceId }} {...rest} />;
    }
    return <YouTubePlayer item={item ? { id: item.id, videoId: item.sourceId } : null} {...rest} />;
}
