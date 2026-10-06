import { useCallback, useState } from 'react';
import api from '../../../../services/api';
import { SPIN_FILTERS_VACIOS, type Metrics, type Spin, type SpinFilters } from '../model';
import type { PanelCtx } from './context';

/** El historial de giros de la rueda abierta, con sus filtros, métricas y CSV. */
export function useSpinHistory({ wheel, t, setStatus }: PanelCtx) {
    const [spins, setSpins] = useState<Spin[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<SpinFilters>(SPIN_FILTERS_VACIOS);
    const [metrics, setMetrics] = useState<Metrics | null>(null);

    const loadSpins = useCallback(async (wheelId: number, pageNumber: number, f: SpinFilters) => {
        try {
            const { data } = await api.get(`/wheel/wheels/${wheelId}/spins`, {
                params: {
                    page: pageNumber, pageSize: 50,
                    from: f.from || undefined,
                    to: f.to || undefined,
                    viewer: f.viewer || undefined,
                    trigger: f.trigger,
                    status: f.status,
                },
            });
            if (data?.success) {
                setSpins(data.items || []);
                setTotal(data.total ?? 0);
                setPage(data.page ?? 1);
            }
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    }, [t, setStatus]);

    const loadMetrics = useCallback(async (wheelId: number) => {
        try {
            const { data } = await api.get(`/wheel/wheels/${wheelId}/metrics`);
            if (data?.success) setMetrics(data);
        } catch {
            // Sin metricas el historial se sigue viendo, que es lo que se vino a ver.
        }
    }, []);

    const apply = () => { if (wheel) loadSpins(wheel.id, 1, filters); };

    const reset = () => {
        setFilters(SPIN_FILTERS_VACIOS);
        if (wheel) loadSpins(wheel.id, 1, SPIN_FILTERS_VACIOS);
    };

    const goToPage = (p: number) => { if (wheel) loadSpins(wheel.id, p, filters); };

    /**
     * Descarga el CSV. Va por `api` y no por un `<a href>` directo porque el
     * endpoint pide sesion: un enlace suelto llegaria sin credenciales y bajaria
     * el HTML del login con extension .csv.
     */
    const exportCsv = async () => {
        if (!wheel) return;
        try {
            const res = await api.get(`/wheel/wheels/${wheel.id}/spins/export`, {
                params: {
                    from: filters.from || undefined,
                    to: filters.to || undefined,
                    viewer: filters.viewer || undefined,
                    trigger: filters.trigger,
                    status: filters.status,
                },
                responseType: 'blob',
            });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `rueda-${wheel.slug}-giros.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    };

    return { spins, total, page, filters, setFilters, metrics, loadSpins, loadMetrics, apply, reset, goToPage, exportCsv };
}
