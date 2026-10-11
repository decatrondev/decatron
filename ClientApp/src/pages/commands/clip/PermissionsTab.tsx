import { useCallback, useEffect, useState } from 'react';
import { Ban, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Input } from '../../../components/ds';
import { ConfigCard, hintCls } from '../../../components/dashboard/config';
import api from '../../../services/api';
import type { ClipCfg, ClipRole } from './useClipConfig';

interface Block { id: number; login: string }

export default function PermissionsTab({ cfg }: { cfg: ClipCfg }) {
    const { t } = useTranslation('clipcommand');
    const roles = cfg.roles.length ? cfg.roles : (['everyone', 'follower', 'subscriber', 'vip', 'moderator', 'lead_moderator', 'broadcaster'] as ClipRole[]);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [login, setLogin] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/clipcommand/blocks');
            setBlocks(res.data?.blocks ?? []);
        } catch { /* se queda la lista vacía */ }
    }, []);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        const name = login.trim();
        if (!name) return;
        setBusy(true);
        setError(null);
        try {
            await api.post('/clipcommand/blocks', { login: name });
            setLogin('');
            await load();
        } catch {
            setError(t('permissions.blockFailed'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: number) => {
        try { await api.delete(`/clipcommand/blocks/${id}`); await load(); } catch { /* sin cambios */ }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfigCard icon={<Users />} title={t('permissions.minRoleTitle')} hint={t('permissions.minRoleHint')}>
                <div className="space-y-2" role="radiogroup" aria-label={t('permissions.minRoleTitle')}>
                    {roles.map(role => (
                        <button key={role} type="button" role="radio" aria-checked={cfg.config.minRole === role}
                            onClick={() => cfg.update('minRole', role)}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                                cfg.config.minRole === role ? 'bg-ds-accent/10 border-ds-accent' : 'bg-ds-bg border-ds-border hover:border-ds-accent'}`}>
                            <span className="text-sm font-semibold text-ds-text">{t(`permissions.roles.${role}`)}</span>
                            {cfg.config.minRole === role && <Badge tone="accent">✓</Badge>}
                        </button>
                    ))}
                </div>
                {cfg.config.minRole === 'follower' && <div className="mt-4"><Alert tone="info">{t('permissions.followerNote')}</Alert></div>}
            </ConfigCard>

            <ConfigCard icon={<Ban />} title={t('permissions.blocksTitle')} hint={t('permissions.blocksHint')}>
                <div className="flex gap-2 mb-4">
                    <Input value={login} maxLength={25} placeholder={t('permissions.blockPlaceholder')}
                        onChange={e => setLogin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
                    <Button onClick={add} loading={busy} disabled={busy || !login.trim()}>{t('permissions.blockAdd')}</Button>
                </div>
                {error && <div className="mb-3"><Alert tone="danger">{error}</Alert></div>}
                {blocks.length === 0 ? (
                    <p className={hintCls}>{t('permissions.blocksEmpty')}</p>
                ) : (
                    <ul className="space-y-2">
                        {blocks.map(b => (
                            <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-ds-bg border border-ds-border">
                                <span className="text-sm text-ds-text font-mono truncate">{b.login}</span>
                                <Button variant="secondary" size="sm" onClick={() => remove(b.id)}>{t('permissions.blockRemove')}</Button>
                            </li>
                        ))}
                    </ul>
                )}
            </ConfigCard>
        </div>
    );
}
