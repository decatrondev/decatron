import { Gamepad2 } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → gameOverlays.
export default function GameOverlaysDoc() {
    return <GuideDoc page="gameOverlays" icon={Gamepad2} />;
}
