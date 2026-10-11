import { Cat } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → pets.
export default function PetsDoc() {
    return <GuideDoc page="pets" icon={Cat} />;
}
