import { Bell } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → eventAlerts.
export default function EventAlertsDoc() {
    return <GuideDoc page="eventAlerts" icon={Bell} />;
}
