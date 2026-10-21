import SpeakChatHistory from '../../SpeakChatHistory';
import type { SpeakChatState } from './useSpeakChatConfig';

export default function HistoryTab({ sc }: { sc: SpeakChatState }) {
    return <SpeakChatHistory refreshKey={sc.historyKey} />;
}
