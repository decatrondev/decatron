import { DollarSign } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → tips.
export default function TipsDoc() {
    return <GuideDoc page="tips" icon={DollarSign} />;
}
