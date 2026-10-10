/**
 * Timer Extension - Display Tab Component
 *
 * Configuración de elementos visuales a mostrar en el timer.
 */

import type { DisplayConfig } from '../../types';

interface DisplayTabProps {
    displayConfig: DisplayConfig;
    onDisplayConfigChange: (updates: Partial<DisplayConfig>) => void;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-faint rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-ds-border peer-checked:bg-ds-accent"></div>
    </label>
);

export const DisplayTab: React.FC<DisplayTabProps> = ({
    displayConfig,
    onDisplayConfigChange
}) => {
    return (
        <div className="space-y-6">
            {/* Unidades de Tiempo Visibles */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <h3 className="text-sm font-bold text-ds-text mb-4">
                    Unidades de Tiempo Visibles
                </h3>
                
                {/* Formato Personalizado (Opcional) */}
                <div className="mb-6 bg-ds-surface p-4 rounded-lg border border-ds-border">
                    <label className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-2 block">
                        Formato Personalizado (Avanzado)
                    </label>
                    <input
                        type="text"
                        value={displayConfig.timeFormat || ''}
                        onChange={(e) => onDisplayConfigChange({ timeFormat: e.target.value })}
                        placeholder="Ej: HH:mm:ss"
                        className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text font-mono text-sm"
                    />
                    <p className="text-[10px] text-ds-soft mt-2">
                        Si escribes aquí, se ignorarán los botones de abajo. <br/>
                        Tokens: <code>HH</code> (horas), <code>mm</code> (minutos), <code>ss</code> (segundos). Ej: <code>Quedan HH horas y mm min</code>
                    </p>
                </div>

                <div className={`flex flex-wrap gap-2 transition-opacity ${displayConfig.timeFormat ? 'opacity-50 pointer-events-none' : ''}`}>
                    {[
                        { key: 'showYears' as const, label: 'Años' },
                        { key: 'showMonths' as const, label: 'Meses' },
                        { key: 'showWeeks' as const, label: 'Semanas' },
                        { key: 'showDays' as const, label: 'Días' },
                        { key: 'showHours' as const, label: 'Horas' },
                        { key: 'showMinutes' as const, label: 'Minutos' },
                        { key: 'showSeconds' as const, label: 'Segundos' }
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => onDisplayConfigChange({ [key]: !displayConfig[key] })}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
                                displayConfig[key]
                                    ? 'bg-ds-accent text-ds-on-accent border-ds-accent '
                                    : 'bg-ds-surface text-ds-soft border-ds-border hover:border-ds-border'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mostrar Título */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between mb-3">
                    <label htmlFor="showTitle" className="text-sm font-bold text-ds-text">
                        Mostrar Título
                    </label>
                    <ToggleSwitch
                        checked={displayConfig.showTitle}
                        onChange={(checked) => onDisplayConfigChange({ showTitle: checked })}
                    />
                </div>
                {displayConfig.showTitle && (
                    <>
                        <input
                            type="text"
                            value={displayConfig.title}
                            onChange={(e) => onDisplayConfigChange({ title: e.target.value })}
                            placeholder="Ej: Próximo juego en:"
                            className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text"
                        />
                        <p className="text-xs text-ds-soft mt-2">
                            Texto que se mostrará como título del timer
                        </p>
                    </>
                )}
            </div>

            {/* Mostrar Porcentaje */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <label htmlFor="showPercentage" className="text-sm font-bold text-ds-text">
                            Mostrar Porcentaje
                        </label>
                        <p className="text-xs text-ds-soft mt-1">
                            Muestra el % de progreso del timer
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={displayConfig.showPercentage}
                        onChange={(checked) => onDisplayConfigChange({ showPercentage: checked })}
                    />
                </div>
            </div>

            {/* Mostrar Tiempo Transcurrido */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <label htmlFor="showElapsedTime" className="text-sm font-bold text-ds-text">
                            Mostrar Tiempo Transcurrido
                        </label>
                        <p className="text-xs text-ds-soft mt-1">
                            Muestra cuánto tiempo ha pasado desde el inicio (+XX:XX)
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={displayConfig.showElapsedTime}
                        onChange={(checked) => onDisplayConfigChange({ showElapsedTime: checked })}
                    />
                </div>
            </div>
        </div>
    );
};

export default DisplayTab;
