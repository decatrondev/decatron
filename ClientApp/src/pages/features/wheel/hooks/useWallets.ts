import { useCallback, useState } from 'react';
import api from '../../../../services/api';
import type { ViewerWallet } from '../model';
import type { PanelCtx } from './context';

/** Las billeteras de créditos de los espectadores del canal. */
export function useWallets({ t, setStatus }: PanelCtx) {
    const [wallets, setWallets] = useState<ViewerWallet[]>([]);
    const [search, setSearch] = useState('');

    const load = useCallback(async (term: string) => {
        try {
            const { data } = await api.get('/wheel/wallets', { params: { search: term || undefined } });
            if (data?.success) setWallets(data.items || []);
        } catch {
            setStatus({ kind: 'error', text: t('wheel.status.loadFailed') });
        }
    }, [t, setStatus]);

    const setCredits = async (viewer: string, credits: number) => {
        try {
            await api.put(`/wheel/wallets/${encodeURIComponent(viewer)}`, { credits });
            setWallets(prev => prev.map(w => w.viewer === viewer ? { ...w, credits } : w));
            setStatus({ kind: 'ok', text: t('wheel.status.saved') });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            setStatus({ kind: 'error', text: e?.response?.data?.message || t('wheel.status.saveFailed') });
        }
    };

    return { wallets, search, setSearch, load, setCredits };
}
