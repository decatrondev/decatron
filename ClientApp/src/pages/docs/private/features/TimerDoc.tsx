import { Clock } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → timer.
export default function TimerDoc() {
    return <GuideDoc page="timer" icon={Clock} />;
}
