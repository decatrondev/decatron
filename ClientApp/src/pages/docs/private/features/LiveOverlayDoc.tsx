import { Radio } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → liveOverlay.
export default function LiveOverlayDoc() {
    return <GuideDoc page="liveOverlay" icon={Radio} />;
}
