/**
 * AlertsTab - Alert mode selector, TipsAlertSection delegation
 */

import React from 'react';
import { Bell, Check, Settings, ExternalLink, Zap, Info } from 'lucide-react';
import { TipsAlertSection } from '../TipsAlertSection';
import type { TipsSettings } from '../../types/config';
import type { TipsAlertConfig } from '../../types/index';
import { DEFAULT_TIPS_ALERT_CONFIG, DEFAULT_TIPS_BASE_ALERT } from '../../constants/defaults';

interface AlertsTabProps {
    settings: TipsSettings;
    updateSettings: (updates: Partial<TipsSettings>) => void;
    cardClass: string;
    testTip: () => void;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
    settings,
    updateSettings,
    cardClass,
    testTip,
}) => {
    return (
        <div className="space-y-6">
            <div className={cardClass}>
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Sistema de Alertas
                </h3>

                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-6">
                    Elige cómo quieres manejar las alertas de donaciones:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Opción Alertas Independientes */}
                    <button
                        onClick={() => updateSettings({ alertMode: 'basic' })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                            settings.alertMode === 'basic'
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-[#e2e8f0] dark:border-[#374151] hover:border-purple-300'
                        }`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                settings.alertMode === 'basic'
                                    ? 'border-purple-500 bg-purple-500'
                                    : 'border-gray-400'
                            }`}>
                                {settings.alertMode === 'basic' && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                Alertas Independientes
                            </span>
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] ml-8">
                            Sistema propio de alertas para Tips con sonido, TTS, multimedia y tiers por monto.
                        </p>
                    </button>

                    {/* Opción Timer */}
                    <button
                        onClick={() => updateSettings({ alertMode: 'timer' })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                            settings.alertMode === 'timer'
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                : 'border-[#e2e8f0] dark:border-[#374151] hover:border-purple-300'
                        }`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                settings.alertMode === 'timer'
                                    ? 'border-purple-500 bg-purple-500'
                                    : 'border-gray-400'
                            }`}>
                                {settings.alertMode === 'timer' && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                Sistema del Timer
                            </span>
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] ml-8">
                            Usa el mismo sistema de alertas que bits, subs y raids. Incluye variantes, multimedia avanzada, TTS y más.
                        </p>
                    </button>
                </div>
            </div>

            {/* Configuración según modo */}
            {settings.alertMode === 'timer' ? (
                <div className={cardClass}>
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-100 dark:bg-purple-800/50 rounded-xl">
                                <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-purple-700 dark:text-purple-300 mb-1">
                                    Configurar Alertas de Donaciones
                                </h4>
                                <p className="text-sm text-purple-600 dark:text-purple-400 mb-3">
                                    Las alertas de donaciones se configuran en el Timer Extensible junto con bits, subs y otros eventos.
                                </p>
                                <a
                                    href="/features/timer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-all"
                                >
                                    <Settings className="w-4 h-4" />
                                    Ir a Configuración del Timer
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                            <Info className="w-4 h-4 flex-shrink-0" />
                            <span>
                                Busca la pestaña <strong>"Alertas"</strong> y selecciona <strong>"Donaciones"</strong> para configurar variantes por monto, sonidos, videos y más.
                            </span>
                        </p>
                    </div>

                    <div className="mt-4 text-sm text-[#64748b] dark:text-[#94a3b8]">
                        <p className="font-semibold mb-2">Con el sistema del Timer puedes:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Crear variantes por monto ($5, $10, $50, $100+)</li>
                            <li>Usar videos, GIFs e imágenes</li>
                            <li>Configurar sonidos personalizados</li>
                            <li>Activar TTS (texto a voz)</li>
                            <li>Personalizar animaciones y estilos</li>
                            <li>Ver las donaciones en el historial del timer</li>
                        </ul>
                    </div>
                </div>
            ) : (
                <TipsAlertSection
                    enabled={settings.tipsAlertConfig?.enabled ?? true}
                    onEnabledChange={(v) => updateSettings({
                        tipsAlertConfig: {
                            ...settings.tipsAlertConfig || DEFAULT_TIPS_ALERT_CONFIG,
                            enabled: v
                        }
                    })}
                    baseAlert={settings.tipsAlertConfig?.baseAlert || DEFAULT_TIPS_BASE_ALERT}
                    onBaseAlertChange={(updates) => updateSettings({
                        tipsAlertConfig: {
                            ...settings.tipsAlertConfig || DEFAULT_TIPS_ALERT_CONFIG,
                            baseAlert: {
                                ...(settings.tipsAlertConfig?.baseAlert || DEFAULT_TIPS_BASE_ALERT),
                                ...updates
                            }
                        }
                    })}
                    tiers={settings.tipsAlertConfig?.tiers || []}
                    onTiersChange={(tiers) => updateSettings({
                        tipsAlertConfig: {
                            ...settings.tipsAlertConfig || DEFAULT_TIPS_ALERT_CONFIG,
                            tiers
                        }
                    })}
                    cooldown={settings.tipsAlertConfig?.cooldown || 0}
                    onCooldownChange={(cooldown) => updateSettings({
                        tipsAlertConfig: {
                            ...settings.tipsAlertConfig || DEFAULT_TIPS_ALERT_CONFIG,
                            cooldown
                        }
                    })}
                    currency={settings.currency}
                    onTest={testTip}
                    userTier="free"
                />
            )}
        </div>
    );
};
