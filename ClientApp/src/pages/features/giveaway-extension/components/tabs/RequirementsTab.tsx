/**
 * RequirementsTab - Tab para configurar requisitos de entrada
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Clock, UserCheck, MessageSquare, Ban } from 'lucide-react';
import type { GiveawayRequirements } from '../../types';

interface RequirementsTabProps {
    requirements: GiveawayRequirements;
    onUpdateRequirements: (updates: Partial<GiveawayRequirements>) => void;
}

export const RequirementsTab: React.FC<RequirementsTabProps> = ({ requirements, onUpdateRequirements }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
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
                        {t('requirements.title')}
                    </h2>
                    <p className="text-sm text-ds-soft">
                        {t('requirements.subtitle')}
                    </p>
                </div>
            </div>

            {/* Requisitos Básicos */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-ds-accent-text" />
                    {t('requirements.basic')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Must Follow */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('requirements.mustFollow')}</p>
                            <p className="text-xs text-ds-soft">{t('requirements.mustFollowHint')}</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ mustFollow: !requirements.mustFollow })}
                            className={requirements.mustFollow ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {requirements.mustFollow ? t('common.required') : t('common.notRequired')}
                        </button>
                    </div>

                    {/* Must Subscribe */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('requirements.mustSub')}</p>
                            <p className="text-xs text-ds-soft">{t('requirements.mustSubHint')}</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ mustSubscribe: !requirements.mustSubscribe })}
                            className={requirements.mustSubscribe ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {requirements.mustSubscribe ? t('common.required') : t('common.notRequired')}
                        </button>
                    </div>

                    {/* Allow VIPs */}
                    <div className={`flex items-center justify-between p-4 bg-ds-bg rounded-lg border ${requirements.allowVips ? 'border-ds-border' : 'border-ds-warn'}`}>
                        <div>
                            <p className="font-bold text-ds-text">VIPs</p>
                            <p className="text-xs text-ds-soft">
                                {requirements.allowVips
                                    ? t('requirements.vipsOk')
                                    : t('requirements.vipsNo')}
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ allowVips: !requirements.allowVips })}
                            className={requirements.allowVips ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {requirements.allowVips ? t('common.canTake') : t('common.blocked')}
                        </button>
                    </div>

                    {/* Allow Moderators */}
                    <div className={`flex items-center justify-between p-4 bg-ds-bg rounded-lg border ${requirements.allowModerators ? 'border-ds-border' : 'border-ds-warn'}`}>
                        <div>
                            <p className="font-bold text-ds-text">{t('requirements.mods')}</p>
                            <p className="text-xs text-ds-soft">
                                {requirements.allowModerators
                                    ? t('requirements.modsOk')
                                    : t('requirements.modsNo')}
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ allowModerators: !requirements.allowModerators })}
                            className={requirements.allowModerators ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {requirements.allowModerators ? t('common.canTake') : t('common.blocked')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Requisitos de Tiempo */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-ds-accent-text" />
                    {t('requirements.timeReq')}
                </h3>

                <div className="space-y-4">
                    {/* Minimum Watch Time */}
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-ds-text">{t('requirements.watch')}</p>
                                <p className="text-xs text-ds-soft">{t('requirements.watchHint')}</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumWatchTimeEnabled: !requirements.minimumWatchTimeEnabled })}
                                className={requirements.minimumWatchTimeEnabled ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                            >
                                {requirements.minimumWatchTimeEnabled ? t('common.on') : t('common.off')}
                            </button>
                        </div>
                        {requirements.minimumWatchTimeEnabled && (
                            <input
                                type="number"
                                min={0}
                                value={requirements.minimumWatchTime}
                                onChange={(e) => onUpdateRequirements({ minimumWatchTime: parseInt(e.target.value) || 0 })}
                                className="ds-input w-full"
                                placeholder={t('requirements.minutesPh')}
                            />
                        )}
                    </div>

                    {/* Minimum Account Age */}
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-ds-text">{t('requirements.accAge')}</p>
                                <p className="text-xs text-ds-soft">{t('requirements.accAgeHint')}</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumAccountAgeEnabled: !requirements.minimumAccountAgeEnabled })}
                                className={requirements.minimumAccountAgeEnabled ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                            >
                                {requirements.minimumAccountAgeEnabled ? t('common.on') : t('common.off')}
                            </button>
                        </div>
                        {requirements.minimumAccountAgeEnabled && (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={requirements.minimumAccountAge}
                                    onChange={(e) => onUpdateRequirements({ minimumAccountAge: parseInt(e.target.value) || 0 })}
                                    className="ds-input flex-1 min-w-0"
                                    placeholder={t('requirements.amountPh')}
                                />
                                <select
                                    value={requirements.minimumAccountAgeUnit || 'days'}
                                    onChange={(e) => onUpdateRequirements({ minimumAccountAgeUnit: e.target.value as 'days' | 'months' | 'years' })}
                                    className="ds-input shrink-0"
                                    style={{ width: 'auto' }}
                                >
                                    <option value="days">{t('requirements.days')}</option>
                                    <option value="months">{t('requirements.months')}</option>
                                    <option value="years">{t('requirements.years')}</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Minimum Follow Age */}
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-ds-text">{t('requirements.followAge')}</p>
                                <p className="text-xs text-ds-soft">{t('requirements.followAgeHint')}</p>
                            </div>
                            <button
                                onClick={() => onUpdateRequirements({ minimumFollowAgeEnabled: !requirements.minimumFollowAgeEnabled })}
                                className={requirements.minimumFollowAgeEnabled ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                            >
                                {requirements.minimumFollowAgeEnabled ? t('common.on') : t('common.off')}
                            </button>
                        </div>
                        {requirements.minimumFollowAgeEnabled && (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={requirements.minimumFollowAge}
                                    onChange={(e) => onUpdateRequirements({ minimumFollowAge: parseInt(e.target.value) || 0 })}
                                    className="ds-input flex-1 min-w-0"
                                    placeholder={t('requirements.amountPh')}
                                />
                                <select
                                    value={requirements.minimumFollowAgeUnit || 'days'}
                                    onChange={(e) => onUpdateRequirements({ minimumFollowAgeUnit: e.target.value as 'days' | 'months' | 'years' })}
                                    className="ds-input shrink-0"
                                    style={{ width: 'auto' }}
                                >
                                    <option value="days">{t('requirements.days')}</option>
                                    <option value="months">{t('requirements.months')}</option>
                                    <option value="years">{t('requirements.years')}</option>
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
                    {t('requirements.chatAct')}
                </h3>

                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="font-bold text-ds-text">{t('requirements.chatMsgs')}</p>
                            <p className="text-xs text-ds-soft">{t('requirements.chatMsgsHint')}</p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ minimumChatMessagesEnabled: !requirements.minimumChatMessagesEnabled })}
                            className={requirements.minimumChatMessagesEnabled ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {requirements.minimumChatMessagesEnabled ? t('common.on') : t('common.off')}
                        </button>
                    </div>
                    {requirements.minimumChatMessagesEnabled && (
                        <input
                            type="number"
                            min={0}
                            value={requirements.minimumChatMessages}
                            onChange={(e) => onUpdateRequirements({ minimumChatMessages: parseInt(e.target.value) || 0 })}
                            className="ds-input w-full"
                            placeholder={t('requirements.msgsPh')}
                        />
                    )}
                </div>
            </div>

            {/* Anti-Trampa */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Ban className="w-5 h-5 text-ds-accent-text" />
                    {t('requirements.anti')}
                </h3>
                <p className="text-sm text-ds-soft">
                    {t('requirements.antiHint')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Block Multiple Accounts */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('requirements.multi')}</p>
                            <p className="text-xs text-ds-soft">
                                {t('requirements.multiHint')}
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ blockMultipleAccounts: !requirements.blockMultipleAccounts })}
                            className={requirements.blockMultipleAccounts ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {requirements.blockMultipleAccounts ? t('common.on') : t('common.off')}
                        </button>
                    </div>

                    {/* Check IP Duplication */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('requirements.ip')}</p>
                            <p className="text-xs text-ds-warn">
                                {t('requirements.ipHint')}
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateRequirements({ checkIpDuplication: !requirements.checkIpDuplication })}
                            className={requirements.checkIpDuplication ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {requirements.checkIpDuplication ? t('common.on') : t('common.off')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Blacklist / Whitelist */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text">
                    {t('requirements.lists')}
                </h3>

                {/* Use Whitelist Toggle */}
                <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div>
                        <p className="font-bold text-ds-text">{t('requirements.useWl')}</p>
                        <p className="text-xs text-ds-soft">{t('requirements.useWlHint')}</p>
                    </div>
                    <button
                        onClick={() => onUpdateRequirements({ useWhitelist: !requirements.useWhitelist })}
                        className={requirements.useWhitelist ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                    >
                        {requirements.useWhitelist ? t('common.on') : t('common.off')}
                    </button>
                </div>

                {/* Blacklist */}
                {!requirements.useWhitelist && (
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <p className="font-bold text-ds-text mb-3">{t('requirements.bl')}</p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder={t('requirements.blPh')}
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
                                {t('common.add')}
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
                        <p className="font-bold text-ds-text mb-3">{t('requirements.wl')}</p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder={t('requirements.wlPh')}
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
                                {t('common.add')}
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
