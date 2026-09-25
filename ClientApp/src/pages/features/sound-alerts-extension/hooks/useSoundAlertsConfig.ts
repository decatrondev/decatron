import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';
import type { AlertDesign, ChannelPointsReward, SoundAlertSettings, SoundFile } from '../types';
import { normalizeSettings, toSaveRequest } from '../model';

/** Carga y guarda la config de Sound Alerts, con las recompensas y los archivos asignados. */
export function useSoundAlertsConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<SoundAlertSettings>(() => normalizeSettings(null));
    const [dirty, setDirty] = useState(false);
    const [rewards, setRewards] = useState<ChannelPointsReward[]>([]);
    const [files, setFiles] = useState<SoundFile[]>([]);
    const [systemFiles, setSystemFiles] = useState<any[]>([]);
    const [channelName, setChannelName] = useState('');

    const loadFiles = useCallback(async () => {
        try {
            const res = await api.get('/soundalerts/files');
            if (res.data.success) setFiles(res.data.files || []);
        } catch { /* la lista queda como estaba */ }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [cfg, rw, sys] = await Promise.all([
                api.get('/soundalerts/config'),
                api.get('/soundalerts/channel-points-rewards').catch(() => null),
                api.get('/soundalerts/system-files').catch(() => null),
                loadFiles(),
            ]);
            setSettings(normalizeSettings(cfg.data?.config));
            if (rw?.data?.success) {
                setRewards(rw.data.rewards || []);
                if (rw.data.channelName) setChannelName(rw.data.channelName);
            }
            if (sys?.data?.success) setSystemFiles(sys.data.files || []);
            setDirty(false);
            setError(null);
        } catch (e: any) {
            setError(e?.response?.status === 403 ? 'forbidden' : 'load_failed');
        } finally {
            setLoading(false);
        }
    }, [loadFiles]);

    useEffect(() => { load(); }, [load]);

    const update = useCallback((patch: Partial<Omit<SoundAlertSettings, 'design'>>) => {
        setSettings(prev => ({ ...prev, ...patch }));
        setDirty(true);
    }, []);

    const updateDesign = useCallback((next: AlertDesign | ((prev: AlertDesign) => AlertDesign)) => {
        setSettings(prev => ({ ...prev, design: typeof next === 'function' ? next(prev.design) : next }));
        setDirty(true);
    }, []);

    const save = useCallback(async (): Promise<string | null> => {
        setSaving(true);
        try {
            await api.post('/soundalerts/config', toSaveRequest(settings));
            setDirty(false);
            return null;
        } catch (e: any) {
            return e?.response?.data?.message || 'save_failed';
        } finally {
            setSaving(false);
        }
    }, [settings]);

    return {
        loading, saving, error, dirty, settings, rewards, files, systemFiles, channelName,
        update, updateDesign, save, loadFiles, reload: load,
    };
}

export type SoundAlertsConfigState = ReturnType<typeof useSoundAlertsConfig>;
