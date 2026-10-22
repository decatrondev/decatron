/**
 * ActiveInsights - Qué reglas tiene el giveaway en curso y a quién se rechazó (y por qué).
 * Las reglas salen de la copia que el sorteo guardó al iniciar: es lo que de verdad se está aplicando,
 * aunque después se haya cambiado el panel.
 */

import React, { useEffect, useState } from 'react';
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

const fmtUnit = (n: number, unit: string) => {
    const u = unit === 'months' ? (n === 1 ? 'mes' : 'meses') : unit === 'years' ? (n === 1 ? 'año' : 'años') : (n === 1 ? 'día' : 'días');
    return `${n} ${u}`;
};

/** Frases cortas con las reglas efectivas del sorteo (solo lo que está activo). */
export const describeRules = (config: GiveawayConfig): { allowed: string[]; required: string[] } => {
    const r: any = config.requirements ?? {};
    const required: string[] = [];
    const allowed: string[] = [];

    if (r.useWhitelist) required.push(`Solo la lista blanca (${(r.whitelistedUsers ?? []).length} personas)`);
    if (r.mustFollow) required.push('Seguir el canal');
    if (r.mustSubscribe) required.push('Estar suscrito');
    if (r.minimumWatchTimeEnabled) required.push(`Al menos ${r.minimumWatchTime} min viendo el canal`);
    if (r.minimumAccountAgeEnabled) required.push(`Cuenta de al menos ${fmtUnit(r.minimumAccountAge, r.minimumAccountAgeUnit)}`);
    if (r.minimumFollowAgeEnabled) required.push(`Siguiendo hace al menos ${fmtUnit(r.minimumFollowAge, r.minimumFollowAgeUnit)}`);
    if (r.minimumChatMessagesEnabled) required.push(`Al menos ${r.minimumChatMessages} mensajes en el chat`);
    if (r.blockMultipleAccounts) required.push('Sin cuentas que parezcan duplicadas');
    if ((r.blacklistedUsers ?? []).length > 0) required.push(r.blacklistedUsers.length === 1 ? '1 persona en la lista negra' : `${r.blacklistedUsers.length} personas en la lista negra`);

    allowed.push(r.allowModerators === false ? 'Moderadores: bloqueados' : 'Moderadores: pueden participar');
    allowed.push(r.allowVips === false ? 'VIP: bloqueados' : 'VIP: pueden participar');
    if (config.settings?.roles?.streamerCanJoin === false) allowed.push('Streamer: bloqueado');
    if (config.allowMultipleEntries) allowed.push('Se puede entrar varias veces (cada entrada pesa más)');
    return { allowed, required };
};

interface ActiveInsightsProps {
    config: GiveawayConfig;
    isActive: boolean;
}

export const ActiveInsights: React.FC<ActiveInsightsProps> = ({ config, isActive }) => {
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

    const { allowed, required } = describeRules(config);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2 mb-1">
                    <ListChecks className="w-5 h-5 text-ds-accent-text" />
                    Reglas de este giveaway
                </h3>
                <p className="text-xs text-ds-soft mb-4">
                    Comando de entrada: <code>{config.entryCommand}</code>
                    {config.allowAutoEntry ? ' · entrada automática al escribir en el chat' : ''}
                </p>
                <ul className="space-y-2 text-sm">
                    {required.length === 0 && <li className="text-ds-soft">Sin requisitos: cualquiera puede entrar.</li>}
                    {required.map((x) => (
                        <li key={x} className="flex gap-2 text-ds-text"><span className="text-ds-ok">●</span>{x}</li>
                    ))}
                    {allowed.map((x) => (
                        <li key={x} className={`flex gap-2 ${x.includes('bloquead') ? 'text-ds-warn' : 'text-ds-soft'}`}>
                            <span>●</span>{x}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-5 h-5 text-ds-accent-text" />
                    Rechazados recientes
                </h3>
                <p className="text-xs text-ds-soft mb-4">
                    Quién intentó entrar y no pudo, y por qué. Se vacía al reiniciar el servidor.
                </p>
                {rejections.length === 0 ? (
                    <p className="text-sm text-ds-soft">Nadie ha sido rechazado.</p>
                ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {rejections.map((r, i) => (
                            <li key={`${r.at}-${r.username}-${i}`} className="flex items-center justify-between gap-3 text-sm p-2 rounded bg-ds-bg border border-ds-border">
                                <span className="font-bold text-ds-text truncate">{r.username}</span>
                                <span className="text-ds-warn text-right">{rejectionLabel(r.reason)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
