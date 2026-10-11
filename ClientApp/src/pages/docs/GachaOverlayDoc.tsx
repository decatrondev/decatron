import { Dice6 } from 'lucide-react';
import { GuideDoc } from './private/features/GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → gachaOverlay.
export default function GachaOverlayDoc() {
    return <GuideDoc page="gachaOverlay" icon={Dice6} />;
}
