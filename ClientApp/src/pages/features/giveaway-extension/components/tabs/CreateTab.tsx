/**
 * CreateTab - Tab para crear/configurar un nuevo giveaway
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Clock, Users, Trophy } from 'lucide-react';
import type { GiveawayConfig, GiveawaySettings } from '../../types';

interface CreateTabProps {
    config: GiveawayConfig;
    onUpdateConfig: (updates: Partial<GiveawayConfig>) => void;
    settings?: GiveawaySettings;
    onUpdateSettings?: <K extends keyof GiveawaySettings>(group: K, updates: Partial<GiveawaySettings[K]>) => void;
}

export const CreateTab: React.FC<CreateTabProps> = ({ config, onUpdateConfig, settings, onUpdateSettings }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway.create' });
    const draw = settings?.draw;
    const setDraw = (u: Partial<GiveawaySettings['draw']>) => onUpdateSettings?.('draw', u);
    const DrawToggle = ({ title, hint, value, onChange }: { title: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
        <div className="flex items-center justify-between gap-4 p-4 bg-ds-bg rounded-lg border border-ds-border">
            <div>
                <p className="font-bold text-ds-text">{title}</p>
                <p className="text-xs text-ds-soft">{hint}</p>
            </div>
            <button onClick={() => onChange(!value)} className={value ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>{value ? t('yes') : t('no')}</button>
        </div>
    );

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
                <div className="p-3 bg-ds-bg rounded-lg">
                    <Gift className="w-6 h-6 text-ds-soft" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-ds-text">
                        {t('title')}
                    </h2>
                    <p className="text-sm text-ds-soft">
                        {t('subtitle')}
                    </p>
                </div>
            </div>

            {/* Información del Premio */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-ds-accent-text" />
                    {t('prizeInfo')}
                </h3>

                <div className="grid grid-cols-1 gap-4">
                    {/* Nombre del Giveaway */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('name')}
                        </label>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => onUpdateConfig({ name: e.target.value })}
                            placeholder={t('namePh')}
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Nombre del Premio */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('prize')}
                        </label>
                        <input
                            type="text"
                            value={config.prizeName}
                            onChange={(e) => onUpdateConfig({ prizeName: e.target.value })}
                            placeholder={t('prizePh')}
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Descripción del Premio */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('prizeDesc')}
                        </label>
                        <textarea
                            value={config.prizeDescription || ''}
                            onChange={(e) => onUpdateConfig({ prizeDescription: e.target.value })}
                            placeholder={t('prizeDescPh')}
                            rows={3}
                            className="ds-input w-full resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Duración */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-ds-accent-text" />
                    {t('duration')}
                </h3>

                <div className="space-y-4">
                    {/* Tipo de duración */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => onUpdateConfig({ durationType: 'timed' })}
                            className={`${config.durationType === 'timed' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'} ds-btn--lg flex-1`}
                        >
                            {t('timed')}
                        </button>
                        <button
                            onClick={() => onUpdateConfig({ durationType: 'manual' })}
                            className={`${config.durationType === 'manual' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'} ds-btn--lg flex-1`}
                        >
                            {t('manual')}
                        </button>
                    </div>

                    {/* Duración en minutos (solo si es timed) */}
                    {config.durationType === 'timed' && (
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                {t('minutes')}
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={1440}
                                value={config.durationMinutes}
                                onChange={(e) => onUpdateConfig({ durationMinutes: parseInt(e.target.value) || 10 })}
                                className="ds-input w-full"
                            />
                            <p className="text-xs text-ds-soft mt-1">
                                {t('autoEnd', { n: config.durationMinutes })}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Participantes */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Users className="w-5 h-5 text-ds-accent-text" />
                    {t('participants')}
                </h3>

                <div className="space-y-4">
                    {/* Comando de entrada */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('entryCommand')}
                        </label>
                        <input
                            type="text"
                            value={config.entryCommand}
                            onChange={(e) => onUpdateConfig({ entryCommand: e.target.value })}
                            placeholder="!join"
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Entrada automática */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('autoEntry')}</p>
                            <p className="text-sm text-ds-soft">
                                {t('autoEntryHint')}
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ allowAutoEntry: !config.allowAutoEntry })}
                            className={config.allowAutoEntry ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {config.allowAutoEntry ? t('on') : t('off')}
                        </button>
                    </div>

                    {/* Múltiples entradas */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('multi')}</p>
                            <p className="text-sm text-ds-soft">
                                {t('multiHint')}
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ allowMultipleEntries: !config.allowMultipleEntries })}
                            className={config.allowMultipleEntries ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {config.allowMultipleEntries ? t('on') : t('off')}
                        </button>
                    </div>

                    {/* Límite de participantes */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 mb-2">
                                <p className="font-bold text-ds-text">{t('maxP')}</p>
                                <button
                                    onClick={() => onUpdateConfig({ maxParticipantsEnabled: !config.maxParticipantsEnabled })}
                                    className={config.maxParticipantsEnabled ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                >
                                    {config.maxParticipantsEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            {config.maxParticipantsEnabled && (
                                <input
                                    type="number"
                                    min={1}
                                    value={config.maxParticipants}
                                    onChange={(e) => onUpdateConfig({ maxParticipants: parseInt(e.target.value) || 100 })}
                                    className="ds-input w-full"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ganadores */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-ds-accent-text" />
                    {t('winners')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Número de ganadores */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('numWinners')}
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={config.numberOfWinners}
                            onChange={(e) => onUpdateConfig({ numberOfWinners: parseInt(e.target.value) || 1 })}
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Ganadores de respaldo */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            {t('backups')}
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onUpdateConfig({ hasBackupWinners: !config.hasBackupWinners })}
                                className={config.hasBackupWinners ? 'ds-btn ds-btn--primary ds-btn--lg' : 'ds-btn ds-btn--secondary ds-btn--lg'}
                            >
                                {config.hasBackupWinners ? t('on') : t('off')}
                            </button>
                            {config.hasBackupWinners && (
                                <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={config.numberOfBackupWinners}
                                    onChange={(e) => onUpdateConfig({ numberOfBackupWinners: parseInt(e.target.value) || 1 })}
                                    className="ds-input flex-1"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Cómo se sortea y se valida */}
                {draw && (
                    <div className="space-y-3 p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">{t('drawTitle')}</p>
                            <p className="text-xs text-ds-soft">{t('drawHint')}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">{t('several')}</label>
                            <select className="ds-input w-full" value={draw.mode} onChange={(e) => setDraw({ mode: e.target.value as 'all' | 'one_by_one' })}>
                                <option value="all">{t('modeAll')}</option>
                                <option value="one_by_one">{t('modeOne')}</option>
                            </select>
                            {draw.mode === 'one_by_one' && config.hasBackupWinners && (
                                <p className="text-xs text-amber-500 mt-1">{t('oneNoBackup')}</p>
                            )}
                        </div>
                        <DrawToggle title={t('keepEntries')} hint={t('keepEntriesHint')} value={draw.keepEntriesOpen} onChange={(v) => setDraw({ keepEntriesOpen: v })} />
                        <DrawToggle title={t('discard')} hint={t('discardHint')} value={draw.discardNoResponse} onChange={(v) => setDraw({ discardNoResponse: v })} />
                        <DrawToggle title={t('again')} hint={t('againHint')} value={draw.confirmedCanWinAgain} onChange={(v) => setDraw({ confirmedCanWinAgain: v })} />
                        <DrawToggle title={t('keepOpen')} hint={t('keepOpenHint')} value={draw.onComplete === 'keep_open'} onChange={(v) => setDraw({ onComplete: v ? 'keep_open' : 'finish' })} />
                        <DrawToggle title={t('replaceConfirmed')} hint={t('replaceConfirmedHint')} value={draw.replaceConfirmed} onChange={(v) => setDraw({ replaceConfirmed: v })} />
                        <DrawToggle title={t('backupOnReroll')} hint={t('backupOnRerollHint')} value={draw.backupsOnReroll} onChange={(v) => setDraw({ backupsOnReroll: v })} />
                    </div>
                )}

                {/* Timeout de respuesta */}
                <div>
                    <label className="block text-sm font-bold text-ds-soft mb-2">
                        {t('timeout')}
                    </label>
                    <input
                        type="number"
                        min={10}
                        max={300}
                        value={config.winnerResponseTimeout}
                        onChange={(e) => onUpdateConfig({ winnerResponseTimeout: parseInt(e.target.value) || 60 })}
                        className="ds-input w-full"
                    />
                    <p className="text-xs text-ds-soft mt-1">
                        {t('timeoutHint')}
                    </p>
                </div>

                {/* Auto reroll */}
                <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div>
                        <p className="font-bold text-ds-text">{t('autoReroll')}</p>
                        <p className="text-sm text-ds-soft">
                            {t('autoRerollHint')}
                        </p>
                    </div>
                    <button
                        onClick={() => onUpdateConfig({ autoRerollOnTimeout: !config.autoRerollOnTimeout })}
                        className={config.autoRerollOnTimeout ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                    >
                        {config.autoRerollOnTimeout ? t('on') : t('off')}
                    </button>
                </div>
            </div>
        </div>
    );
};
