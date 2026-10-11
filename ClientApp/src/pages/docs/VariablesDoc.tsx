import { Hash } from 'lucide-react';
import { GuideDoc } from './private/features/GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → variables.
export default function VariablesDoc() {
    return <GuideDoc page="variables" icon={Hash} />;
}
