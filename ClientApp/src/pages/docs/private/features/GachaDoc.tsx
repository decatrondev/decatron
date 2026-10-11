import { Dice6 } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → gacha.
export default function GachaDoc() {
    return <GuideDoc page="gacha" icon={Dice6} />;
}
