/**
 * TipsAlertSection - Sistema de alertas para Tips con tiers y variantes
 * Similar a AlertTierSection pero específico para donaciones
 */

import { DEFAULT_PREMIUM_VOICE } from '../../../../components/tts/voiceDefaults';
import React, { useState } from 'react';
import type { TipsBaseAlertConfig, TipsTier, TtsConfig, VariantsConfig } from '../types/index';
import { TIPS_MESSAGE_TEMPLATES, TIPS_TTS_TEMPLATES, TIPS_CHAT_TEMPLATES } from '../types/index';
import { MediaEditor } from '../../timer-extension/components/MediaEditor';
import { TtsSection } from '../../event-alerts-extension/components/TtsSection';
import { ChatMessageSection } from '../../event-alerts-extension/components/ChatMessageSection';
import { VariantEditor } from '../../event-alerts-extension/components/VariantEditor';
import { VARIANT_LIMITS } from '../../event-alerts-extension/types/index';
import type { AlertMediaConfig } from '../../../../types/timer-alerts';
import { Plus, Trash2, ChevronDown, ChevronUp, Play, DollarSign } from 'lucide-react';

interface TipsAlertSectionProps {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  baseAlert: TipsBaseAlertConfig;
  onBaseAlertChange: (updates: Partial<TipsBaseAlertConfig>) => void;
  tiers: TipsTier[];
  onTiersChange: (tiers: TipsTier[]) => void;
  cooldown: number;
  onCooldownChange: (value: number) => void;
  currency: string;
  onTest?: () => void;
  userTier?: 'free' | 'supporter' | 'premium';
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-ok/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
  </label>
);

const messageVariables = '{donorName}, {amount}, {message}, {time}';
const ttsVariables = '{donorName}, {amount}, {message}';

