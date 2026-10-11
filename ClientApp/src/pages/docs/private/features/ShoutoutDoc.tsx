import { MessageSquare } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → shoutout.
export default function ShoutoutDoc() {
    return <GuideDoc page="shoutout" icon={MessageSquare} />;
}
