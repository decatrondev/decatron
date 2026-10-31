/**
 * AdvancedTab - General Section
 *
 * Timezone selector and regional configuration, plus danger zone (factory reset).
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, RotateCcw } from 'lucide-react';

interface GeneralSectionProps {
    timeZone?: string;
    onTimeZoneChange: (tz: string) => void;
    onResetConfig: () => void;
}


interface ZoneOption { id: string; label: string }

/** Hora del canal en esa zona es válida si el navegador la reconoce. */
const isValidZone = (tz: string): boolean => {
    try { new Intl.DateTimeFormat('es', { timeZone: tz }); return true; } catch { return false; }
};

/** Desfase actual de la zona, tipo "GMT-5", para mostrarlo junto al nombre. */
const offsetOf = (tz: string): string => {
    try {
        const part = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
            .formatToParts(new Date()).find(p => p.type === 'timeZoneName');
        return part?.value.replace('GMT', 'UTC') ?? '';
    } catch { return ''; }
};

/** Todas las zonas IANA que conoce el navegador; si no puede listarlas, una base mínima. */
const allZones = (): string[] => {
    try {
        const list = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;
        if (list && list.length) return list.includes('UTC') ? list : ['UTC', ...list];
    } catch { /* cae a la base */ }
    return ['UTC', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/New_York', 'America/Los_Angeles',
        'America/Santiago', 'America/Argentina/Buenos_Aires', 'Europe/Madrid', 'Europe/London'];
};

export const GeneralSection: React.FC<GeneralSectionProps> = ({
    timeZone,
    onTimeZoneChange,
    onResetConfig
}) => {
    const { t } = useTranslation('features');
    const [zoneFilter, setZoneFilter] = useState('');
    const current = timeZone || 'UTC';
    const valid = isValidZone(current);
    const browserTz = useMemo(() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
    }, []);
    const options = useMemo<ZoneOption[]>(() => {
        const q = zoneFilter.trim().toLowerCase().replace(/\s+/g, '_');
        const ids = allZones().filter(z => !q || z.toLowerCase().includes(q));
        // La zona guardada siempre está en la lista, aunque el filtro o el navegador no la incluyan
        if (!ids.includes(current)) ids.unshift(current);
        return ids.map(id => ({ id, label: `${id.replace(/_/g, ' ')} (${offsetOf(id) || '?'})` }));
    }, [zoneFilter, current]);
    return (
        <div className="space-y-6">
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-ds-accent-text" /> {t('timerAdvanced.regionalConfig')}
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2">{t('timerAdvanced.timezone')}</label>
                        <input
                            type="text"
                            value={zoneFilter}
                            onChange={(e) => setZoneFilter(e.target.value)}
                            placeholder={t('timerAdvanced.timezoneSearch')}
                            className="ds-input w-full mb-2"
                        />
                        <select
                            value={current}
                            onChange={(e) => onTimeZoneChange(e.target.value)}
                            className="ds-input w-full"
                        >
                            {options.map(z => (
                                <option key={z.id} value={z.id}>{z.label}</option>
                            ))}
                        </select>
                        {!valid && (
                            <p className="text-xs text-ds-warn mt-2">{t('timerAdvanced.timezoneInvalid', { zone: current })}</p>
                        )}
                        {browserTz && browserTz !== current && (
                            <button
                                type="button"
                                onClick={() => onTimeZoneChange(browserTz)}
                                className="text-xs underline text-ds-accent-text mt-2"
                            >
                                {t('timerAdvanced.timezoneUseBrowser', { zone: browserTz })}
                            </button>
                        )}
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