export const TipsAlertSection: React.FC<TipsAlertSectionProps> = ({
  enabled, onEnabledChange,
  baseAlert, onBaseAlertChange,
  tiers, onTiersChange,
  cooldown, onCooldownChange,
  currency,
  onTest,
  userTier = 'free',
}) => {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);


  const inputClass = "w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-ok/40 outline-none";
  const labelClass = "text-xs font-bold text-ds-soft block mb-2";

  // Get template for tier index
  const getMessageTemplate = (index: number) => {
    return index === 0 ? TIPS_MESSAGE_TEMPLATES.tier1 : index === 1 ? TIPS_MESSAGE_TEMPLATES.tier2 : TIPS_MESSAGE_TEMPLATES.tier3;
  };

  const getTtsTemplate = (index: number) => {
    return index === 0 ? TIPS_TTS_TEMPLATES.tier1 : index === 1 ? TIPS_TTS_TEMPLATES.tier2 : TIPS_TTS_TEMPLATES.tier3;
  };

  const getChatTemplate = (index: number) => {
    return index === 0 ? TIPS_CHAT_TEMPLATES.tier1 : index === 1 ? TIPS_CHAT_TEMPLATES.tier2 : TIPS_CHAT_TEMPLATES.tier3;
  };

  const addTier = () => {
    const tierIndex = tiers.length;
    const tierName = tierIndex === 0 ? 'Pequeña' : tierIndex === 1 ? 'Mediana' : tierIndex === 2 ? 'Grande' : `Tier ${tierIndex + 1}`;

    // Default amounts based on tier
    const defaultMin = tierIndex === 0 ? 1 : tierIndex === 1 ? 10 : tierIndex === 2 ? 50 : 100;
    const defaultMax = tierIndex === 0 ? 9 : tierIndex === 1 ? 49 : tierIndex === 2 ? 99 : 999;

    const newTier: TipsTier = {
      id: `tier-${Date.now()}`,
      name: tierName,
      enabled: true,
      condition: {
        type: tierIndex === 2 ? 'minimum' : 'range',
        min: defaultMin,
        max: defaultMax
      },
      message: getMessageTemplate(tierIndex) || '¡{donorName} donó {amount}!',
      duration: tierIndex === 0 ? 5 : tierIndex === 1 ? 7 : 10,
      media: { enabled: false, mode: 'simple' as const },
      animation: {
        type: tierIndex === 0 ? 'fade' : tierIndex === 1 ? 'zoom' : 'bounce',
        direction: 'center',
        duration: tierIndex === 0 ? 500 : tierIndex === 1 ? 600 : 800,
        easing: 'ease-in-out'
      },
      sound: '',
      volume: tierIndex === 0 ? 50 : tierIndex === 1 ? 60 : 80,
      effects: { enabled: tierIndex > 0, effects: tierIndex === 1 ? ['glow'] : tierIndex === 2 ? ['glow', 'confetti'] : [] },
      tts: {
        enabled: false,
        voice: DEFAULT_PREMIUM_VOICE,
        engine: 'standard' as const,
        languageCode: 'es-US',
        templateVolume: 80,
        template: getTtsTemplate(tierIndex) || '',
        readUserMessage: true,
        userMessageVolume: 80,
        maxChars: 150,
        waitForSound: true,
      },
    };
    onTiersChange([...tiers, newTier]);
  };

  const updateTier = (id: string, updates: Partial<TipsTier>) => {
    onTiersChange(tiers.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTier = (id: string) => {
    if (confirm('¿Eliminar este tier?')) onTiersChange(tiers.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header Toggle */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-ds-accent-text" />
              💰 Alertas de Donaciones
            </label>
            <p className="text-xs text-ds-soft mt-1">
              Configura alertas visuales y sonoras cuando recibes donaciones
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onTest && (
              <button
                onClick={onTest}
                className="px-4 py-2 bg-ds-ok/10 text-ds-ok rounded-lg font-bold flex items-center gap-2 transition-all hover:bg-ds-ok/10"
              >
                <Play className="w-4 h-4" />
                Test
              </button>
            )}
            <Toggle checked={enabled} onChange={onEnabledChange} />
            <span className="text-sm font-bold text-ds-text">{enabled ? 'Activado' : 'Desactivado'}</span>
          </div>
        </div>
      </div>

      {/* Alerta Base */}
      <div className="rounded-lg border-2 border-ds-ok/40 bg-ds-ok/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text">🔔 Alerta BASE (suena SIEMPRE)</label>
            <p className="text-xs text-ds-soft mt-1">Se reproduce siempre. Los tiers pueden sobrescribirla.</p>
          </div>
          <Toggle checked={baseAlert.enabled} onChange={v => onBaseAlertChange({ enabled: v })} />
        </div>

        <div className="space-y-4 pt-4 border-t border-ds-ok/40">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + ' mb-0'}>Mensaje · <code className="text-ds-ok">{messageVariables}</code></label>
              {!baseAlert.message && (
                <button
                  onClick={() => onBaseAlertChange({ message: TIPS_MESSAGE_TEMPLATES.base })}
                  className="text-xs px-2 py-1 bg-ds-ok/10 text-ds-ok rounded-lg hover:bg-ds-ok/10 font-bold"
                >
                  ✨ Usar predefinido
                </button>
              )}
            </div>
            <input type="text" value={baseAlert.message} onChange={e => onBaseAlertChange({ message: e.target.value })}
              placeholder={TIPS_MESSAGE_TEMPLATES.base}
              className={inputClass + " font-mono text-sm"} />
            {!baseAlert.message && (
              <button
                onClick={() => onBaseAlertChange({ message: TIPS_MESSAGE_TEMPLATES.base })}
                className="mt-2 w-full p-2 bg-ds-ok/10 rounded-lg border border-ds-ok/40 text-left group hover:border-ds-ok/40 transition-all"
              >
                <p className="text-xs text-ds-soft">💡 <span className="font-bold text-ds-ok">Sugerido:</span></p>
                <p className="text-sm text-ds-ok font-mono mt-1">"{TIPS_MESSAGE_TEMPLATES.base}"</p>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Duración (seg)</label>
              <input type="number" min="1" max="30" value={baseAlert.duration}
                onChange={e => onBaseAlertChange({ duration: parseInt(e.target.value) || 5 })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Volumen (0-100)</label>
              <input type="number" min="0" max="100" value={baseAlert.volume}
                onChange={e => onBaseAlertChange({ volume: parseInt(e.target.value) || 50 })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Multimedia (Audio / Video / Imagen)</label>
            <MediaEditor
              config={baseAlert.media as AlertMediaConfig}
              onChange={(media) => {
                onBaseAlertChange({ media });
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Text-to-Speech</label>
            <TtsSection
              config={baseAlert.tts as TtsConfig}
              onChange={(updates) => onBaseAlertChange({ tts: { ...baseAlert.tts, ...updates } })}
              messageVariables={ttsVariables}
              hasUserMessage={true}
              suggestedTemplate={TIPS_TTS_TEMPLATES.base}
              eventType="tips"
            />
          </div>
          <div>
            <label className={labelClass}>Mensaje del Bot en Chat</label>
            <ChatMessageSection
              config={baseAlert.chatMessage}
              onChange={(chatMessage) => onBaseAlertChange({ chatMessage })}
              messageVariables={messageVariables}
              suggestedTemplate={TIPS_CHAT_TEMPLATES.base}
            />
          </div>

          {/* Sistema de Variantes */}
          <VariantEditor
            config={baseAlert.variants}
            onChange={(variants) => onBaseAlertChange({ variants })}
            userTier={userTier}
            messageVariables={messageVariables}
            hasUserMessage={true}
            eventType="tips"
          />
        </div>
      </div>

      {/* Tiers por Monto */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text">🎯 Tiers Específicos</label>
            <p className="text-xs text-ds-soft mt-1">Alertas diferentes según monto donado ({currency})</p>
          </div>
          <button onClick={addTier}
            className="ds-btn ds-btn--primary">
            <Plus className="w-4 h-4" /> Agregar Tier
          </button>
        </div>

        {tiers.length === 0 ? (
          <div className="text-center py-8 text-ds-soft">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay tiers configurados.</p>
            <p className="text-sm mt-1">Agrega uno para crear alertas especiales por monto de donación.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tiers.map((tier, index) => (
              <div key={tier.id} className="border border-ds-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-ds-bg cursor-pointer hover:bg-ds-raised transition-colors"
                  onClick={() => setExpandedTier(expandedTier === tier.id ? null : tier.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{index === 0 ? '🥉' : index === 1 ? '🥈' : index === 2 ? '🥇' : '💎'}</span>
                    <div>
                      <div className="font-bold text-ds-text">{tier.name}</div>
                      <div className="text-xs text-ds-soft">
                        {tier.condition.type === 'range' && `${currency} ${tier.condition.min} - ${tier.condition.max}`}
                        {tier.condition.type === 'minimum' && `${currency} ${tier.condition.min}+`}
                        {tier.condition.type === 'exact' && `Exactamente ${currency} ${tier.condition.exact}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); deleteTier(tier.id); }}
                      className="p-2 hover:bg-ds-danger/10 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-ds-danger" />
                    </button>
                    {expandedTier === tier.id ? <ChevronUp className="w-5 h-5 text-ds-soft" /> : <ChevronDown className="w-5 h-5 text-ds-soft" />}
                  </div>
                </div>

                {expandedTier === tier.id && (
                  <div className="p-4 space-y-4 border-t border-ds-border">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nombre del Tier</label>
                        <input type="text" value={tier.name} onChange={e => updateTier(tier.id, { name: e.target.value })} className={inputClass} />
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                        <Toggle checked={tier.enabled} onChange={v => updateTier(tier.id, { enabled: v })} />
                        <span className="text-sm text-ds-text">{tier.enabled ? 'Activo' : 'Inactivo'}</span>
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Condición (monto en {currency})</label>
                      <div className="grid grid-cols-3 gap-3">
                        <select value={tier.condition.type}
                          onChange={e => updateTier(tier.id, { condition: { ...tier.condition, type: e.target.value as any } })}
                          className="ds-input">
                          <option value="range">Rango</option>
                          <option value="minimum">Mínimo</option>
                          <option value="exact">Exacto</option>
                        </select>
                        {tier.condition.type === 'range' && (<>
                          <input type="number" min="0" step="0.01" value={tier.condition.min ?? 0}
                            onChange={e => updateTier(tier.id, { condition: { ...tier.condition, min: parseFloat(e.target.value) || 0 } })}
                            placeholder="Mínimo" className="ds-input" />
                          <input type="number" min="0" step="0.01" value={tier.condition.max ?? 100}
                            onChange={e => updateTier(tier.id, { condition: { ...tier.condition, max: parseFloat(e.target.value) || 100 } })}
                            placeholder="Máximo" className="ds-input" />
                        </>)}
                        {tier.condition.type === 'minimum' && (
                          <input type="number" min="0" step="0.01" value={tier.condition.min ?? 0}
                            onChange={e => updateTier(tier.id, { condition: { ...tier.condition, min: parseFloat(e.target.value) || 0 } })}
                            placeholder="Monto mínimo" className="ds-input col-span-2" />
                        )}
                        {tier.condition.type === 'exact' && (
                          <input type="number" min="0" step="0.01" value={tier.condition.exact ?? 0}
                            onChange={e => updateTier(tier.id, { condition: { ...tier.condition, exact: parseFloat(e.target.value) || 0 } })}
                            placeholder="Monto exacto" className="ds-input col-span-2" />
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelClass + ' mb-0'}>Mensaje · <code className="text-ds-ok">{messageVariables}</code></label>
                        {!tier.message && getMessageTemplate(index) && (
                          <button
                            onClick={() => updateTier(tier.id, { message: getMessageTemplate(index) })}
                            className="text-xs px-2 py-1 bg-ds-ok/10 text-ds-ok rounded-lg hover:bg-ds-ok/10 font-bold"
                          >
                            ✨ Usar predefinido
                          </button>
                        )}
                      </div>
                      <input type="text" value={tier.message} onChange={e => updateTier(tier.id, { message: e.target.value })}
                        placeholder={getMessageTemplate(index)}
                        className={inputClass + " font-mono text-sm"} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Duración (seg)</label>
                        <input type="number" min="1" max="30" value={tier.duration}
                          onChange={e => updateTier(tier.id, { duration: parseInt(e.target.value) || 5 })} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Volumen</label>
                        <input type="number" min="0" max="100" value={tier.volume}
                          onChange={e => updateTier(tier.id, { volume: parseInt(e.target.value) || 50 })} className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Multimedia (Audio / Video / Imagen)</label>
                      <MediaEditor
                        config={tier.media as AlertMediaConfig}
                        onChange={(media) => updateTier(tier.id, { media })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Text-to-Speech</label>
                      <TtsSection
                        config={tier.tts}
                        onChange={(updates) => updateTier(tier.id, { tts: { ...tier.tts, ...updates } })}
                        messageVariables={ttsVariables}
                        hasUserMessage={true}
                        suggestedTemplate={getTtsTemplate(index)}
                        eventType="tips"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Mensaje del Bot en Chat</label>
                      <ChatMessageSection
                        config={tier.chatMessage}
                        onChange={(chatMessage) => updateTier(tier.id, { chatMessage })}
                        messageVariables={messageVariables}
                        suggestedTemplate={getChatTemplate(index)}
                      />
                    </div>

                    {/* Sistema de Variantes */}
                    <VariantEditor
                      config={tier.variants}
                      onChange={(variants) => updateTier(tier.id, { variants })}
                      userTier={userTier}
                      messageVariables={messageVariables}
                      hasUserMessage={true}
                      eventType="tips"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cooldown */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <label className="text-sm font-bold text-ds-text flex items-center gap-2 mb-2">⏱️ Cooldown</label>
        <p className="text-xs text-ds-soft mb-4">Tiempo mínimo entre alertas (segundos)</p>
        <input type="number" min="0" max="60" value={cooldown}
          onChange={e => onCooldownChange(parseInt(e.target.value) || 0)} className={inputClass} />
      </div>
    </div>
  );
};

export default TipsAlertSection;
