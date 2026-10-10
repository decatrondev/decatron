// TimerIntegrationTab - Configure timer bonus integration with goals

import React from 'react';
import { Timer, Zap, Target, Trophy, Info, AlertTriangle, Check } from 'lucide-react';
import type { GoalsTimerIntegrationConfig } from '../../types';
import TimeUnitInput from '../TimeUnitInput';

interface TimerIntegrationTabProps {
    timerIntegration: GoalsTimerIntegrationConfig;
    onUpdateTimerIntegration: (updates: Partial<GoalsTimerIntegrationConfig>) => void;
}

export const TimerIntegrationTab: React.FC<TimerIntegrationTabProps> = ({
    timerIntegration,
    onUpdateTimerIntegration
}) => {
    // Update nested perProgress settings
    const updatePerProgress = (updates: Partial<NonNullable<GoalsTimerIntegrationConfig['perProgress']>>) => {
        onUpdateTimerIntegration({
            perProgress: {
                percentThreshold: timerIntegration.perProgress?.percentThreshold || 25,
                secondsToAdd: timerIntegration.perProgress?.secondsToAdd || 60,
                ...updates
            }
        });
    };

    // Update nested onComplete settings
    const updateOnComplete = (updates: Partial<NonNullable<GoalsTimerIntegrationConfig['onComplete']>>) => {
        onUpdateTimerIntegration({
            onComplete: {
                secondsToAdd: timerIntegration.onComplete?.secondsToAdd || 300,
                ...updates
            }
        });
    };

    const formatTime = (seconds: number): string => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (mins > 0) parts.push(`${mins}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

        return parts.join(' ');
    };

    // Validation checks
    const validations = {
        perProgress: {
            valid: (timerIntegration.perProgress?.percentThreshold || 25) >= 5 &&
                   (timerIntegration.perProgress?.percentThreshold || 25) <= 50 &&
                   (timerIntegration.perProgress?.secondsToAdd || 60) >= 1,
            messages: [
                (timerIntegration.perProgress?.percentThreshold || 25) < 5 ? 'El umbral mínimo es 5%' : null,
                (timerIntegration.perProgress?.percentThreshold || 25) > 50 ? 'El umbral máximo es 50%' : null,
                (timerIntegration.perProgress?.secondsToAdd || 60) < 1 ? 'El tiempo mínimo es 1 segundo' : null
            ].filter(Boolean) as string[]
        },
        onComplete: {
            valid: (timerIntegration.onComplete?.secondsToAdd || 300) >= 1,
            messages: [
                (timerIntegration.onComplete?.secondsToAdd || 300) < 1 ? 'El tiempo mínimo es 1 segundo' : null
            ].filter(Boolean) as string[]
        }
    };

    const modes = [
        {
            id: 'per-progress' as const,
            icon: <Zap className="w-5 h-5" />,
            name: 'Por Progreso',
            description: 'Agrega tiempo cada vez que se alcanza un porcentaje de la meta',
            color: 'from-ds-accent to-ds-accent',
            example: 'Ej: cada 25% = +1 minuto'
        },
        {
            id: 'per-milestone' as const,
            icon: <Target className="w-5 h-5" />,
            name: 'Por Milestone',
            description: 'Agrega tiempo al alcanzar cada milestone individual',
            color: 'from-ds-accent to-ds-accent',
            example: 'Configura en cada milestone'
        },
        {
            id: 'on-complete' as const,
            icon: <Trophy className="w-5 h-5" />,
            name: 'Al Completar',
            description: 'Agrega tiempo solo cuando la meta llega al 100%',
            color: 'from-ds-accent to-ds-accent',
            example: 'Ej: meta completa = +5 minutos'
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-ds-accent rounded-lg flex items-center justify-center">
                            <Timer className="w-5 h-5 text-ds-on-accent" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-ds-text">
                                Integración con Timer
                            </h2>
                            <p className="text-sm text-ds-soft">
                                Agrega tiempo al Timer Extensible basado en el progreso de metas
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={timerIntegration.enabled}
                            onChange={(e) => onUpdateTimerIntegration({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
                    </label>
                </div>
            </div>

            {!timerIntegration.enabled ? (
                <div className="bg-ds-bg rounded-lg border border-ds-border p-8 text-center">
                    <div className="w-16 h-16 bg-ds-accent/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <Timer className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <h3 className="text-lg font-semibold text-ds-text mb-2">
                        Integración desactivada
                    </h3>
                    <p className="text-ds-soft max-w-md mx-auto">
                        Activa la integración para que el progreso de metas agregue tiempo automáticamente al Timer Extensible.
                    </p>
                </div>
            ) : (
                <>
                    {/* Mode Selection */}
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <h3 className="text-lg font-semibold text-ds-text mb-4">
                            Modo de Integración
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {modes.map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => onUpdateTimerIntegration({ mode: mode.id })}
                                    className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                                        timerIntegration.mode === mode.id
                                            ? 'border-ds-accent bg-ds-accent/5'
                                            : 'border-ds-border hover:border-ds-accent/50'
                                    }`}
                                >
                                    {timerIntegration.mode === mode.id && (
                                        <div className="absolute top-2 right-2 w-5 h-5 bg-ds-accent rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-ds-on-accent" />
                                        </div>
                                    )}
                                    <div className={`w-10 h-10 bg-gradient-to-br ${mode.color} rounded-lg flex items-center justify-center mb-3 text-ds-text`}>
                                        {mode.icon}
                                    </div>
                                    <h4 className="font-semibold text-ds-text mb-1">
                                        {mode.name}
                                    </h4>
                                    <p className="text-xs text-ds-soft mb-2">
                                        {mode.description}
                                    </p>
                                    <p className="text-xs text-ds-accent-text font-medium">
                                        {mode.example}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Per Progress Settings */}
                    {timerIntegration.mode === 'per-progress' && (
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Zap className="w-5 h-5 text-ds-accent-text" />
                                <h3 className="text-lg font-semibold text-ds-text">
                                    Configuración Por Progreso
                                </h3>
                            </div>

                            {/* Validation Messages */}
                            {!validations.perProgress.valid && (
                                <div className="mb-4 p-3 bg-ds-danger/10 border border-ds-danger/40 rounded-lg">
                                    <div className="flex items-center gap-2 text-ds-danger">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-sm font-medium">Errores de validación:</span>
                                    </div>
                                    <ul className="mt-1 text-sm text-ds-danger list-disc list-inside">
                                        {validations.perProgress.messages.map((msg, i) => (
                                            <li key={i}>{msg}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="space-y-6">
                                {/* Percent Threshold */}
                                <div>
                                    <label className="block text-sm font-medium text-ds-soft mb-2">
                                        Cada % de progreso
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min={5}
                                            max={50}
                                            step={5}
                                            value={timerIntegration.perProgress?.percentThreshold || 25}
                                            onChange={(e) => updatePerProgress({ percentThreshold: Number(e.target.value) })}
                                            className="flex-1 h-2 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
                                        />
                                        <span className="w-14 text-center font-mono text-lg text-ds-text bg-ds-bg px-3 py-1 rounded-lg">
                                            {timerIntegration.perProgress?.percentThreshold || 25}%
                                        </span>
                                    </div>
                                    <p className="text-xs text-ds-soft mt-1">
                                        Se agregará tiempo cada vez que se alcance este porcentaje (5%, 10%, 15%... según umbral)
                                    </p>
                                </div>

                                {/* Time to Add */}
                                <TimeUnitInput
                                    label="Tiempo a agregar por cada umbral"
                                    value={timerIntegration.perProgress?.secondsToAdd || 60}
                                    onChange={(seconds) => updatePerProgress({ secondsToAdd: seconds })}
                                    min={1}
                                    max={86400} // 1 day max
                                />

                                {/* Example calculation */}
                                <div className="bg-ds-accent/10 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-ds-accent-text mb-2">
                                        <Info className="w-4 h-4" />
                                        <span className="font-medium">Ejemplo con meta de 100 puntos</span>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        {Array.from({ length: Math.floor(100 / (timerIntegration.perProgress?.percentThreshold || 25)) }, (_, i) => (
                                            <div key={i} className="flex items-center gap-2 text-ds-text">
                                                <span className="w-16 text-ds-soft">
                                                    {(i + 1) * (timerIntegration.perProgress?.percentThreshold || 25)}% alcanzado
                                                </span>
                                                <span className="text-ds-accent-text font-medium">
                                                    → +{formatTime(timerIntegration.perProgress?.secondsToAdd || 60)}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="pt-2 border-t border-ds-accent/20 font-semibold text-ds-accent-text">
                                            Total al completar: +{formatTime((timerIntegration.perProgress?.secondsToAdd || 60) * Math.floor(100 / (timerIntegration.perProgress?.percentThreshold || 25)))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Per Milestone Info */}
                    {timerIntegration.mode === 'per-milestone' && (
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Target className="w-5 h-5 text-ds-accent-text" />
                                <h3 className="text-lg font-semibold text-ds-text">
                                    Configuración Por Milestone
                                </h3>
                            </div>

                            <div className="bg-ds-ok/10 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <Info className="w-5 h-5 text-ds-accent-text mt-0.5" />
                                    <div>
                                        <p className="text-ds-text font-medium mb-2">
                                            El tiempo se configura en cada milestone
                                        </p>
                                        <p className="text-sm text-ds-soft mb-3">
                                            Ve a la pestaña "🏁 Hitos" para configurar cuánto tiempo agrega cada milestone
                                            al alcanzarse. Cada milestone puede tener su propio bonus de tiempo.
                                        </p>
                                        <div className="bg-ds-surface rounded-lg p-3">
                                            <p className="text-xs text-ds-soft mb-2">Ejemplo de configuración:</p>
                                            <ul className="text-sm space-y-1">
                                                <li className="flex items-center gap-2">
                                                    <span className="text-ds-ok">25%</span>
                                                    <span className="text-ds-soft">→</span>
                                                    <span className="text-ds-text">+30 segundos</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <span className="text-ds-ok">50%</span>
                                                    <span className="text-ds-soft">→</span>
                                                    <span className="text-ds-text">+1 minuto</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <span className="text-ds-ok">75%</span>
                                                    <span className="text-ds-soft">→</span>
                                                    <span className="text-ds-text">+2 minutos</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* On Complete Settings */}
                    {timerIntegration.mode === 'on-complete' && (
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Trophy className="w-5 h-5 text-ds-accent-text" />
                                <h3 className="text-lg font-semibold text-ds-text">
                                    Configuración Al Completar
                                </h3>
                            </div>

                            {/* Validation Messages */}
                            {!validations.onComplete.valid && (
                                <div className="mb-4 p-3 bg-ds-danger/10 border border-ds-danger/40 rounded-lg">
                                    <div className="flex items-center gap-2 text-ds-danger">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-sm font-medium">Errores de validación:</span>
                                    </div>
                                    <ul className="mt-1 text-sm text-ds-danger list-disc list-inside">
                                        {validations.onComplete.messages.map((msg, i) => (
                                            <li key={i}>{msg}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="space-y-4">
                                <TimeUnitInput
                                    label="Tiempo a agregar al completar meta"
                                    value={timerIntegration.onComplete?.secondsToAdd || 300}
                                    onChange={(seconds) => updateOnComplete({ secondsToAdd: seconds })}
                                    min={1}
                                    max={86400 * 7} // 1 week max
                                />

                                <div className="bg-ds-accent/10 rounded-lg p-4">
                                    <p className="text-sm text-ds-soft">
                                        <strong className="text-ds-warn">+{formatTime(timerIntegration.onComplete?.secondsToAdd || 300)}</strong> se agregará al Timer Extensible cuando la meta se complete al 100%.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Important Notes */}
                    <div className="bg-ds-bg rounded-lg border border-ds-border p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-ds-warn mt-0.5" />
                            <div className="text-sm">
                                <p className="text-ds-text font-medium mb-2">
                                    Requisitos para la integración
                                </p>
                                <ul className="text-ds-soft space-y-1 list-disc list-inside">
                                    <li>El Timer Extensible debe estar <strong>activo y corriendo</strong></li>
                                    <li>El tiempo se suma al tiempo restante actual</li>
                                    <li>Si el timer está pausado, el tiempo se agrega pero no corre hasta reanudar</li>
                                    <li>Los bonus no se aplican retroactivamente</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Validation Status */}
                    <div className={`rounded-lg border p-4 ${
                        validations.perProgress.valid && validations.onComplete.valid
                            ? 'bg-ds-ok/10 border-ds-ok/40 '
                            : 'bg-ds-warn/10 border-ds-warn/40 '
                    }`}>
                        <div className="flex items-center gap-2">
                            {validations.perProgress.valid && validations.onComplete.valid ? (
                                <>
                                    <Check className="w-5 h-5 text-ds-ok" />
                                    <span className="text-ds-ok font-medium">
                                        Configuración válida y lista para usar
                                    </span>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="w-5 h-5 text-ds-warn" />
                                    <span className="text-ds-warn font-medium">
                                        Revisa los errores de validación arriba
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TimerIntegrationTab;
