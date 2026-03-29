/**
 * AlertTierSection - Componente reutilizable para sistema de tiers con alerta base
 * Usado por GiftSubsTab, RaidsTab, ResubsTab
 */

import React, { useState } from 'react';
import type { AlertTier, TtsConfig, VariantsConfig } from '../types/index';
import { MediaEditor } from '../../timer-extension/components/MediaEditor';
import { TtsSection } from './TtsSection';
import { ChatMessageSection } from './ChatMessageSection';
import { VariantEditor } from './VariantEditor';
import type { AlertMediaConfig } from '../../../../types/timer-alerts';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface TierTemplates {
  base: string;
  tier1: string;
  tier2: string;
  tier3: string;
}

interface AlertTierSectionProps {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  baseAlert: any;
  onBaseAlertChange: (updates: any) => void;
  tiers: AlertTier[];
  onTiersChange: (tiers: AlertTier[]) => void;
  cooldown: number;
  onCooldownChange: (value: number) => void;
  eventTitle: string;
  eventEmoji: string;
  eventDescription: string;
  messageVariables: string;
  tierUnitLabel: string;
  ttsVariables?: string;
  hasUserMessage?: boolean;
  eventType?: string;
  messageTemplates?: TierTemplates;
  ttsTemplates?: TierTemplates;
  chatTemplates?: TierTemplates;
  userTier?: 'free' | 'supporter' | 'premium';
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
  </label>
);

