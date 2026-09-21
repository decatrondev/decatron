import api from '../../../services/api';
import { LiveMatchState, LiveOverlayConfig, LiveOverlayInstance } from './types';

export interface LivePanelData {
    channel: { id: number; login: string; platform: 'twitch' | 'kick'; displayName: string };
    instances: LiveOverlayInstance[];
    state: LiveMatchState;
    /** Hay fila de coach (el streamer vinculó Decatron Desktop alguna vez). */
    desktopLinked: boolean;
    overlayUrlTemplate: string;
}

export const liveOverlaysApi = {
    panel: () => api.get<LivePanelData & { success: boolean }>('/live-overlays').then(r => r.data),
    createInstance: (body: { slug?: string; name?: string }) => api.post<{ success: boolean; instance?: LiveOverlayInstance; message?: string }>('/live-overlays', body).then(r => r.data),
    updateInstance: (slug: string, body: { name?: string; isEnabled?: boolean; canvas?: { width: number; height: number }; config?: LiveOverlayConfig }) =>
        api.put<{ success: boolean; instance: LiveOverlayInstance; message?: string }>(`/live-overlays/${slug}`, body).then(r => r.data),
    deleteInstance: (slug: string) => api.delete(`/live-overlays/${slug}`).then(r => r.data),
};
