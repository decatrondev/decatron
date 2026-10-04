import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import { buildUploadForm, errorCodeOf, type EmoteDto } from '../../../components/channel-emotes/shared';

export type UploadMode = 'owner' | 'staff' | 'approval' | 'list';
export interface ReportInfo { emoteId: number; count: number; reasons: string[] }
export interface Uploader { id: number; platform: 'twitch' | 'kick'; login: string }

/** Carga y acciones del panel de emotes propios (/api/channel-emotes). Cada acción devuelve null si salió bien o la clave del error. */
export function useChannelEmotes() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [emotes, setEmotes] = useState<EmoteDto[]>([]);
    const [settings, setSettings] = useState<{ uploadMode: UploadMode; maxPendingPerUser: number }>({ uploadMode: 'staff', maxPendingPerUser: 5 });
    const [usage, setUsage] = useState<{ used: number; max: number; tier: string }>({ used: 0, max: 0, tier: 'free' });
    const [canUpload, setCanUpload] = useState(false);
    const [isOwnerLevel, setIsOwnerLevel] = useState(false);
    const [channelLogin, setChannelLogin] = useState('');
    const [reports, setReports] = useState<ReportInfo[]>([]);
    const [uploaders, setUploaders] = useState<Uploader[]>([]);

    const load = useCallback(async () => {
        try {
            const [res, rep] = await Promise.all([api.get('/channel-emotes'), api.get('/channel-emotes/reports').catch(() => null)]);
            setEmotes(res.data.emotes);
            setSettings(res.data.settings);
            setUsage(res.data.usage);
            setCanUpload(res.data.canUpload);
            setIsOwnerLevel(res.data.isOwnerLevel);
            setChannelLogin(res.data.channelLogin || '');
            setReports(rep?.data?.reports ?? []);
            setError(null);
        } catch (e) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            setError(status === 403 ? 'forbidden' : 'load_failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const run = useCallback(async (call: () => Promise<unknown>): Promise<string | null> => {
        try { await call(); await load(); return null; }
        catch (e) { return errorCodeOf(e); }
    }, [load]);

    const upload = (file: File, name: string, zeroWidth: boolean) =>
        run(() => api.post('/channel-emotes', buildUploadForm(file, name, zeroWidth), { headers: { 'Content-Type': 'multipart/form-data' } }));
    const update = (id: number, patch: { name?: string; zeroWidth?: boolean; visible?: boolean }) => run(() => api.put(`/channel-emotes/${id}`, patch));
    const review = (id: number, approve: boolean, reason?: string) => run(() => api.post(`/channel-emotes/${id}/review`, { approve, reason }));
    const reviewBatch = (ids: number[], approve: boolean, reason?: string) => run(() => api.post('/channel-emotes/review-batch', { ids, approve, reason }));
    const remove = (id: number, reason?: string) => run(() => api.delete(`/channel-emotes/${id}`, { params: { reason } }));
    const purgeHistory = () => run(() => api.post('/channel-emotes/history/purge'));
    const dismissReports = (id: number) => run(() => api.post(`/channel-emotes/${id}/reports/dismiss`));
    const saveSettings = (patch: { uploadMode?: UploadMode; maxPendingPerUser?: number }) => run(() => api.put('/channel-emotes/settings', patch));

    const loadUploaders = useCallback(async () => {
        try { const res = await api.get('/channel-emotes/uploaders'); setUploaders(res.data.uploaders); } catch { /* sin permiso: queda vacío */ }
    }, []);
    const addUploader = async (platform: 'twitch' | 'kick', login: string): Promise<string | null> => {
        try { await api.post('/channel-emotes/uploaders', { platform, login }); await loadUploaders(); return null; }
        catch (e) { return errorCodeOf(e); }
    };
    const removeUploader = async (id: number) => { try { await api.delete(`/channel-emotes/uploaders/${id}`); await loadUploaders(); } catch { /* se reintenta */ } };

    return {
        loading, error, emotes, settings, usage, canUpload, isOwnerLevel, channelLogin, reports, uploaders,
        reload: load, upload, update, review, reviewBatch, remove, purgeHistory, dismissReports, saveSettings, loadUploaders, addUploader, removeUploader,
    };
}

export type ChannelEmotesState = ReturnType<typeof useChannelEmotes>;
