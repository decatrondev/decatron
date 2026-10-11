import { Code2 } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → developer.
export default function DeveloperPortalDoc() {
    return <GuideDoc page="developer" icon={Code2} />;
}
