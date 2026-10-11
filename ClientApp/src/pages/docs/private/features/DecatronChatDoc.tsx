import { MessageSquare } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → decatronChat.
export default function DecatronChatDoc() {
    return <GuideDoc page="decatronChat" icon={MessageSquare} />;
}
