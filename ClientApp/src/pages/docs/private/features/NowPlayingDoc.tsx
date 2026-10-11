import { Music } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → nowPlaying.
export default function NowPlayingDoc() {
    return <GuideDoc page="nowPlaying" icon={Music} />;
}
