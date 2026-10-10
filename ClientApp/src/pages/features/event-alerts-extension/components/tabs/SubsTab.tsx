/**
 * Event Alerts Extension - Subs Tab Component
 *
 * Configuración de alertas para subscripciones (Prime, T1, T2, T3)
 * Diseño idéntico al Timer Extensible
 */

import { AnimationEffectsSection } from '../AnimationEffectsSection';
import React, { useState } from 'react';
import type { SubsAlertConfig, SubTier, BaseAlertConfig, VariantsConfig } from '../../types/index';
import { MediaEditor } from '../../../timer-extension/components/MediaEditor';
import { TtsSection } from '../../components/TtsSection';
import { ChatMessageSection } from '../../components/ChatMessageSection';
import { VariantEditor } from '../../components/VariantEditor';
import type { AlertMediaConfig } from '../../../../../types/timer-alerts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';
import { EventSection } from '../EventSection';

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
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
              ⭐ Alertas de Subscripciones
            </label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
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
            <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
            <span className="ml-3 text-sm font-bold text-ds-text 3xl:text-base">
              {config.enabled ? 'Activado' : 'Desactivado'}
            </span>
          </label>
        </div>
      </div>

      {/* Configuración por Tier */}
      <EventSection title="🎯 Configuración por Tier" description="Personaliza la alerta para cada tipo de subscripción" defaultOpen>

        <div className="space-y-3">
          {(Object.keys(tierInfo) as SubTier[]).map((tier) => {
            const info = tierInfo[tier];
            const tierConfig = config.subTypes[tier];

            return (
              <div
                key={tier}
                className="border border-ds-border rounded-lg overflow-hidden"
              >
                {/* Tier Header */}
                <div
                  className="flex items-center justify-between p-4 bg-ds-bg cursor-pointer hover:bg-ds-raised transition-colors"
                  onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.emoji}</span>
                    <div>
                      <div className="font-bold text-ds-text">
                        {info.label}
                      </div>
                      <div className="text-xs text-ds-soft 3xl:text-sm">
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
                      <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-accent"></div>
                    </label>
                    {expandedTier === tier ? (
                      <ChevronUp className="w-5 h-5 text-ds-soft" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-ds-soft" />
                    )}
                  </div>
                </div>

                {/* Tier Content */}
                {expandedTier === tier && (
                  <div className="p-4 space-y-4 border-t border-ds-border">
                    {/* Mensaje */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-ds-soft 3xl:text-sm">
                          Mensaje · <code className="text-ds-accent-text">{EVENT_VARIABLES.subs}</code>
                        </label>
                        {!tierConfig.message && (
                          <button
                            onClick={() => updateSubType(tier, 'message', MESSAGE_TEMPLATES.subs[tier])}
                            className="text-xs px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg hover:bg-ds-accent/10 font-bold 3xl:text-sm"
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
                        className="ds-input w-full resize-none font-mono"
                      />
                      {!tierConfig.message && (
                        <button
                          onClick={() => updateSubType(tier, 'message', MESSAGE_TEMPLATES.subs[tier])}
                          className="mt-2 w-full p-2 bg-ds-accent/10 rounded-lg border border-ds-accent text-left group hover:border-ds-accent transition-all"
                        >
                          <p className="text-xs text-ds-soft 3xl:text-sm">💡 <span className="font-bold text-ds-accent-text">Sugerido:</span></p>
                          <p className="text-sm text-ds-accent-text font-mono mt-1 3xl:text-base">"{MESSAGE_TEMPLATES.subs[tier]}"</p>
                        </button>
                      )}
                    </div>

                    {/* Duración y Volumen */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                          className="ds-input w-full"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                          className="ds-input w-full"
                        />
                      </div>
                    </div>

                    {/* Media */}
                    <div>
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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

                    {/* Animación y efectos */}
                    <div>
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">Animación y efectos</label>
                      <AnimationEffectsSection animation={tierConfig.animation} effects={tierConfig.effects}
                        onChange={patch => { if (patch.animation) updateSubType(tier, 'animation', patch.animation); if (patch.effects) updateSubType(tier, 'effects', patch.effects); }} />
                    </div>

                    {/* TTS */}
                    <div>
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                          <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-accent"></div>
                        </label>
                        <span className="text-sm text-ds-text 3xl:text-base">
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
      </EventSection>

      {/* Cooldown */}
      <EventSection title="⏱️ Cooldown" description="Tiempo mínimo entre alertas de subscripciones (segundos)">

        <input
          type="number"
          min="0"
          max="60"
          value={config.cooldown}
          onChange={(e) => onConfigChange({ cooldown: parseInt(e.target.value) || 5 })}
          className="ds-input w-full"
        />
      </EventSection>
    </div>
  );
};
