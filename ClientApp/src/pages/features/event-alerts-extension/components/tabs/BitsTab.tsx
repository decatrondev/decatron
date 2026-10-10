/**
 * Event Alerts Extension - Bits Tab Component
 *
 * Configuración de alertas para bits con sistema de tiers
 * Diseño idéntico al Timer Extensible
 */

import { AnimationEffectsSection } from '../AnimationEffectsSection';
import { DEFAULT_PREMIUM_VOICE } from '../../../../../components/tts/voiceDefaults';
import React, { useState } from 'react';
import type { BitsAlertConfig, AlertTier, VariantsConfig } from '../../types/index';
import { MediaEditor } from '../../../timer-extension/components/MediaEditor';
import { TtsSection } from '../../components/TtsSection';
import { ChatMessageSection } from '../../components/ChatMessageSection';
import { VariantEditor } from '../../components/VariantEditor';
import type { AlertMediaConfig } from '../../../../../types/timer-alerts';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';
import { EventSection } from '../EventSection';

interface BitsTabProps {
  config: BitsAlertConfig;
  onConfigChange: (updates: Partial<BitsAlertConfig>) => void;
}

export const BitsTab: React.FC<BitsTabProps> = ({ config, onConfigChange }) => {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  // La alerta base arranca plegada (el interruptor queda en el encabezado)
  const [baseOpen, setBaseOpen] = useState(false);

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
        voice: DEFAULT_PREMIUM_VOICE,
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
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
              💎 Alertas de Bits
            </label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
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
            <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
            <span className="ml-3 text-sm font-bold text-ds-text 3xl:text-base">
              {config.enabled ? 'Activado' : 'Desactivado'}
            </span>
          </label>
        </div>
      </div>

      {/* Alerta Base */}
      <div className="rounded-lg border-2 border-ds-accent bg-ds-accent/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
              🔔 Alerta BASE (suena SIEMPRE)
            </label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
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
            <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
          </label>
          <button type="button" onClick={() => setBaseOpen(o => !o)} aria-expanded={baseOpen} className="ml-3 p-2 rounded-lg text-ds-soft hover:bg-ds-accent/10" aria-label={baseOpen ? '−' : '+'}>
            <ChevronDown className={`w-5 h-5 transition-transform ${baseOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {baseOpen && (
        <div className="space-y-4 mt-4 pt-4 border-t border-ds-accent">
          {/* Mensaje Base */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-ds-soft 3xl:text-sm">
                Mensaje · Variables: <code className="text-ds-accent-text">{EVENT_VARIABLES.bits}</code>
              </label>
              {!config.baseAlert.message && (
                <button
                  onClick={() => onConfigChange({ baseAlert: { ...config.baseAlert, message: MESSAGE_TEMPLATES.bits.base } })}
                  className="text-xs px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg hover:bg-ds-accent/10 font-bold 3xl:text-sm"
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none font-mono text-sm 3xl:text-base"
            />
            {!config.baseAlert.message && (
              <button
                onClick={() => onConfigChange({ baseAlert: { ...config.baseAlert, message: MESSAGE_TEMPLATES.bits.base } })}
                className="mt-2 w-full p-2 bg-ds-accent/10 rounded-lg border border-ds-accent text-left group hover:border-ds-accent transition-all"
              >
                <p className="text-xs text-ds-soft 3xl:text-sm">💡 <span className="font-bold text-ds-accent-text">Sugerido:</span></p>
                <p className="text-sm text-ds-accent-text font-mono mt-1 3xl:text-base">"{MESSAGE_TEMPLATES.bits.base}"</p>
              </button>
            )}
          </div>

          {/* Duración y Volumen */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
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
                value={config.baseAlert.volume}
                onChange={(e) =>
                  onConfigChange({
                    baseAlert: {
                      ...config.baseAlert,
                      volume: parseInt(e.target.value) || 50,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
              />
            </div>
          </div>

          {/* Media */}
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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

          {/* Animación y efectos */}
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">Animación y efectos</label>
            <AnimationEffectsSection animation={config.baseAlert.animation} effects={config.baseAlert.effects}
              onChange={patch => onConfigChange({ baseAlert: { ...config.baseAlert, ...patch } })} />
          </div>

          {/* TTS Base Alert */}
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
        )}
      </div>

      {/* Tiers Específicos */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
              🎯 Tiers Específicos
            </label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
              Define alertas diferentes según la cantidad de bits donados
            </p>
          </div>
          <button
            onClick={addTier}
            className="px-4 py-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg transition-all font-bold text-sm flex items-center gap-2 3xl:text-base"
          >
            <Plus className="w-4 h-4" />
            Agregar Tier
          </button>
        </div>

        {config.tiers.length === 0 ? (
          <div className="text-center py-8 text-ds-soft">
            No hay tiers configurados. Agrega uno para empezar.
          </div>
        ) : (
          <div className="space-y-3">
            {config.tiers.map((tier, index) => (
              <div
                key={tier.id}
                className="border border-ds-border rounded-lg overflow-hidden"
              >
                {/* Tier Header */}
                <div
                  className="flex items-center justify-between p-4 bg-ds-bg cursor-pointer hover:bg-ds-raised transition-colors"
                  onClick={() =>
                    setExpandedTier(expandedTier === tier.id ? null : tier.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {index === 0 ? '🥉' : index === 1 ? '🥈' : index === 2 ? '🥇' : '💎'}
                    </span>
                    <div>
                      <div className="font-bold text-ds-text">
                        {tier.name}
                      </div>
                      <div className="text-xs text-ds-soft 3xl:text-sm">
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
                      className="p-2 hover:bg-ds-danger/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-ds-danger" />
                    </button>
                    {expandedTier === tier.id ? (
                      <ChevronUp className="w-5 h-5 text-ds-soft" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-ds-soft" />
                    )}
                  </div>
                </div>

                {/* Tier Content */}
                {expandedTier === tier.id && (
                  <div className="p-4 space-y-4 border-t border-ds-border">
                    {/* Nombre y Estado */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
                          Nombre del Tier
                        </label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                          className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                          <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
                          <span className="ml-3 text-sm font-bold text-ds-text 3xl:text-base">
                            {tier.enabled ? 'Activo' : 'Inactivo'}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Condición */}
                    <div>
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                          className="px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm 3xl:text-base"
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
                              className="px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm 3xl:text-base"
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
                              className="px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm 3xl:text-base"
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
                            className="col-span-2 px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm 3xl:text-base"
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
                            className="col-span-2 px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm 3xl:text-base"
                          />
                        )}
                      </div>
                    </div>

                    {/* Mensaje */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-ds-soft 3xl:text-sm">
                          Mensaje · <code className="text-ds-accent-text">{EVENT_VARIABLES.bits}</code>
                        </label>
                        {!tier.message && (
                          <button
                            onClick={() => {
                              const tierKey = index === 0 ? 'tier1' : index === 1 ? 'tier2' : 'tier3';
                              updateTier(tier.id, { message: MESSAGE_TEMPLATES.bits[tierKey as keyof typeof MESSAGE_TEMPLATES.bits] });
                            }}
                            className="text-xs px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg hover:bg-ds-accent/10 font-bold 3xl:text-sm"
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
                        className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none font-mono text-sm 3xl:text-base"
                      />
                    </div>

                    {/* Duración y Volumen */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                          className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                          className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
                        />
                      </div>
                    </div>

                    {/* Media */}
                    <div>
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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

                    {/* Animación y efectos */}
                    <div>
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">Animación y efectos</label>
                      <AnimationEffectsSection animation={tier.animation} effects={tier.effects} onChange={patch => updateTier(tier.id, patch)} />
                    </div>

                    {/* TTS */}
                    <div>
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                      <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
      <EventSection title="⏱️ Cooldown" description="Tiempo mínimo entre alertas de bits (segundos)" defaultOpen>

        <input
          type="number"
          min="0"
          max="60"
          value={config.cooldown}
          onChange={(e) => onConfigChange({ cooldown: parseInt(e.target.value) || 5 })}
          className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
        />
      </EventSection>
    </div>
  );
};
