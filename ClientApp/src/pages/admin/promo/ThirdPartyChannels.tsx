import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ds';
import api from '../../../services/api';

interface Row { login: string; status: 'ready' | 'needsBranded' | 'unknown' | 'notRequired'; live: boolean; viewers: number; sampledAt: string | null; hasTwitch: boolean; hasKick: boolean }
const TONE = { ready: 'ok', needsBranded: 'warn', unknown: undefined, notRequired: undefined } as const;

/** Canales que aceptan publicidad de terceros y si hoy podrían recibirla (contenido de marca, directo, espectadores). Solo hay dato de quien tiene el overlay abierto. */
export function ThirdPartyChannels() {
    const { t } = useTranslation('promo');
    const [rows, setRows] = useState<Row[] | null>(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => {
        setBusy(true);
        try { const r = await api.get('/admin/promo/third-party-channels'); setRows((r.data?.channels ?? []) as Row[]); } catch { setRows([]); }
        setBusy(false);
    }, []);
    useEffect(() => { load(); }, [load]);
    if (rows === null) return null;

    return (
        <Card>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                <h2 className="text-base font-bold text-ds-text">{t('admin.thirdChannels.title')}</h2>
                <Button variant="secondary" size="sm" icon={<RefreshCw />} loading={busy} onClick={load}>{t('admin.thirdChannels.refresh')}</Button>
            </div>
            <p className="text-sm text-ds-soft max-w-2xl mb-4">{t('admin.thirdChannels.description')}</p>
            {rows.length === 0 ? <p className="text-sm text-ds-soft">{t('admin.thirdChannels.none')}</p> : (
                <ul className="list-none m-0 p-0 max-w-3xl divide-y divide-ds-border">
                    {rows.map(r => (
                        <li key={r.login} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-bold text-ds-text min-w-[8rem]">{r.login}</span>
                            <Badge tone={TONE[r.status]}>{t(`admin.thirdChannels.status.${r.status}`)}</Badge>
                            <span className="text-sm text-ds-soft">{r.live ? t('admin.thirdChannels.live', { n: r.viewers }) : t('admin.thirdChannels.offline')}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
