/**
 * ActiveInsights - Qué reglas tiene el giveaway en curso y a quién se rechazó (y por qué).
 * Las reglas salen de la copia que el sorteo guardó al iniciar: es lo que de verdad se está aplicando,
 * aunque después se haya cambiado el panel.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListChecks, ShieldAlert } from 'lucide-react';
import api from '../../../../services/api';
import type { GiveawayConfig } from '../types';
import { rejectionLabel } from '../types';

interface Rejection {
    at: string;
    username: string;
    reason: string;
    text: string;
}

type T = (k: string, o?: Record<string, unknown>) => string;

const fmtUnit = (t: T, n: number, unit: string) => t(`insights.unit_${unit === 'months' || unit === 'years' ? unit : 'days'}`, { count: n });

/** Frases cortas con las reglas efectivas del sorteo (solo lo que está activo). `blocked` marca las que son un bloqueo. */
export const describeRules = (t: T, config: GiveawayConfig): { allowed: { text: string; blocked: boolean }[]; required: string[] } => {
    const r: any = config.requirements ?? {};
    const required: string[] = [];
    const allowed: { text: string; blocked: boolean }[] = [];

    if (r.useWhitelist) required.push(t('insights.whitelist', { n: (r.whitelistedUsers ?? []).length }));
    if (r.mustFollow) required.push(t('insights.mustFollow'));
    if (r.mustSubscribe) required.push(t('insights.mustSub'));
    if (r.minimumWatchTimeEnabled) required.push(t('insights.watch', { n: r.minimumWatchTime }));
    if (r.minimumAccountAgeEnabled) required.push(t('insights.accAge', { v: fmtUnit(t, r.minimumAccountAge, r.minimumAccountAgeUnit) }));
    if (r.minimumFollowAgeEnabled) required.push(t('insights.followAge', { v: fmtUnit(t, r.minimumFollowAge, r.minimumFollowAgeUnit) }));
    if (r.minimumChatMessagesEnabled) required.push(t('insights.chat', { n: r.minimumChatMessages }));
    if (r.blockMultipleAccounts) required.push(t('insights.noDup'));
    if ((r.blacklistedUsers ?? []).length > 0) required.push(t('insights.blacklist', { count: r.blacklistedUsers.length }));

    const modsBlocked = r.allowModerators === false;
    const vipsBlocked = r.allowVips === false;
    allowed.push({ text: modsBlocked ? t('insights.modsBlocked') : t('insights.modsOk'), blocked: modsBlocked });
    allowed.push({ text: vipsBlocked ? t('insights.vipsBlocked') : t('insights.vipsOk'), blocked: vipsBlocked });
    if (config.settings?.roles?.streamerCanJoin === false) allowed.push({ text: t('insights.streamerBlocked'), blocked: true });
    if (config.allowMultipleEntries) allowed.push({ text: t('insights.multiEntry'), blocked: false });
    return { allowed, required };
};

interface ActiveInsightsProps {
    config: GiveawayConfig;
    isActive: boolean;
}

export const ActiveInsights: React.FC<ActiveInsightsProps> = ({ config, isActive }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    const [rejections, setRejections] = useState<Rejection[]>([]);

    useEffect(() => {
        if (!isActive) return;
        let cancelled = false;
        const load = async () => {
            try {
                const res = await api.get('/giveaway/rejections');
                if (!cancelled && res.data?.success) setRejections(res.data.rejections ?? []);
            } catch {
                /* el panel sigue funcionando sin esta lista */
            }
        };
        load();
        const id = setInterval(load, 4000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [isActive]);

    const { allowed, required } = describeRules(t, config);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2 mb-1">
                    <ListChecks className="w-5 h-5 text-ds-accent-text" />
                    {t('insights.rulesTitle')}
                </h3>
                <p className="text-xs text-ds-soft mb-4">
                    {t('insights.entryCommand')}: <code>{config.entryCommand}</code>
                    {config.allowAutoEntry ? ` · ${t('insights.autoEntry')}` : ''}
                </p>
                <ul className="space-y-2 text-sm">
                    {required.length === 0 && <li className="text-ds-soft">{t('insights.noReq')}</li>}
                    {required.map((x) => (
                        <li key={x} className="flex gap-2 text-ds-text"><span className="text-ds-ok">●</span>{x}</li>
                    ))}
                    {allowed.map((x) => (
                        <li key={x.text} className={`flex gap-2 ${x.blocked ? 'text-ds-warn' : 'text-ds-soft'}`}>
                            <span>●</span>{x.text}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-5 h-5 text-ds-accent-text" />
                    {t('insights.rejTitle')}
                </h3>
                <p className="text-xs text-ds-soft mb-4">
                    {t('insights.rejHint')}
                </p>
                {rejections.length === 0 ? (
                    <p className="text-sm text-ds-soft">{t('insights.rejNone')}</p>
                ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {rejections.map((r, i) => (
                            <li key={`${r.at}-${r.username}-${i}`} className="flex items-center justify-between gap-3 text-sm p-2 rounded bg-ds-bg border border-ds-border">
                                <span className="font-bold text-ds-text truncate">{r.username}</span>
                                <span className="text-ds-warn text-right">{rejectionLabel(t, r.reason)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
