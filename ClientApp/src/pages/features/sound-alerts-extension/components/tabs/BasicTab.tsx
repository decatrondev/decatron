import {
    Clock, Plus, Eye, EyeOff, Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TextLine } from '../../types';

interface BasicTabProps {
    globalVolume: number;
    setGlobalVolume: (v: number) => void;
    globalEnabled: boolean;
    setGlobalEnabled: (v: boolean) => void;
    duration: number;
    setDuration: (v: number) => void;
    textLines: TextLine[];
    addTextLine: () => void;
    updateTextLine: (index: number, field: keyof TextLine, value: TextLine[keyof TextLine]) => void;
    removeTextLine: (index: number) => void;
    toggleTextLine: (index: number) => void;
}

export function BasicTab({
    globalVolume,
    setGlobalVolume,
    globalEnabled,
    setGlobalEnabled,
    duration,
    setDuration,
    textLines,
    addTextLine,
    updateTextLine,
    removeTextLine,
    toggleTextLine,
}: BasicTabProps) {
    const { t } = useTranslation('features');
    return (
        <div className="space-y-6">
            {/* Global Volume */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                        {t('soundAlertsTabs.globalVolume')}
                    </label>
                    <span className="text-2xl font-black text-[#2563eb]">{globalVolume}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={globalVolume}
                    onChange={(e) => setGlobalVolume(parseInt(e.target.value))}
                    className="w-full h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                />
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-3">
                    {t('soundAlertsTabs.globalVolumeDesc')}
                </p>
            </div>

            {/* Duration */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                        {t('soundAlertsTabs.alertDuration')}
                    </label>
                    <span className="text-2xl font-black text-purple-600">{duration}s</span>
                </div>
                <input
                    type="range"
                    min="3"
                    max="30"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                    <span>3s</span>
                    <span>30s</span>
                </div>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-3">
                    {t('soundAlertsTabs.alertDurationDesc')}
                </p>
            </div>

            {/* Text Lines */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                        {t('soundAlertsTabs.textLines')}
                    </label>
                    <button
                        onClick={addTextLine}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        {t('soundAlertsTabs.add')}
                    </button>
                </div>

                <div className="space-y-3">
                    {textLines.map((line, index) => (
                        <div
                            key={index}
                            className={`p-4 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg ${
                                !line.enabled ? 'opacity-50' : ''
                            }`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    {t('soundAlertsTabs.line', { num: index + 1 })}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleTextLine(index)}
                                        className="p-1.5 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded transition-colors"
                                    >
                                        {line.enabled ? (
                                            <Eye className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <EyeOff className="w-4 h-4 text-gray-400" />
                                        )}
                                    </button>
                                    {textLines.length > 1 && (
                                        <button
                                            onClick={() => removeTextLine(index)}
                                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <input
                                type="text"
                                value={line.text}
                                onChange={(e) => updateTextLine(index, 'text', e.target.value)}
                                placeholder={t('soundAlertsTabs.textPlaceholder')}
                                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] mb-3"
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">
                                        {t('soundAlertsTabs.sizePx')}
                                    </label>
                                    <input
                                        type="number"
                                        value={line.fontSize}
                                        onChange={(e) => updateTextLine(index, 'fontSize', parseInt(e.target.value))}
                                        min="12"
                                        max="72"
                                        className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">
                                        {t('soundAlertsTabs.weight')}
                                    </label>
                                    <select
                                        value={line.fontWeight}
                                        onChange={(e) => updateTextLine(index, 'fontWeight', e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="400">Normal</option>
                                        <option value="600">Semi-bold</option>
                                        <option value="bold">Bold</option>
                                    </select>
                                </div>
                            </div>

                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                {t('soundAlertsTabs.textVarsHint')}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Global Enabled */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            {t('soundAlertsTabs.systemEnabled')}
                        </label>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            {t('soundAlertsTabs.systemEnabledDesc')}
                        </p>
                    </div>
                    <button
                        onClick={() => setGlobalEnabled(!globalEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            globalEnabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                globalEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}
