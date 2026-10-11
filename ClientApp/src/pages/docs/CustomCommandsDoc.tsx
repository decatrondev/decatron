import { Edit3 } from 'lucide-react';
import { GuideDoc } from './private/features/GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → customCommands.
export default function CustomCommandsDoc() {
    return <GuideDoc page="customCommands" icon={Edit3} />;
}
