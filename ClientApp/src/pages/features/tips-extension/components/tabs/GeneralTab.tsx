/**
 * GeneralTab - Enable/disable, min/max amounts, currency, suggested amounts
 */

import React from 'react';
import { DollarSign, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TipsSettings } from '../../types/config';
import { CURRENCIES } from '../../types/config';

interface GeneralTabProps {
    settings: TipsSettings;
    updateSettings: (updates: Partial<TipsSettings>) => void;
    inputClass: string;
    labelClass: string;
    cardClass: string;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
    settings,
    updateSettings,
    inputClass,
    labelClass,
    cardClass,
}) => {
    const { t } = useTranslation('features');

    const getSuggestedAmountsArray = (): number[] => {
        return settings.suggestedAmounts
            .split(',')
            .map(s => parseFloat(s.trim()))
            .filter(n => !isNaN(n));
    };

    const setSuggestedAmountsArray = (amounts: number[]) => {
        updateSettings({ suggestedAmounts: amounts.join(',') });
    };

    return (
        <>
            <div className={cardClass}>
                <h3 className="text-lg font-bold text-ds-text mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    {t('tipsTabs.amountConfig')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className={labelClass}>{t('tipsTabs.currency')}</label>
                        <select
                            value={settings.currency}
                            onChange={e => updateSettings({ currency: e.target.value })}
                            className={inputClass}
                        >
                            {CURRENCIES.map(c => (
                                <option key={c.code} value={c.code}>
                                    {c.symbol} {c.code} - {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>{t('tipsTabs.minAmount')}</label>
                        <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={settings.minAmount}
                            onChange={e => updateSettings({ minAmount: parseFloat(e.target.value) || 1 })}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>{t('tipsTabs.maxAmount')}</label>
                        <input
                            type="number"
                            min="1"
                            value={settings.maxAmount}
                            onChange={e => updateSettings({ maxAmount: parseFloat(e.target.value) || 500 })}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>{t('tipsTabs.suggestedAmounts')}</label>
                    <div className="flex gap-2 flex-wrap">
                        {getSuggestedAmountsArray().map((amount, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="1"
                                    value={amount}
                                    onChange={e => {
                                        const newAmounts = [...getSuggestedAmountsArray()];
                                        newAmounts[idx] = parseFloat(e.target.value) || 0;
                                        setSuggestedAmountsArray(newAmounts);
                                    }}
                                    className="w-20 px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text text-center"
                                />
                                <button
                                    onClick={() => {
                                        const newAmounts = getSuggestedAmountsArray().filter((_, i) => i !== idx);
                                        setSuggestedAmountsArray(newAmounts);
                                    }}
                                    className="p-2 text-ds-danger hover:bg-ds-danger/10 rounded-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {getSuggestedAmountsArray().length < 6 && (
                            <button
                                onClick={() => setSuggestedAmountsArray([...getSuggestedAmountsArray(), 10])}
                                className="px-4 py-2 border-2 border-dashed border-ds-border rounded-lg text-ds-soft hover:border-ds-accent hover:text-ds-accent-text transition-all"
                            >
                                {t('tipsTabs.addAmount')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Enable/Disable */}
            <div className={cardClass}>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-ds-text">
                            {t('tipsTabs.enableTips')}
                        </h3>
                        <p className="text-sm text-ds-soft">
                            {t('tipsTabs.enableTipsDesc')}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.isEnabled}
                            onChange={e => updateSettings({ isEnabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
                    </label>
                </div>
            </div>
        </>
    );
};
