import { BarChart3 } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → analytics.
export default function AnalyticsDoc() {
    return <GuideDoc page="analytics" icon={BarChart3} />;
}
