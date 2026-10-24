/**
 * SettingsTab - Configuración de anuncios, mensajes y cooldowns
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Bell, MessageCircle, Clock } from 'lucide-react';
import type { GiveawayConfig, GiveawaySettings } from '../../types';
import { SettingsExtras } from './SettingsExtras';

interface SettingsTabProps {
    config: GiveawayConfig;
    onUpdateConfig: (updates: Partial<GiveawayConfig>) => void;
    onUpdateSettings: <K extends keyof GiveawaySettings>(group: K, updates: Partial<GiveawaySettings[K]>) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ config, onUpdateConfig, onUpdateSettings }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
                <div className="p-3 bg-ds-raised rounded-lg">
                    <Settings className="w-6 h-6 text-ds-text" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-ds-text">
                        {t('settings.title')}
                    </h2>
                    <p className="text-sm text-ds-soft">
                        {t('settings.subtitle')}
                    </p>
                </div>
            </div>

            {/* Announcements */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Bell className="w-5 h-5 text-ds-accent-text" />
                    {t('settings.announce')}
                </h3>

                <div className="space-y-3">
                    {/* Announce on Start */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('settings.onStart')}</p>
                            <p className="text-xs text-ds-soft">{t('settings.onStartHint')}</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ announceOnStart: !config.announceOnStart })}
                            className={config.announceOnStart ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {config.announceOnStart ? t('common.on') : t('common.off')}
                        </button>
                    </div>

                    {/* Announce Reminders */}
                    <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-ds-text">{t('settings.reminders')}</p>
                                <p className="text-xs text-ds-soft">{t('settings.remindersHint')}</p>
                            </div>
                            <button
                                onClick={() => onUpdateConfig({ announceReminders: !config.announceReminders })}
                                className={config.announceReminders ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                            >
                                {config.announceReminders ? t('common.on') : t('common.off')}
                            </button>
                        </div>
                        {config.announceReminders && (
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-2">
                                    {t('settings.interval')}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={config.reminderIntervalMinutes}
                                    onChange={(e) => onUpdateConfig({ reminderIntervalMinutes: parseInt(e.target.value) || 3 })}
                                    className="ds-input w-full"
                                />
                            </div>
                        )}
                    </div>

                    {/* Announce Participant Count */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('settings.showCount')}</p>
                            <p className="text-xs text-ds-soft">{t('settings.showCountHint')}</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ announceParticipantCount: !config.announceParticipantCount })}
                            className={config.announceParticipantCount ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {config.announceParticipantCount ? t('common.on') : t('common.off')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Messages */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-ds-accent-text" />
                    {t('settings.customMsgs')}
                </h3>

                <div className="p-4 bg-ds-accent/10 border border-ds-accent rounded-lg">
                    <p className="text-sm text-ds-accent-text">
                        <strong>{t('settings.varsTitle')}</strong><br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{command}'}</code> - {t('settings.varCommand')}<br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{prize}'}</code> - {t('settings.varPrize')}<br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{count}'}</code> - {t('settings.varCount')}<br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{winner}'}</code> - {t('settings.varWinner')}<br />
                        <code className="bg-ds-accent/10 px-2 py-1 rounded">{'{timeout}'}</code> - {t('settings.varTimeout')}
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Start Message */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('settings.msgStart')}
                        </label>
                        <textarea
                            value={config.startMessage}
                            onChange={(e) => onUpdateConfig({ startMessage: e.target.value })}
                            rows={2}
                            className="ds-input w-full resize-none"
                        />
                    </div>

                    {/* Reminder Message */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('settings.msgReminder')}
                        </label>
                        <textarea
                            value={config.reminderMessage}
                            onChange={(e) => onUpdateConfig({ reminderMessage: e.target.value })}
                            rows={2}
                            className="ds-input w-full resize-none"
                        />
                    </div>

                    {/* Winner Message */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('settings.msgWinner')}
                        </label>
                        <textarea
                            value={config.winnerMessage}
                            onChange={(e) => onUpdateConfig({ winnerMessage: e.target.value })}
                            rows={2}
                            className="ds-input w-full resize-none"
                        />
                    </div>

                    {/* No Response Message */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('settings.msgNoResponse')}
                        </label>
                        <textarea
                            value={config.noResponseMessage}
                            onChange={(e) => onUpdateConfig({ noResponseMessage: e.target.value })}
                            rows={2}
                            className="ds-input w-full resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Cooldowns */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-ds-accent-text" />
                    {t('settings.cooldown')}
                </h3>

                <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="font-bold text-ds-text">{t('settings.cooldownOn')}</p>
                            <p className="text-xs text-ds-soft">{t('settings.cooldownOnHint')}</p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ winnerCooldownEnabled: !config.winnerCooldownEnabled })}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                config.winnerCooldownEnabled
                                    ? 'bg-ds-warn text-ds-on-accent'
                                    : 'bg-ds-raised text-ds-soft '
                            }`}
                        >
                            {config.winnerCooldownEnabled ? t('common.on') : t('common.off')}
                        </button>
                    </div>

                    {config.winnerCooldownEnabled && (
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                {t('settings.cooldownDays')}
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={config.winnerCooldownDays}
                                onChange={(e) => onUpdateConfig({ winnerCooldownDays: parseInt(e.target.value) || 7 })}
                                className="ds-input w-full"
                            />
                            <p className="text-xs text-ds-soft mt-2">
                                {t('settings.cooldownHint', { n: config.winnerCooldownDays })}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <SettingsExtras settings={config.settings} onUpdateSettings={onUpdateSettings} />
        </div>
    );
};
