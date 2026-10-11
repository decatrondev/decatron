import { Sparkles } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → decatronAI.
export default function AIDoc() {
    return <GuideDoc page="decatronAI" icon={Sparkles} />;
}
