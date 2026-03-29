/**
 * AdvancedTab - General Section
 *
 * Timezone selector and regional configuration, plus danger zone (factory reset).
 */

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
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-500" /> Configuración Regional
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Zona Horaria</label>
                        <select
                            value={timeZone || 'UTC'}
                            onChange={(e) => onTimeZoneChange(e.target.value)}
                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
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
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                            Define la hora base para las funciones de <strong>Auto-Pausa</strong> y <strong>Happy Hour</strong>.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            ⚠️ Zona de Peligro
                        </h4>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-4">
                            <p className="text-sm text-red-600 dark:text-red-400 mb-4 font-medium">
                                ¿Algo salió mal? Puedes restaurar toda la configuración visual y alertas a su estado original.
                            </p>
                            <button
                                onClick={onResetConfig}
                                className="w-full py-3 bg-white dark:bg-[#1a1a1a] border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Restaurar Configuración por Defecto
                            </button>
                            <p className="text-xs text-red-400/80 mt-2 text-center">
                                Nota: Esto NO borrará tus horarios guardados ni plantillas personalizadas.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
