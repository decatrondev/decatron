import { useState } from 'react';
import api from '../../../../services/api';
import type { RaffleConfig, RaffleEntry } from '../model';
import type { PanelCtx } from './context';

/** El pool, la ventana de inscripción y el sorteo del modo Sorteo. */
export function useRaffleAdmin({ wheel, t, setStatus, setSaving }: PanelCtx) {
    const [raffle, setRaffle] = useState<RaffleConfig | null>(null);
    const [entries, setEntries] = useState<RaffleEntry[]>([]);

    const clear = () => {
        setRaffle(null);
        setEntries([]);
    };

    const load = async (id: number) => {
        try {
            const { data } = await api.get(`/wheel/wheels/${id}/raffle`);
            if (data?.success) {
                setRaffle(data.config);
                setEntries(data.entries || []);
            }
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    };

    const patch = (changes: Partial<RaffleConfig>) =>
        setRaffle(prev => (prev ? { ...prev, ...changes } : prev));

    const save = async () => {
        if (!wheel || !raffle) return;
        setSaving(true);
        setStatus(null);
        try {
            const { data } = await api.put(`/wheel/wheels/${wheel.id}/raffle`, raffle);
            // El backend recalcula los pesos del pool al cambiar los multiplicadores:
            // sin eso, tocar un peso no afectaria a nadie que ya estuviera inscrito.
            await load(wheel.id);
            setStatus({
                kind: 'ok',
                text: data?.recalculated > 0
                    ? t('wheel.raffle.savedRecalc', { count: data.recalculated })
                    : t('wheel.status.saved'),
            });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        } finally {
            setSaving(false);
        }
    };

    /** Las acciones chicas: llamar, recargar el pool, y avisar solo si falló. */
    const act = async (call: () => Promise<unknown>) => {
        if (!wheel) return;
        try {
            await call();
            await load(wheel.id);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.saveFailed') });
        }
    };

    const setWindow = (open: boolean) =>
        act(() => api.post(`/wheel/wheels/${wheel!.id}/raffle/window`, { open }));

    const add = async (viewer: string) => {
        if (!viewer.trim()) return;
        await act(() => api.post(`/wheel/wheels/${wheel!.id}/raffle/entries`, { viewer: viewer.trim() }));
    };

    /**
     * Alta de muchos nombres a la vez. Usa el mismo endpoint de alta manual de siempre (uno por
     * nombre, de a 5 en paralelo) y recarga el pool UNA vez al final: `add` lo recargaria por
     * cada nombre. Devuelve cuantos entraron, cuantos ya estaban o no pudieron entrar por las
     * reglas del sorteo, y cuantos fallaron de verdad.
     */
    const importMany = async (names: string[]) => {
        if (!wheel) return null;
        let ok = 0, already = 0, failed = 0;
        for (let i = 0; i < names.length; i += 5) {
            const lote = names.slice(i, i + 5);
            const res = await Promise.allSettled(
                lote.map(v => api.post(`/wheel/wheels/${wheel.id}/raffle/entries`, { viewer: v })));
            for (const r of res) {
                if (r.status === 'rejected') failed++;
                else if (r.value.data?.result === 'Ok') ok++;
                else already++;
            }
        }
        await load(wheel.id);
        return { ok, already, failed };
    };

    const remove = (viewer: string) =>
        act(() => api.delete(`/wheel/wheels/${wheel!.id}/raffle/entries/${encodeURIComponent(viewer)}`));

    const setMultiplier = (viewer: string, multiplier: number) =>
        act(() => api.put(`/wheel/wheels/${wheel!.id}/raffle/entries/${encodeURIComponent(viewer)}/multiplier`, { multiplier }));

    const reset = () =>
        act(() => api.post(`/wheel/wheels/${wheel!.id}/raffle/reset`));

    const draw = async () => {
        if (!wheel) return;
        setSaving(true);
        try {
            const { data } = await api.post(`/wheel/wheels/${wheel.id}/raffle/draw`);
            await load(wheel.id);
            setStatus({ kind: 'ok', text: t('wheel.raffle.drawn', { winners: (data.winners || []).join(', ') }) });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            const reason = e?.response?.data?.reason;
            setStatus({
                kind: 'error',
                text: reason === 'PoolInsuficiente' || reason === 'PoolVacio'
                    ? t('wheel.raffle.needTwo')
                    : t('wheel.status.saveFailed'),
            });
        } finally {
            setSaving(false);
        }
    };

    return { raffle, entries, clear, load, patch, save, setWindow, add, importMany, remove, setMultiplier, reset, draw };
}
