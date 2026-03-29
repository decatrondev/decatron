/**
 * Event Alerts Extension - Bits Tab Component
 *
 * Configuración de alertas para bits con sistema de tiers
 * Diseño idéntico al Timer Extensible
 */

import React, { useState } from 'react';
import type { BitsAlertConfig, AlertTier, VariantsConfig } from '../../types/index';
import { MediaEditor } from '../../../timer-extension/components/MediaEditor';
import { TtsSection } from '../../components/TtsSection';
import { ChatMessageSection } from '../../components/ChatMessageSection';
import { VariantEditor } from '../../components/VariantEditor';
import type { AlertMediaConfig } from '../../../../../types/timer-alerts';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';

interface BitsTabProps {
  config: BitsAlertConfig;
  onConfigChange: (updates: Partial<BitsAlertConfig>) => void;
}

export const BitsTab: React.FC<BitsTabProps> = ({ config, onConfigChange }) => {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  const addTier = () => {
    const tierIndex = config.tiers.length;
    const tierName = tierIndex === 0 ? 'Básico' : tierIndex === 1 ? 'Medio' : tierIndex === 2 ? 'Épico' : `Tier ${tierIndex + 1}`;
    const tierKey = tierIndex === 0 ? 'tier1' : tierIndex === 1 ? 'tier2' : 'tier3';

    const newTier: AlertTier = {
      id: `bits-tier-${Date.now()}`,
      name: tierName,
      enabled: true,
      condition: {
        type: 'range',
        min: tierIndex === 0 ? 1 : tierIndex === 1 ? 101 : 501,
        max: tierIndex === 0 ? 100 : tierIndex === 1 ? 500 : 9999,
      },
      message: MESSAGE_TEMPLATES.bits[tierKey as keyof typeof MESSAGE_TEMPLATES.bits] || MESSAGE_TEMPLATES.bits.base,
      duration: tierIndex === 0 ? 5 : tierIndex === 1 ? 7 : 10,
      media: { enabled: false, mode: 'simple' as const },
      animation: {
        type: tierIndex === 0 ? 'slide' : tierIndex === 1 ? 'zoom' : 'bounce',
        direction: tierIndex === 0 ? 'left' : 'center',
        duration: tierIndex === 0 ? 500 : tierIndex === 1 ? 600 : 800,
        easing: 'ease-in-out',
      },
      sound: '',
      volume: tierIndex === 0 ? 50 : tierIndex === 1 ? 60 : 80,
      effects: { enabled: tierIndex > 0, effects: tierIndex === 1 ? ['glow', 'shake'] : tierIndex === 2 ? ['glow', 'shake', 'confetti'] : [] },
      tts: {
        enabled: false,
        voice: 'Lupe',
        engine: 'standard' as const,
        languageCode: 'es-US',
        templateVolume: 80,
        template: TTS_TEMPLATES.bits[tierKey as keyof typeof TTS_TEMPLATES.bits] || TTS_TEMPLATES.bits.base,
        readUserMessage: true,
        userMessageVolume: 80,
        maxChars: 150,
        waitForSound: true,
      },
    };

    onConfigChange({
      tiers: [...config.tiers, newTier],
    });
  };

  const updateTier = (tierId: string, updates: Partial<AlertTier>) => {
    onConfigChange({
      tiers: config.tiers.map((tier) =>
        tier.id === tierId ? { ...tier, ...updates } : tier
      ),
    });
  };

  const deleteTier = (tierId: string) => {
    if (confirm('¿Estás seguro de eliminar este tier?')) {
      onConfigChange({
        tiers: config.tiers.filter((tier) => tier.id !== tierId),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Sistema Activado/Desactivado */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
              💎 Alertas de Bits
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              Configura las alertas que aparecen cuando alguien dona bits
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => onConfigChange({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
            <span className="ml-3 text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
              {config.enabled ? 'Activado' : 'Desactivado'}
            </span>
          </label>
        </div>
      </div>

      {/* Alerta Base */}
      <div className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
              🔔 Alerta BASE (suena SIEMPRE)
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              Esta alerta se reproduce para cualquier cantidad de bits. Los tiers pueden sobrescribirla.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.baseAlert.enabled}
              onChange={(e) =>
                onConfigChange({
                  baseAlert: {
                    ...config.baseAlert,
                    enabled: e.target.checked,
                  },
                })
              }
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
          </label>
        </div>

        <div className="space-y-4 mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          {/* Mensaje Base */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                Mensaje · Variables: <code className="text-blue-500">{EVENT_VARIABLES.bits}</code>
              </label>
              {!config.baseAlert.message && (
                <button
                  onClick={() => onConfigChange({ baseAlert: { ...config.baseAlert, message: MESSAGE_TEMPLATES.bits.base } })}
                  className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 font-bold"
                >
                  ✨ Usar predefinido
                </button>
              )}
            </div>
            <input
              type="text"
              value={config.baseAlert.message}
              onChange={(e) =>
                onConfigChange({
                  baseAlert: {
                    ...config.baseAlert,
                    message: e.target.value,
                  },
                })
              }
              placeholder={MESSAGE_TEMPLATES.bits.base}
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
            />
            {!config.baseAlert.message && (
              <button
                onClick={() => onConfigChange({ baseAlert: { ...config.baseAlert, message: MESSAGE_TEMPLATES.bits.base } })}
                className="mt-2 w-full p-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-left group hover:border-blue-400 transition-all"
              >
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">💡 <span className="font-bold text-blue-600 dark:text-blue-400">Sugerido:</span></p>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-mono mt-1">"{MESSAGE_TEMPLATES.bits.base}"</p>
              </button>
            )}
          </div>

          {/* Duración y Volumen */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                Duración (seg)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={config.baseAlert.duration}
                onChange={(e) =>
                  onConfigChange({
                    baseAlert: {
                      ...config.baseAlert,
                      duration: parseInt(e.target.value) || 5,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                Volumen (0-100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.baseAlert.volume}
                onChange={(e) =>
                  onConfigChange({
                    baseAlert: {
                      ...config.baseAlert,
                      volume: parseInt(e.target.value) || 50,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Media */}
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
              Multimedia (Audio / Video / Imagen)
            </label>
            <MediaEditor
              config={config.baseAlert.media as AlertMediaConfig}
              onChange={(media) =>
                onConfigChange({ baseAlert: { ...config.baseAlert, media } })
              }
              alertContext={{
                message: config.baseAlert.message || `¡{username} donó {amount} bits!`,
                duration: config.baseAlert.duration,
                emoji: '💎',
              }}
            />
          </div>

          {/* TTS Base Alert */}
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
              Text-to-Speech
            </label>
            <TtsSection
              config={config.baseAlert.tts}
              onChange={(updates) => onConfigChange({ baseAlert: { ...config.baseAlert, tts: { ...config.baseAlert.tts, ...updates } } })}
              messageVariables={EVENT_VARIABLES.bits}
              hasUserMessage={true}
              suggestedTemplate={TTS_TEMPLATES.bits.base}
              eventType="bits"
            />
          </div>

          {/* Chat Message Base Alert */}
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
              Mensaje del Bot en Chat
            </label>
            <ChatMessageSection
              config={config.baseAlert.chatMessage}
              onChange={(chatMessage) => onConfigChange({ baseAlert: { ...config.baseAlert, chatMessage } })}
              messageVariables={EVENT_VARIABLES.bits}
              suggestedTemplate={CHAT_TEMPLATES.bits.base}
            />
          </div>

          {/* Variantes */}
          <VariantEditor
            config={config.baseAlert.variants}
            onChange={(variants: VariantsConfig) => onConfigChange({ baseAlert: { ...config.baseAlert, variants } })}
            userTier="free"
            messageVariables={EVENT_VARIABLES.bits}
            hasUserMessage={true}
            eventType="bits"
          />
        </div>
      </div>

      {/* Tiers Específicos */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
              🎯 Tiers Específicos
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              Define alertas diferentes según la cantidad de bits donados
            </p>
          </div>
          <button
            onClick={addTier}
            className="px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white rounded-lg transition-all font-bold text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Agregar Tier
          </button>
        </div>

        {config.tiers.length === 0 ? (
          <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">
            No hay tiers configurados. Agrega uno para empezar.
          </div>
        ) : (
          <div className="space-y-3">
            {config.tiers.map((tier, index) => (
              <div
                key={tier.id}
                className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden"
              >
                {/* Tier Header */}
                <div
                  className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                  onClick={() =>
                    setExpandedTier(expandedTier === tier.id ? null : tier.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {index === 0 ? '🥉' : index === 1 ? '🥈' : index === 2 ? '🥇' : '💎'}
                    </span>
                    <div>
                      <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                        {tier.name}
                      </div>
                      <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        {tier.condition.type === 'range' &&
                          `${tier.condition.min} - ${tier.condition.max} bits`}
                        {tier.condition.type === 'minimum' &&
                          `${tier.condition.min}+ bits`}
                        {tier.condition.type === 'exact' &&
                          `Exactamente ${tier.condition.exact} bits`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTier(tier.id);
                      }}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                    {expandedTier === tier.id ? (
                      <ChevronUp className="w-5 h-5 text-[#64748b]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#64748b]" />
                    )}
                  </div>
                </div>

                {/* Tier Content */}
                {expandedTier === tier.id && (
                  <div className="p-4 space-y-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                    {/* Nombre y Estado */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                          Nombre del Tier
                        </label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                          className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                          Estado
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tier.enabled}
                            onChange={(e) =>
                              updateTier(tier.id, { enabled: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
                          <span className="ml-3 text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {tier.enabled ? 'Activo' : 'Inactivo'}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Condición */}
                    <div>
                      <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                        Condición de Activación
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <select
                          value={tier.condition.type}
                          onChange={(e) =>
                            updateTier(tier.id, {
                              condition: {
                                ...tier.condition,
                                type: e.target.value as 'range' | 'minimum' | 'exact',
                              },
                            })
                          }
                          className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                          <option value="range">Rango</option>
                          <option value="minimum">Mínimo</option>
                          <option value="exact">Exacto</option>
                        </select>

                        {tier.condition.type === 'range' && (
                          <>
                            <input
                              type="number"
                              min="0"
                              value={tier.condition.min}
                              onChange={(e) =>
                                updateTier(tier.id, {
                                  condition: {
                                    ...tier.condition,
                                    min: parseInt(e.target.value) || 0,
                                  },
                                })
                              }
                              placeholder="Mínimo"
                              className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                            <input
                              type="number"
                              min="0"
                              value={tier.condition.max}
                              onChange={(e) =>
                                updateTier(tier.id, {
                                  condition: {
                                    ...tier.condition,
                                    max: parseInt(e.target.value) || 100,
                                  },
                                })
                              }
                              placeholder="Máximo"
                              className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                          </>
                        )}

                        {tier.condition.type === 'minimum' && (
                          <input
                            type="number"
                            min="0"
                            value={tier.condition.min}
                            onChange={(e) =>
                              updateTier(tier.id, {
                                condition: {
                                  ...tier.condition,
                                  min: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                            placeholder="Cantidad mínima"
                            className="col-span-2 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        )}

                        {tier.condition.type === 'exact' && (
                          <input
                            type="number"
                            min="0"
                            value={tier.condition.exact}
                            onChange={(e) =>
                              updateTier(tier.id, {
                                condition: {
                                  ...tier.condition,
                                  exact: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                            placeholder="Cantidad exacta"
                            className="col-span-2 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        )}
                      </div>
                    </div>

                    {/* Mensaje */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                          Mensaje · <code className="text-blue-500">{EVENT_VARIABLES.bits}</code>
                        </label>
                        {!tier.message && (
                          <button
                            onClick={() => {
                              const tierKey = index === 0 ? 'tier1' : index === 1 ? 'tier2' : 'tier3';
                              updateTier(tier.id, { message: MESSAGE_TEMPLATES.bits[tierKey as keyof typeof MESSAGE_TEMPLATES.bits] });
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 font-bold"
                          >
                            ✨ Usar predefinido
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={tier.message}
                        onChange={(e) => updateTier(tier.id, { message: e.target.value })}
                        placeholder={index === 0 ? MESSAGE_TEMPLATES.bits.tier1 : index === 1 ? MESSAGE_TEMPLATES.bits.tier2 : MESSAGE_TEMPLATES.bits.tier3}
                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                      />
                    </div>

                    {/* Duración y Volumen */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                          Duración (seg)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={tier.duration}
                          onChange={(e) =>
                            updateTier(tier.id, { duration: parseInt(e.target.value) || 5 })
                          }
                          className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                          Volumen
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={tier.volume}
                          onChange={(e) =>
                            updateTier(tier.id, { volume: parseInt(e.target.value) || 50 })
                          }
                          className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Media */}
                    <div>
                      <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                        Multimedia (Audio / Video / Imagen)
                      </label>
                      <MediaEditor
                        config={tier.media as AlertMediaConfig}
                        onChange={(media) => updateTier(tier.id, { media })}
                        alertContext={{
                          message: tier.message || `¡{username} donó {amount} bits!`,
                          duration: tier.duration,
                          emoji: index === 0 ? '💎' : index === 1 ? '💜' : '🔥',
                        }}
                      />
                    </div>

                    {/* TTS */}
                    <div>
                      <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                        Text-to-Speech
                      </label>
                      <TtsSection
                        config={tier.tts}
                        onChange={(updates) => updateTier(tier.id, { tts: { ...tier.tts, ...updates } })}
                        messageVariables={EVENT_VARIABLES.bits}
                        hasUserMessage={true}
                        suggestedTemplate={index === 0 ? TTS_TEMPLATES.bits.tier1 : index === 1 ? TTS_TEMPLATES.bits.tier2 : TTS_TEMPLATES.bits.tier3}
                        eventType="bits"
                      />
                    </div>

                    {/* Chat Message */}
                    <div>
                      <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                        Mensaje del Bot en Chat
                      </label>
                      <ChatMessageSection
                        config={tier.chatMessage}
                        onChange={(chatMessage) => updateTier(tier.id, { chatMessage })}
                        messageVariables={EVENT_VARIABLES.bits}
                        suggestedTemplate={index === 0 ? CHAT_TEMPLATES.bits.tier1 : index === 1 ? CHAT_TEMPLATES.bits.tier2 : CHAT_TEMPLATES.bits.tier3}
                      />
                    </div>

                    {/* Variantes */}
                    <VariantEditor
                      config={tier.variants}
                      onChange={(variants: VariantsConfig) => updateTier(tier.id, { variants })}
                      userTier="free"
                      messageVariables={EVENT_VARIABLES.bits}
                      hasUserMessage={true}
                      eventType="bits"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cooldown */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          ⏱️ Cooldown
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Tiempo mínimo entre alertas de bits (segundos)
        </p>

        <input
          type="number"
          min="0"
          max="60"
          value={config.cooldown}
          onChange={(e) => onConfigChange({ cooldown: parseInt(e.target.value) || 5 })}
          className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    </div>
  );
};
