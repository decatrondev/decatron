/**
 * AdvancedTab - General Section
 *
 * Timezone selector and regional configuration, plus danger zone (factory reset).
 */

import { useTranslation } from 'react-i18next';
import { Globe, RotateCcw } from 'lucide-react';

interface GeneralSectionProps {
    timeZone?: string;
    onTimeZoneChange: (tz: string) => void;
    onResetConfig: () => void;
}

export const GeneralSection: React.FC<GeneralSectionProps> = ({
    timeZone,
    onTimeZoneChange,
    onResetConfig
}) => {
    const { t } = useTranslation('features');
    return (
        <div className="space-y-6">
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-ds-accent-text" /> {t('timerAdvanced.regionalConfig')}
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">{t('timerAdvanced.timezone')}</label>
                        <select
                            value={timeZone || 'UTC'}
                            onChange={(e) => onTimeZoneChange(e.target.value)}
                            className="ds-input w-full"
                        >
                            <option value="UTC">UTC (Universal)</option>
                            <optgroup label="América">
                                <option value="America/Lima">Lima, Perú (UTC-5)</option>
                                <option value="America/Bogota">Bogotá, Colombia (UTC-5)</option>
                                <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
                                <option value="America/New_York">Nueva York (UTC-5)</option>
                                <option value="America/Los_Angeles">Los Ángeles (UTC-8)</option>
                                <option value="America/Santiago">Santiago, Chile (UTC-4)</option>
                                <option value="America/Argentina/Buenos_Aires">Buenos Aires (UTC-3)</option>
                            </optgroup>
                            <optgroup label="Europa">
                                <option value="Europe/Madrid">Madrid, España (UTC+1)</option>
                                <option value="Europe/London">Londres, UK (UTC+0)</option>
                            </optgroup>
                        </select>
                        <p className="text-xs text-ds-soft mt-2">
                            {t('timerAdvanced.timezoneDescription')}
                        </p>
                    </div>

                    <div className="pt-6 border-t border-ds-border">
                        <h4 className="text-xs font-bold text-ds-danger uppercase tracking-wider mb-3 flex items-center gap-2">
                            {t('timerAdvanced.dangerZone')}
                        </h4>
                        <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-4">
                            <p className="text-sm text-ds-danger mb-4 font-medium">
                                {t('timerAdvanced.dangerZoneDescription')}
                            </p>
                            <button
                                onClick={onResetConfig}
                                className="w-full py-3 bg-ds-surface border-2 border-ds-danger/40 text-ds-danger hover:bg-ds-danger/10 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                {t('timerAdvanced.restoreDefaults')}
                            </button>
                            <p className="text-xs text-ds-danger/80 mt-2 text-center">
                                {t('timerAdvanced.restoreDefaultsNote')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
