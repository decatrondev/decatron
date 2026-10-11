import { Zap } from 'lucide-react';
import { GuideDoc } from './private/features/GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → shoutoutOverlay.
export default function ShoutoutOverlayDoc() {
    return <GuideDoc page="shoutoutOverlay" icon={Zap} />;
}
