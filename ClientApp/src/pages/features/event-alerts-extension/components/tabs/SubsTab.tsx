/**
 * Event Alerts Extension - Subs Tab Component
 *
 * Configuración de alertas para subscripciones (Prime, T1, T2, T3)
 * Diseño idéntico al Timer Extensible
 */

import React, { useState } from 'react';
import type { SubsAlertConfig, SubTier, BaseAlertConfig, VariantsConfig } from '../../types/index';
import { MediaEditor } from '../../../timer-extension/components/MediaEditor';
import { TtsSection } from '../../components/TtsSection';
import { ChatMessageSection } from '../../components/ChatMessageSection';
import { VariantEditor } from '../../components/VariantEditor';
import type { AlertMediaConfig } from '../../../../../types/timer-alerts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';

interface SubsTabProps {
  config: SubsAlertConfig;
  onConfigChange: (updates: Partial<SubsAlertConfig>) => void;
}

export const SubsTab: React.FC<SubsTabProps> = ({ config, onConfigChange }) => {
  const [expandedTier, setExpandedTier] = useState<SubTier | null>(null);

  const tierInfo: Record<SubTier, { emoji: string; label: string; color: string }> = {
    prime: { emoji: '👑', label: 'Prime', color: 'purple' },
    tier1: { emoji: '⭐', label: 'Tier 1', color: 'blue' },
    tier2: { emoji: '⭐⭐', label: 'Tier 2', color: 'green' },
    tier3: { emoji: '⭐⭐⭐', label: 'Tier 3', color: 'red' },
  };

  const updateSubType = <K extends keyof BaseAlertConfig>(tier: SubTier, field: K, value: BaseAlertConfig[K]) => {
    onConfigChange({
      subTypes: {
        ...config.subTypes,
        [tier]: {
          ...config.subTypes[tier],
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Sistema Activado/Desactivado */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
              ⭐ Alertas de Subscripciones
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              Configura las alertas para nuevas subscripciones (Prime, T1, T2, T3)
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

      {/* Configuración por Tier */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          🎯 Configuración por Tier
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Personaliza la alerta para cada tipo de subscripción
        </p>

        <div className="space-y-3">
          {(Object.keys(tierInfo) as SubTier[]).map((tier) => {
            const info = tierInfo[tier];
            const tierConfig = config.subTypes[tier];

            return (
              <div
                key={tier}
                className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden"
              >
                {/* Tier Header */}
                <div
                  className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                  onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.emoji}</span>
                    <div>
                      <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                        {info.label}
                      </div>
                      <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        {tierConfig.message.length > 50
                          ? `${tierConfig.message.substring(0, 50)}...`
                          : tierConfig.message}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={tierConfig.enabled}
                        onChange={(e) => updateSubType(tier, 'enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
                    </label>
                    {expandedTier === tier ? (
                      <ChevronUp className="w-5 h-5 text-[#64748b]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#64748b]" />
                    )}
                  </div>
                </div>

                {/* Tier Content */}
                {expandedTier === tier && (
                  <div className="p-4 space-y-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                    {/* Mensaje */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                          Mensaje · <code className="text-blue-500">{EVENT_VARIABLES.subs}</code>
                        </label>
                        {!tierConfig.message && (
                          <button
                            onClick={() => updateSubType(tier, 'message', MESSAGE_TEMPLATES.subs[tier])}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 font-bold"
                          >
                            ✨ Usar predefinido
                          </button>
                        )}
                      </div>
                      <textarea
                        value={tierConfig.message}
                        onChange={(e) => updateSubType(tier, 'message', e.target.value)}
                        placeholder={MESSAGE_TEMPLATES.subs[tier]}
                        rows={2}
                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
                      />
                      {!tierConfig.message && (
                        <button
                          onClick={() => updateSubType(tier, 'message', MESSAGE_TEMPLATES.subs[tier])}
                          className="mt-2 w-full p-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-left group hover:border-blue-400 transition-all"
                        >
                          <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">💡 <span className="font-bold text-blue-600 dark:text-blue-400">Sugerido:</span></p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 font-mono mt-1">"{MESSAGE_TEMPLATES.subs[tier]}"</p>
                        </button>
                      )}
                    </div>

                    {/* Duración y Volumen */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                          Duración (segundos)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={tierConfig.duration}
                          onChange={(e) =>
                            updateSubType(tier, 'duration', parseInt(e.target.value) || 5)
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
                          value={tierConfig.volume}
                          onChange={(e) =>
                            updateSubType(tier, 'volume', parseInt(e.target.value) || 50)
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
                        config={tierConfig.media as AlertMediaConfig}
                        onChange={(media) => updateSubType(tier, 'media', media)}
                        alertContext={{
                          message: tierConfig.message || `¡{username} se suscribió!`,
                          duration: tierConfig.duration,
                          emoji: info.emoji,
                        }}
                      />
                    </div>

                    {/* TTS */}
                    <div>
                      <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                        Text-to-Speech
                      </label>
                      <TtsSection
                        config={tierConfig.tts}
                        onChange={(updates) => updateSubType(tier, 'tts', { ...tierConfig.tts, ...updates })}
                        messageVariables={EVENT_VARIABLES.subs}
                        hasUserMessage={true}
                        suggestedTemplate={TTS_TEMPLATES.subs[tier]}
                        eventType="subs"
                      />
                    </div>

                    {/* Chat Message */}
                    <div>
                      <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                        Mensaje del Bot en Chat
                      </label>
                      <ChatMessageSection
                        config={tierConfig.chatMessage}
                        onChange={(chatMessage) => updateSubType(tier, 'chatMessage', chatMessage)}
                        messageVariables={EVENT_VARIABLES.subs}
                        suggestedTemplate={CHAT_TEMPLATES.subs[tier]}
                      />
                    </div>

                    {/* Efectos */}
                    <div>
                      <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                        Efectos Visuales
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tierConfig.effects.enabled}
                            onChange={(e) =>
                              updateSubType(tier, 'effects', {
                                ...tierConfig.effects,
                                enabled: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
                        </label>
                        <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                          {tierConfig.effects.enabled
                            ? `Activos: ${tierConfig.effects.effects.join(', ') || 'Ninguno'}`
                            : 'Desactivados'}
                        </span>
                      </div>
                    </div>

                    {/* Variantes */}
                    <VariantEditor
                      config={tierConfig.variants}
                      onChange={(variants: VariantsConfig) => updateSubType(tier, 'variants', variants)}
                      userTier="free"
                      messageVariables={EVENT_VARIABLES.subs}
                      hasUserMessage={true}
                      eventType="subs"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cooldown */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          ⏱️ Cooldown
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Tiempo mínimo entre alertas de subscripciones (segundos)
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
