import { Gift } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → giveaway.
export default function GiveawayDoc() {
    return <GuideDoc page="giveaway" icon={Gift} />;
}
