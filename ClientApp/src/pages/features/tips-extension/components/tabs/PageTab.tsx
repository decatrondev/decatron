/**
 * PageTab - Page title, description, accent color, background
 */

import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TipsSettings } from '../../types/config';

interface PageTabProps {
    settings: TipsSettings;
    updateSettings: (updates: Partial<TipsSettings>) => void;
    inputClass: string;
    labelClass: string;
    cardClass: string;
}

export const PageTab: React.FC<PageTabProps> = ({
    settings,
    updateSettings,
    inputClass,
    labelClass,
    cardClass,
}) => {
    const { t } = useTranslation('features');
    return (
        <div className={cardClass}>
            <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                {t('tipsTabs.pageCustomization')}
            </h3>

            <div className="space-y-4">
                <div>
                    <label className={labelClass}>{t('tipsTabs.pageTitle')}</label>
                    <input
                        type="text"
                        value={settings.pageTitle}
                        onChange={e => updateSettings({ pageTitle: e.target.value })}
                        placeholder={t('tipsTabs.pageTitlePlaceholder')}
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className={labelClass}>{t('tipsTabs.description')}</label>
                    <textarea
                        value={settings.pageDescription}
                        onChange={e => updateSettings({ pageDescription: e.target.value })}
                        placeholder={t('tipsTabs.descriptionPlaceholder')}
                        rows={3}
                        className={inputClass}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>{t('tipsTabs.accentColor')}</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={settings.pageAccentColor}
                                onChange={e => updateSettings({ pageAccentColor: e.target.value })}
                                className="w-12 h-12 rounded-lg cursor-pointer border-0"
                            />
                            <input
                                type="text"
                                value={settings.pageAccentColor}
                                onChange={e => updateSettings({ pageAccentColor: e.target.value })}
                                className={inputClass + ' flex-1 font-mono'}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>{t('tipsTabs.backgroundImage')}</label>
                        <input
                            type="url"
                            value={settings.pageBackgroundImage}
                            onChange={e => updateSettings({ pageBackgroundImage: e.target.value })}
                            placeholder="https://..."
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