export const AlertTierSection: React.FC<AlertTierSectionProps> = ({
  enabled, onEnabledChange,
  baseAlert, onBaseAlertChange,
  tiers, onTiersChange,
  cooldown, onCooldownChange,
  eventTitle, eventEmoji, eventDescription,
  messageVariables, tierUnitLabel,
  ttsVariables, hasUserMessage = false,
  eventType = '',
  messageTemplates,
  ttsTemplates,
  chatTemplates,
  userTier = 'free',
}) => {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  // Helpers para obtener templates según índice
  const getMessageTemplate = (index: number) => {
    if (!messageTemplates) return '';
    return index === 0 ? messageTemplates.tier1 : index === 1 ? messageTemplates.tier2 : messageTemplates.tier3;
  };

  const getTtsTemplate = (index: number) => {
    if (!ttsTemplates) return '';
    return index === 0 ? ttsTemplates.tier1 : index === 1 ? ttsTemplates.tier2 : ttsTemplates.tier3;
  };

  const getChatTemplate = (index: number) => {
    if (!chatTemplates) return '';
    return index === 0 ? chatTemplates.tier1 : index === 1 ? chatTemplates.tier2 : chatTemplates.tier3;
  };

  const inputClass = "w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none";
  const labelClass = "text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2";

  const addTier = () => {
    const tierIndex = tiers.length;
    const tierName = tierIndex === 0 ? 'Básico' : tierIndex === 1 ? 'Medio' : tierIndex === 2 ? 'Épico' : `Tier ${tierIndex + 1}`;

    const newTier: AlertTier = {
      id: `tier-${Date.now()}`,
      name: tierName,
      enabled: true,
      condition: {
        type: tierIndex === 2 ? 'minimum' : 'range',
        min: tierIndex === 0 ? 1 : tierIndex === 1 ? 5 : 10,
        max: tierIndex === 0 ? 4 : tierIndex === 1 ? 9 : 999
      },
      message: getMessageTemplate(tierIndex) || '¡{username}!',
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
        voice: 'Lupe',
        engine: 'standard' as const,
        languageCode: 'es-US',
        templateVolume: 80,
        template: getTtsTemplate(tierIndex) || '',
        readUserMessage: hasUserMessage,
        userMessageVolume: 80,
        maxChars: 150,
        waitForSound: true,
      },
    };
    onTiersChange([...tiers, newTier]);
  };

  const updateTier = (id: string, updates: Partial<AlertTier>) => {
    onTiersChange(tiers.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTier = (id: string) => {
    if (confirm('¿Eliminar este tier?')) onTiersChange(tiers.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header Toggle */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{eventEmoji} {eventTitle}</label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{eventDescription}</p>
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={enabled} onChange={onEnabledChange} />
            <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{enabled ? 'Activado' : 'Desactivado'}</span>
          </div>
        </div>
      </div>

      {/* Alerta Base */}
      <div className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">🔔 Alerta BASE (suena SIEMPRE)</label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Se reproduce siempre. Los tiers pueden sobrescribirla.</p>
          </div>
          <Toggle checked={baseAlert.enabled} onChange={v => onBaseAlertChange({ enabled: v })} />
        </div>

        <div className="space-y-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + ' mb-0'}>Mensaje · <code className="text-blue-500">{messageVariables}</code></label>
              {!baseAlert.message && messageTemplates?.base && (
                <button
                  onClick={() => onBaseAlertChange({ message: messageTemplates.base })}
                  className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 font-bold"
                >
                  ✨ Usar predefinido
                </button>
              )}
            </div>
            <input type="text" value={baseAlert.message} onChange={e => onBaseAlertChange({ message: e.target.value })}
              placeholder={messageTemplates?.base || ''}
              className={inputClass + " font-mono text-sm"} />
            {!baseAlert.message && messageTemplates?.base && (
              <button
                onClick={() => onBaseAlertChange({ message: messageTemplates.base })}
                className="mt-2 w-full p-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-left group hover:border-blue-400 transition-all"
              >
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">💡 <span className="font-bold text-blue-600 dark:text-blue-400">Sugerido:</span></p>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-mono mt-1">"{messageTemplates.base}"</p>
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
              onChange={(media) => onBaseAlertChange({ media })}
            />
          </div>
          <div>
            <label className={labelClass}>Text-to-Speech</label>
            <TtsSection
              config={baseAlert.tts as TtsConfig}
              onChange={(updates) => onBaseAlertChange({ tts: { ...baseAlert.tts, ...updates } })}
              messageVariables={ttsVariables ?? messageVariables}
              hasUserMessage={hasUserMessage}
              suggestedTemplate={ttsTemplates?.base}
              eventType={eventType}
            />
          </div>
          <div>
            <label className={labelClass}>Mensaje del Bot en Chat</label>
            <ChatMessageSection
              config={baseAlert.chatMessage}
              onChange={(chatMessage) => onBaseAlertChange({ chatMessage })}
              messageVariables={messageVariables}
              suggestedTemplate={chatTemplates?.base}
            />
          </div>

          {/* Sistema de Variantes */}
          <VariantEditor
            config={baseAlert.variants}
            onChange={(variants) => onBaseAlertChange({ variants })}
            userTier={userTier}
            messageVariables={messageVariables}
            hasUserMessage={hasUserMessage}
            eventType={eventType}
          />
        </div>
      </div>

      {/* Tiers */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">🎯 Tiers Específicos</label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Alertas diferentes según {tierUnitLabel}</p>
          </div>
          <button onClick={addTier}
            className="px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white rounded-lg font-bold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Agregar Tier
          </button>
        </div>

        {tiers.length === 0 ? (
          <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">
            No hay tiers configurados. Agrega uno para empezar.
          </div>
        ) : (
          <div className="space-y-3">
            {tiers.map((tier, index) => (
              <div key={tier.id} className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                  onClick={() => setExpandedTier(expandedTier === tier.id ? null : tier.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{index === 0 ? '🥉' : index === 1 ? '🥈' : index === 2 ? '🥇' : '💎'}</span>
                    <div>
                      <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{tier.name}</div>
                      <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        {tier.condition.type === 'range' && `${tier.condition.min} - ${tier.condition.max} ${tierUnitLabel}`}
                        {tier.condition.type === 'minimum' && `${tier.condition.min}+ ${tierUnitLabel}`}
                        {tier.condition.type === 'exact' && `Exactamente ${tier.condition.exact} ${tierUnitLabel}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); deleteTier(tier.id); }}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                    {expandedTier === tier.id ? <ChevronUp className="w-5 h-5 text-[#64748b]" /> : <ChevronDown className="w-5 h-5 text-[#64748b]" />}
                  </div>
                </div>

                {expandedTier === tier.id && (
                  <div className="p-4 space-y-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nombre del Tier</label>
                        <input type="text" value={tier.name} onChange={e => updateTier(tier.id, { name: e.target.value })} className={inputClass} />
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                        <Toggle checked={tier.enabled} onChange={v => updateTier(tier.id, { enabled: v })} />
                        <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">{tier.enabled ? 'Activo' : 'Inactivo'}</span>
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Condición</label>
                      <div className="grid grid-cols-3 gap-3">
                        <select value={tier.condition.type}
                          onChange={e => updateTier(tier.id, { condition: { ...tier.condition, type: e.target.value as any } })}
                          className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                          <option value="range">Rango</option>
                          <option value="minimum">Mínimo</option>
                          <option value="exact">Exacto</option>
                        </select>
                        {tier.condition.type === 'range' && (<>
                          <input type="number" min="0" value={tier.condition.min ?? 0}
                            onChange={e => updateTier(tier.id, { condition: { ...tier.condition, min: parseInt(e.target.value) || 0 } })}
                            placeholder="Mínimo" className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                          <input type="number" min="0" value={tier.condition.max ?? 100}
                            onChange={e => updateTier(tier.id, { condition: { ...tier.condition, max: parseInt(e.target.value) || 100 } })}
                            placeholder="Máximo" className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                        </>)}
                        {tier.condition.type === 'minimum' && (
                          <input type="number" min="0" value={tier.condition.min ?? 0}
                            onChange={e => updateTier(tier.id, { condition: { ...tier.condition, min: parseInt(e.target.value) || 0 } })}
                            placeholder="Cantidad mínima" className="col-span-2 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                        )}
                        {tier.condition.type === 'exact' && (
                          <input type="number" min="0" value={tier.condition.exact ?? 0}
                            onChange={e => updateTier(tier.id, { condition: { ...tier.condition, exact: parseInt(e.target.value) || 0 } })}
                            placeholder="Cantidad exacta" className="col-span-2 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelClass + ' mb-0'}>Mensaje · <code className="text-blue-500">{messageVariables}</code></label>
                        {!tier.message && getMessageTemplate(index) && (
                          <button
                            onClick={() => updateTier(tier.id, { message: getMessageTemplate(index) })}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 font-bold"
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
                        messageVariables={ttsVariables ?? messageVariables}
                        hasUserMessage={hasUserMessage}
                        suggestedTemplate={getTtsTemplate(index)}
                        eventType={eventType}
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
                      hasUserMessage={hasUserMessage}
                      eventType={eventType}
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
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-2">⏱️ Cooldown</label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">Tiempo mínimo entre alertas (segundos)</p>
        <input type="number" min="0" max="60" value={cooldown}
          onChange={e => onCooldownChange(parseInt(e.target.value) || 5)} className={inputClass} />
      </div>
    </div>
  );
};
