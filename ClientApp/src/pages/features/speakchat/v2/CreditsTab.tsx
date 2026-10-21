import CreditsPanel from './CreditsPanel';
import type { SpeakChatState } from './useSpeakChatConfig';

export default function CreditsTab({ sc }: { sc: SpeakChatState }) {
    return <CreditsPanel usage={sc.usage} />;
}
