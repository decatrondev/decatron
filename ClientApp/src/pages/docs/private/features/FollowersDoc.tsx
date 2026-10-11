import { Users } from 'lucide-react';
import { GuideDoc } from './GuideDoc';

// El texto vive en public/locales/{es,en}/docs-guides.json → followers.
export default function FollowersDoc() {
    return <GuideDoc page="followers" icon={Users} />;
}
