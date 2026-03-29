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
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <Shield className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                        Requisitos de Entrada
                    </h2>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Define quién puede participar en el giveaway
                    </p>
                </div>
            </div>

            {/* Requisitos Básicos */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-emerald-500" />
                    Requisitos Básicos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Must Follow */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Debe Seguir el Canal</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Solo followers pueden participar</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ mustFollow: !requirements.mustFollow })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.mustFollow
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {requirements.mustFollow ? 'Requerido' : 'No requerido'}
                        </button>
                    </div>

                    {/* Must Subscribe */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Debe Estar Suscrito</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Solo subscribers pueden participar</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ mustSubscribe: !requirements.mustSubscribe })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.mustSubscribe
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {requirements.mustSubscribe ? 'Requerido' : 'No requerido'}
                        </button>
                    </div>

                    {/* Allow VIPs */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Permitir VIPs</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">VIPs pueden participar</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ allowVips: !requirements.allowVips })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.allowVips
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {requirements.allowVips ? 'Permitido' : 'No permitido'}
                        </button>
                    </div>

                    {/* Allow Moderators */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Permitir Moderadores</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Mods pueden participar</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ allowModerators: !requirements.allowModerators })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.allowModerators
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {requirements.allowModerators ? 'Permitido' : 'No permitido'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Requisitos de Tiempo */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    Requisitos de Tiempo
                </h3>

                <div className="space-y-4">
                    {/* Minimum Watch Time */}
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Tiempo Mínimo Viendo</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Minutos viendo el stream actual</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumWatchTimeEnabled: !requirements.minimumWatchTimeEnabled })}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                    requirements.minimumWatchTimeEnabled
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
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
                                className="w-full px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]"
                                placeholder="Minutos"
                            />
                        )}
                    </div>

                    {/* Minimum Account Age */}
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Edad Mínima de Cuenta</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Tiempo desde que se creó la cuenta de Twitch</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumAccountAgeEnabled: !requirements.minimumAccountAgeEnabled })}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                    requirements.minimumAccountAgeEnabled
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
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
                                    className="flex-1 px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]"
                                    placeholder="Cantidad"
                                />
                                <select
                                    value={requirements.minimumAccountAgeUnit || 'days'}
                                    onChange={(e) => onUpdateRequirements({ minimumAccountAgeUnit: e.target.value as 'days' | 'months' | 'years' })}
                                    className="px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] font-bold"
                                >
                                    <option value="days">Días</option>
                                    <option value="months">Meses</option>
                                    <option value="years">Años</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Minimum Follow Age */}
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Tiempo Mínimo Siguiendo</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Tiempo desde que sigue el canal</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumFollowAgeEnabled: !requirements.minimumFollowAgeEnabled })}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                    requirements.minimumFollowAgeEnabled
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
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
                                    className="flex-1 px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]"
                                    placeholder="Cantidad"
                                />
                                <select
                                    value={requirements.minimumFollowAgeUnit || 'days'}
                                    onChange={(e) => onUpdateRequirements({ minimumFollowAgeUnit: e.target.value as 'days' | 'months' | 'years' })}
                                    className="px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc] font-bold"
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
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-500" />
                    Actividad en Chat
                </h3>

                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Mensajes Mínimos en Chat</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Número mínimo de mensajes en el stream actual</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ minimumChatMessagesEnabled: !requirements.minimumChatMessagesEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.minimumChatMessagesEnabled
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
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
                            className="w-full px-4 py-3 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]"
                            placeholder="Mensajes"
                        />
                    )}
                </div>
            </div>

            {/* Anti-Trampa */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Ban className="w-5 h-5 text-rose-500" />
                    Protección Anti-Trampa
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Block Multiple Accounts */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Bloquear Multi-Cuentas</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Detectar cuentas duplicadas</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ blockMultipleAccounts: !requirements.blockMultipleAccounts })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.blockMultipleAccounts
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {requirements.blockMultipleAccounts ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {/* Check IP Duplication */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Verificar IP Duplicada</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Detectar misma IP</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ checkIpDuplication: !requirements.checkIpDuplication })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                requirements.checkIpDuplication
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {requirements.checkIpDuplication ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Blacklist / Whitelist */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">
                    Listas de Usuarios
                </h3>

                {/* Use Whitelist Toggle */}
                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div>
                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Usar Whitelist</p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Solo usuarios en whitelist pueden participar</p>
                    </div>
                    <button
                        onClick={() => onUpdateRequirements({ useWhitelist: !requirements.useWhitelist })}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            requirements.useWhitelist
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        {requirements.useWhitelist ? 'Activado' : 'Desactivado'}
                    </button>
                </div>

                {/* Blacklist */}
                {!requirements.useWhitelist && (
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3">Blacklist (Usuarios Bloqueados)</p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder="Usuario a bloquear"
                                className="flex-1 px-4 py-2 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
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
                                className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors"
                            >
                                Añadir
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {requirements.blacklistedUsers.map((username) => (
                                <div
                                    key={username}
                                    className="px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2 border border-rose-200 dark:border-rose-800"
                                >
                                    {username}
                                    <button
                                        onClick={() => handleBlacklistRemove(username)}
                                        className="text-rose-500 hover:text-rose-700 font-bold"
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
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3">Whitelist (Usuarios Permitidos)</p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder="Usuario a permitir"
                                className="flex-1 px-4 py-2 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
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
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors"
                            >
                                Añadir
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {requirements.whitelistedUsers.map((username) => (
                                <div
                                    key={username}
                                    className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center gap-2 border border-emerald-200 dark:border-emerald-800"
                                >
                                    {username}
                                    <button
                                        onClick={() => handleWhitelistRemove(username)}
                                        className="text-emerald-500 hover:text-emerald-700 font-bold"
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
