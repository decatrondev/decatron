/**
 * RequirementsTab - Tab para configurar requisitos de entrada
 */

import React from 'react';
import { Shield, Clock, UserCheck, MessageSquare, Ban } from 'lucide-react';
import type { GiveawayRequirements } from '../../types';

interface RequirementsTabProps {
    requirements: GiveawayRequirements;
    onUpdateRequirements: (updates: Partial<GiveawayRequirements>) => void;
}

export const RequirementsTab: React.FC<RequirementsTabProps> = ({ requirements, onUpdateRequirements }) => {
    const handleBlacklistAdd = (username: string) => {
        if (username.trim() && !requirements.blacklistedUsers.includes(username.trim())) {
            onUpdateRequirements({
                blacklistedUsers: [...requirements.blacklistedUsers, username.trim()],
            });
        }
    };

    const handleBlacklistRemove = (username: string) => {
        onUpdateRequirements({
            blacklistedUsers: requirements.blacklistedUsers.filter((u) => u !== username),
        });
    };

    const handleWhitelistAdd = (username: string) => {
        if (username.trim() && !requirements.whitelistedUsers.includes(username.trim())) {
            onUpdateRequirements({
                whitelistedUsers: [...requirements.whitelistedUsers, username.trim()],
            });
        }
    };

    const handleWhitelistRemove = (username: string) => {
        onUpdateRequirements({
            whitelistedUsers: requirements.whitelistedUsers.filter((u) => u !== username),
        });
    };

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
                <div className="p-3 bg-ds-bg rounded-lg">
                    <Shield className="w-6 h-6 text-ds-soft" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-ds-text">
                        Requisitos de Entrada
                    </h2>
                    <p className="text-sm text-ds-soft">
                        Define quién puede participar en el giveaway
                    </p>
                </div>
            </div>

            {/* Requisitos Básicos */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-ds-accent-text" />
                    Requisitos Básicos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Must Follow */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Debe Seguir el Canal</p>
                            <p className="text-xs text-ds-soft">Solo followers pueden participar</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ mustFollow: !requirements.mustFollow })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.mustFollow
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {requirements.mustFollow ? 'Requerido' : 'No requerido'}
                        </button>
                    </div>

                    {/* Must Subscribe */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Debe Estar Suscrito</p>
                            <p className="text-xs text-ds-soft">Solo subscribers pueden participar</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ mustSubscribe: !requirements.mustSubscribe })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.mustSubscribe
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {requirements.mustSubscribe ? 'Requerido' : 'No requerido'}
                        </button>
                    </div>

                    {/* Allow VIPs */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Permitir VIPs</p>
                            <p className="text-xs text-ds-soft">VIPs pueden participar</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ allowVips: !requirements.allowVips })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.allowVips
                                    ? 'bg-ds-warn text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {requirements.allowVips ? 'Permitido' : 'No permitido'}
                        </button>
                    </div>

                    {/* Allow Moderators */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Permitir Moderadores</p>
                            <p className="text-xs text-ds-soft">Mods pueden participar</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ allowModerators: !requirements.allowModerators })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.allowModerators
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {requirements.allowModerators ? 'Permitido' : 'No permitido'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Requisitos de Tiempo */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-ds-accent-text" />
                    Requisitos de Tiempo
                </h3>

                <div className="space-y-4">
                    {/* Minimum Watch Time */}
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-ds-text">Tiempo Mínimo Viendo</p>
                                <p className="text-xs text-ds-soft">Minutos viendo el stream actual</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumWatchTimeEnabled: !requirements.minimumWatchTimeEnabled })}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                    requirements.minimumWatchTimeEnabled
                                        ? 'bg-ds-accent text-ds-on-accent'
                                        : 'bg-ds-raised text-ds-soft '
                                }`}
                            >
                                {requirements.minimumWatchTimeEnabled ? 'Activado' : 'Desactivado'}
                            </button>
                        </div>
                        {requirements.minimumWatchTimeEnabled && (
                            <input
                                type="number"
                                min={0}
                                value={requirements.minimumWatchTime}
                                onChange={(e) => onUpdateRequirements({ minimumWatchTime: parseInt(e.target.value) || 0 })}
                                className="ds-input w-full"
                                placeholder="Minutos"
                            />
                        )}
                    </div>

                    {/* Minimum Account Age */}
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-ds-text">Edad Mínima de Cuenta</p>
                                <p className="text-xs text-ds-soft">Tiempo desde que se creó la cuenta de Twitch</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumAccountAgeEnabled: !requirements.minimumAccountAgeEnabled })}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                    requirements.minimumAccountAgeEnabled
                                        ? 'bg-ds-accent text-ds-on-accent'
                                        : 'bg-ds-raised text-ds-soft '
                                }`}
                            >
                                {requirements.minimumAccountAgeEnabled ? 'Activado' : 'Desactivado'}
                            </button>
                        </div>
                        {requirements.minimumAccountAgeEnabled && (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={requirements.minimumAccountAge}
                                    onChange={(e) => onUpdateRequirements({ minimumAccountAge: parseInt(e.target.value) || 0 })}
                                    className="ds-input flex-1"
                                    placeholder="Cantidad"
                                />
                                <select
                                    value={requirements.minimumAccountAgeUnit || 'days'}
                                    onChange={(e) => onUpdateRequirements({ minimumAccountAgeUnit: e.target.value as 'days' | 'months' | 'years' })}
                                    className="ds-input"
                                >
                                    <option value="days">Días</option>
                                    <option value="months">Meses</option>
                                    <option value="years">Años</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Minimum Follow Age */}
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-ds-text">Tiempo Mínimo Siguiendo</p>
                                <p className="text-xs text-ds-soft">Tiempo desde que sigue el canal</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumFollowAgeEnabled: !requirements.minimumFollowAgeEnabled })}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                    requirements.minimumFollowAgeEnabled
                                        ? 'bg-ds-accent text-ds-on-accent'
                                        : 'bg-ds-raised text-ds-soft '
                                }`}
                            >
                                {requirements.minimumFollowAgeEnabled ? 'Activado' : 'Desactivado'}
                            </button>
                        </div>
                        {requirements.minimumFollowAgeEnabled && (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={requirements.minimumFollowAge}
                                    onChange={(e) => onUpdateRequirements({ minimumFollowAge: parseInt(e.target.value) || 0 })}
                                    className="ds-input flex-1"
                                    placeholder="Cantidad"
                                />
                                <select
                                    value={requirements.minimumFollowAgeUnit || 'days'}
                                    onChange={(e) => onUpdateRequirements({ minimumFollowAgeUnit: e.target.value as 'days' | 'months' | 'years' })}
                                    className="ds-input"
                                >
                                    <option value="days">Días</option>
                                    <option value="months">Meses</option>
                                    <option value="years">Años</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Actividad en Chat */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-ds-accent-text" />
                    Actividad en Chat
                </h3>

                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-bold text-ds-text">Mensajes Mínimos en Chat</p>
                            <p className="text-xs text-ds-soft">Número mínimo de mensajes en el stream actual</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ minimumChatMessagesEnabled: !requirements.minimumChatMessagesEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.minimumChatMessagesEnabled
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {requirements.minimumChatMessagesEnabled ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>
                    {requirements.minimumChatMessagesEnabled && (
                        <input
                            type="number"
                            min={0}
                            value={requirements.minimumChatMessages}
                            onChange={(e) => onUpdateRequirements({ minimumChatMessages: parseInt(e.target.value) || 0 })}
                            className="ds-input w-full"
                            placeholder="Mensajes"
                        />
                    )}
                </div>
            </div>

            {/* Anti-Trampa */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Ban className="w-5 h-5 text-ds-accent-text" />
                    Protección Anti-Trampa
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Block Multiple Accounts */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Bloquear Multi-Cuentas</p>
                            <p className="text-xs text-ds-soft">Detectar cuentas duplicadas</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ blockMultipleAccounts: !requirements.blockMultipleAccounts })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.blockMultipleAccounts
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {requirements.blockMultipleAccounts ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {/* Check IP Duplication */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Verificar IP Duplicada</p>
                            <p className="text-xs text-ds-soft">Detectar misma IP</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ checkIpDuplication: !requirements.checkIpDuplication })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.checkIpDuplication
                                    ? 'bg-ds-accent text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {requirements.checkIpDuplication ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Blacklist / Whitelist */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text">
                    Listas de Usuarios
                </h3>

                {/* Use Whitelist Toggle */}
                <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div>
                        <p className="font-bold text-ds-text">Usar Whitelist</p>
                        <p className="text-xs text-ds-soft">Solo usuarios en whitelist pueden participar</p>
                    </div>
                    <button
                        onClick={() => onUpdateRequirements({ useWhitelist: !requirements.useWhitelist })}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            requirements.useWhitelist
                                ? 'bg-ds-accent text-ds-on-accent'
                                : 'bg-ds-raised text-ds-soft '
                        }`}
                    >
                        {requirements.useWhitelist ? 'Activado' : 'Desactivado'}
                    </button>
                </div>

                {/* Blacklist */}
                {!requirements.useWhitelist && (
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <p className="font-bold text-ds-text mb-3">Blacklist (Usuarios Bloqueados)</p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder="Usuario a bloquear"
                                className="ds-input flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleBlacklistAdd(e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                            <button
                                onClick={(e) => {
                                    const input = e.currentTarget.previousSibling as HTMLInputElement;
                                    handleBlacklistAdd(input.value);
                                    input.value = '';
                                }}
                                className="ds-btn ds-btn--primary"
                            >
                                Añadir
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {requirements.blacklistedUsers.map((username) => (
                                <div
                                    key={username}
                                    className="px-3 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg flex items-center gap-2 border border-ds-accent"
                                >
                                    {username}
                                    <button
                                        onClick={() => handleBlacklistRemove(username)}
                                        className="text-ds-accent-text hover:text-ds-accent-text font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Whitelist */}
                {requirements.useWhitelist && (
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <p className="font-bold text-ds-text mb-3">Whitelist (Usuarios Permitidos)</p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder="Usuario a permitir"
                                className="ds-input flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleWhitelistAdd(e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                            <button
                                onClick={(e) => {
                                    const input = e.currentTarget.previousSibling as HTMLInputElement;
                                    handleWhitelistAdd(input.value);
                                    input.value = '';
                                }}
                                className="ds-btn ds-btn--primary"
                            >
                                Añadir
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {requirements.whitelistedUsers.map((username) => (
                                <div
                                    key={username}
                                    className="px-3 py-1 bg-ds-ok/10 text-ds-ok rounded-lg flex items-center gap-2 border border-ds-ok/40"
                                >
                                    {username}
                                    <button
                                        onClick={() => handleWhitelistRemove(username)}
                                        className="text-ds-ok hover:text-ds-ok font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
