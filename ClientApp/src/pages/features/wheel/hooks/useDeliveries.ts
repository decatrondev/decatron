import { useCallback, useEffect, useState } from 'react';
import api from '../../../../services/api';
import type { Delivery } from '../model';
import type { PanelCtx } from './context';

type Filter = 'pending' | 'all';

/**
 * La bandeja de entregas pendientes. Es del canal entero, no de la rueda abierta: al
 * streamer le importa que le debe a su gente, no en cual de sus ruedas salio.
 */
export function useDeliveries({ t, setStatus }: PanelCtx) {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [filter, setFilter] = useState<Filter>('pending');

    const load = useCallback(async (f: Filter) => {
        try {
            const { data } = await api.get('/wheel/deliveries', { params: { status: f } });
            if (data?.success) {
                setDeliveries(data.data || []);
                setPendingCount(data.pendingCount ?? 0);
            }
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    }, [t, setStatus]);

    useEffect(() => { load('pending'); }, [load]);

    const changeFilter = (f: Filter) => { setFilter(f); load(f); };

    const resolve = async (id: number, status: 'done' | 'cancelled' | 'pending') => {
        try {
            await api.put(`/wheel/deliveries/${id}`, { status });
            await load(filter);
            setStatus({ kind: 'ok', text: t('wheel.deliveries.saved') });
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.saveFailed') });
        }
    };

    return { deliveries, pendingCount, filter, changeFilter, resolve };
}
