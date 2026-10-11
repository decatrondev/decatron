import { Code } from 'lucide-react';
import { GuideDoc } from './private/features/GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → scripting.
export default function ScriptingCommandsDoc() {
    return <GuideDoc page="scripting" icon={Code} />;
}
