import { PublicRequestGuide } from '../features/song-request-extension/components/PublicRequestGuide';
import type { QueueState } from './shared';

export default function GuideTab({ channel, state }: { channel: string; state: QueueState }) {
    return (
        <PublicRequestGuide
            channel={channel}
            mode={state.mode ?? (state.requestsOpen ? 'open' : 'closed')}
            requestSource={state.requestSource}
            activePlaylistId={state.activePlaylistId}
        />
    );
}
