import { Megaphone } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → promo.
export default function PromoDoc() {
    return <GuideDoc page="promo" icon={Megaphone} />;
}
