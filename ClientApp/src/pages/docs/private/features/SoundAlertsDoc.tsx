import { Volume2 } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → soundAlerts.
export default function SoundAlertsDoc() {
    return <GuideDoc page="soundAlerts" icon={Volume2} />;
}
