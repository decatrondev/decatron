import { Monitor } from 'lucide-react';
import { GuideDoc } from '../features/GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → overlaysGuide.
export default function OverlaysGuide() {
    return <GuideDoc page="overlaysGuide" icon={Monitor} />;
}
