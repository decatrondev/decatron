/**
 * VariantEditor - Editor de variantes para alertas
 * Permite configurar múltiples variantes de una alerta (video, sonido, mensaje, etc.)
 */

import { AnimationEffectsSection } from './AnimationEffectsSection';
import { DEFAULT_PREMIUM_VOICE } from '../../../../components/tts/voiceDefaults';
import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Shuffle, ListOrdered, Percent, RefreshCw } from 'lucide-react';
import type { VariantsConfig, AlertVariant, VariantSelectionMode, TtsConfig, AnimationConfig, EffectsConfig, ChatMessageConfig } from '../types/index';
import { VARIANT_LIMITS } from '../types/index';
import { MediaEditor } from '../../timer-extension/components/MediaEditor';
import { TtsSection } from './TtsSection';
import { ChatMessageSection } from './ChatMessageSection';
import type { AlertMediaConfig } from '../../../../types/timer-alerts';
import { useGlobalDefaults, type GlobalAlertDefaults } from '../globalDefaults';

interface VariantEditorProps {
  config?: VariantsConfig;
  onChange: (config: VariantsConfig) => void;
  userTier: 'free' | 'supporter' | 'premium';
  messageVariables: string;
  hasUserMessage?: boolean;
  eventType?: string;
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-accent"></div>
  </label>
);

const defaultVariantsConfig: VariantsConfig = {
  enabled: false,
  mode: 'random',
  resetAfter: 'all',
  resetTimeMinutes: 60,
  variants: [],
};

const createDefaultVariant = (index: number, defaults: GlobalAlertDefaults): AlertVariant => ({
  id: `variant-${Date.now()}-${index}`,
  name: `Variante ${index + 1}`,
  weight: 100,
  media: { enabled: false, mode: 'simple' as const },
  sound: '',
  volume: defaults.volume,
  message: '',
  duration: defaults.duration,
  animation: {
    type: defaults.animation,
    direction: defaults.direction,
    duration: 500,
    easing: 'ease-in-out',
  },
  effects: { enabled: false, effects: [] },
  tts: {
    enabled: false,
    voice: DEFAULT_PREMIUM_VOICE,
    engine: 'standard' as const,
    languageCode: 'es-US',
    templateVolume: 80,
    template: '',
    readUserMessage: false,
    userMessageVolume: 80,
    maxChars: 150,
    waitForSound: true,
  },
  chatMessage: { enabled: false, template: '' },
  playVideoAudio: false,
  videoVolume: 80,
});

export const VariantEditor: React.FC<VariantEditorProps> = ({
  config,
  onChange,
  userTier,
  messageVariables,
  hasUserMessage = false,
  eventType = '',
}) => {
  const globalDefaults = useGlobalDefaults();
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);

  const currentConfig = config || defaultVariantsConfig;
  const maxVariants = VARIANT_LIMITS[userTier];
  const variantCount = currentConfig.variants.length;
  const canAddMore = variantCount < maxVariants;

  const inputClass = "w-full px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm";
  const labelClass = "text-xs font-bold text-ds-soft block mb-1";

  const updateConfig = (updates: Partial<VariantsConfig>) => {
    onChange({ ...currentConfig, ...updates });
  };

  const addVariant = () => {
    if (!canAddMore) return;
    const newVariant = createDefaultVariant(variantCount, globalDefaults);
    updateConfig({ variants: [...currentConfig.variants, newVariant] });
    setExpandedVariant(newVariant.id);
  };

  const updateVariant = (id: string, updates: Partial<AlertVariant>) => {
    updateConfig({
      variants: currentConfig.variants.map(v => v.id === id ? { ...v, ...updates } : v),
    });
  };

  const deleteVariant = (id: string) => {
    if (confirm('¿Eliminar esta variante?')) {
      updateConfig({ variants: currentConfig.variants.filter(v => v.id !== id) });
    }
  };

  const getModeIcon = (mode: VariantSelectionMode) => {
    switch (mode) {
      case 'random': return <Shuffle className="w-4 h-4" />;
      case 'weighted': return <Percent className="w-4 h-4" />;
      case 'sequential': return <ListOrdered className="w-4 h-4" />;
      case 'noRepeat': return <RefreshCw className="w-4 h-4" />;
    }
  };

  const getModeLabel = (mode: VariantSelectionMode) => {
    switch (mode) {
      case 'random': return 'Aleatorio';
      case 'weighted': return 'Por peso';
      case 'sequential': return 'Secuencial';
      case 'noRepeat': return 'Sin repetir';
    }
  };

  return (
    <div className="mt-4 p-4 bg-ds-accent/10 rounded-lg border border-ds-accent">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎲</span>
          <div>
            <label className="text-sm font-bold text-ds-text 3xl:text-base">
              Variantes de Alerta
            </label>
            <p className="text-xs text-ds-soft 3xl:text-sm">
              Múltiples opciones que se seleccionan automáticamente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ds-accent-text font-bold 3xl:text-sm">
            {variantCount}/{maxVariants}
          </span>
          <Toggle
            checked={currentConfig.enabled}
            onChange={v => updateConfig({ enabled: v })}
          />
        </div>
      </div>

      {currentConfig.enabled && (
        <div className="space-y-4">
          {/* Modo de selección */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Modo de selección</label>
              <select
                value={currentConfig.mode}
                onChange={e => updateConfig({ mode: e.target.value as VariantSelectionMode })}
                className={inputClass}
              >
                <option value="random">🎲 Aleatorio (igual probabilidad)</option>
                <option value="weighted">⚖️ Por peso (probabilidad personalizada)</option>
                <option value="sequential">📋 Secuencial (en orden)</option>
                <option value="noRepeat">🔄 Sin repetir (usa todas antes de repetir)</option>
              </select>
            </div>

            {currentConfig.mode === 'noRepeat' && (
              <div>
                <label className={labelClass}>Resetear después de</label>
                <div className="flex gap-2">
                  <select
                    value={currentConfig.resetAfter}
                    onChange={e => updateConfig({ resetAfter: e.target.value as 'all' | 'time' })}
                    className={inputClass}
                  >
                    <option value="all">Usar todas</option>
                    <option value="time">Por tiempo</option>
                  </select>
                  {currentConfig.resetAfter === 'time' && (
                    <input
                      type="number"
                      min="1"
                      value={currentConfig.resetTimeMinutes}
                      onChange={e => updateConfig({ resetTimeMinutes: parseInt(e.target.value) || 60 })}
                      className={inputClass + " w-24"}
                      placeholder="min"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lista de variantes */}
          <div className="space-y-2">
            {currentConfig.variants.map((variant, index) => (
              <div
                key={variant.id}
                className="border border-ds-accent rounded-lg overflow-hidden bg-ds-surface"
              >
                {/* Header de variante */}
                <div
                  className="flex items-center justify-between p-3 bg-ds-accent/10 cursor-pointer hover:bg-ds-accent/10 transition-colors"
                  onClick={() => setExpandedVariant(expandedVariant === variant.id ? null : variant.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-ds-accent text-ds-on-accent text-xs font-bold flex items-center justify-center 3xl:text-sm">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-bold text-sm text-ds-text 3xl:text-base">
                        {variant.name}
                      </span>
                      {currentConfig.mode === 'weighted' && (
                        <span className="ml-2 text-xs text-ds-accent-text 3xl:text-sm">
                          ({variant.weight}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); deleteVariant(variant.id); }}
                      className="p-1.5 hover:bg-ds-danger/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-ds-danger" />
                    </button>
                    {expandedVariant === variant.id
                      ? <ChevronUp className="w-4 h-4 text-ds-soft" />
                      : <ChevronDown className="w-4 h-4 text-ds-soft" />
                    }
                  </div>
                </div>

                {/* Contenido expandido */}
                {expandedVariant === variant.id && (
                  <div className="p-4 space-y-4 border-t border-ds-accent">
                    {/* Nombre y peso */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nombre</label>
                        <input
                          type="text"
                          value={variant.name}
                          onChange={e => updateVariant(variant.id, { name: e.target.value })}
                          className={inputClass}
                          placeholder="Ej: Explosión, Confeti..."
                        />
                      </div>
                      {currentConfig.mode === 'weighted' && (
                        <div>
                          <label className={labelClass}>Peso (probabilidad %)</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={variant.weight}
                            onChange={e => updateVariant(variant.id, { weight: parseInt(e.target.value) || 1 })}
                            className={inputClass}
                          />
                        </div>
                      )}
                    </div>

                    {/* Mensaje */}
                    <div>
                      <label className={labelClass}>
                        Mensaje · <code className="text-ds-accent-text">{messageVariables}</code>
                      </label>
                      <input
                        type="text"
                        value={variant.message}
                        onChange={e => updateVariant(variant.id, { message: e.target.value })}
                        className={inputClass + " font-mono"}
                        placeholder="¡{username} gracias!"
                      />
                    </div>

                    {/* Duración y Volumen */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Duración (seg)</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={variant.duration}
                          onChange={e => updateVariant(variant.id, { duration: parseInt(e.target.value) || 5 })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Volumen (0-100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={variant.volume}
                          onChange={e => updateVariant(variant.id, { volume: parseInt(e.target.value) || 80 })}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Media */}
                    <div>
                      <label className={labelClass}>Multimedia (Audio / Video / Imagen)</label>
                      <MediaEditor
                        config={variant.media as AlertMediaConfig}
                        onChange={(media) => updateVariant(variant.id, { media })}
                      />
                    </div>

                    {/* Animación y efectos */}
                    <div>
                      <label className={labelClass}>Animación y efectos</label>
                      <AnimationEffectsSection animation={variant.animation} effects={variant.effects} onChange={patch => updateVariant(variant.id, patch)} />
                    </div>

                    {/* TTS */}
                    <div>
                      <label className={labelClass}>Text-to-Speech</label>
                      <TtsSection
                        config={variant.tts}
                        onChange={(updates) => updateVariant(variant.id, { tts: { ...variant.tts, ...updates } })}
                        messageVariables={messageVariables}
                        hasUserMessage={hasUserMessage}
                        eventType={eventType}
                      />
                    </div>

                    {/* Chat Message */}
                    <div>
                      <label className={labelClass}>Mensaje del Bot en Chat</label>
                      <ChatMessageSection
                        config={variant.chatMessage}
                        onChange={(chatMessage) => updateVariant(variant.id, { chatMessage })}
                        messageVariables={messageVariables}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Botón agregar */}
          {canAddMore ? (
            <button
              onClick={addVariant}
              className="w-full py-3 border-2 border-dashed border-ds-accent rounded-lg text-ds-accent-text font-bold text-sm hover:bg-ds-accent/10 transition-colors flex items-center justify-center gap-2 3xl:text-base"
            >
              <Plus className="w-4 h-4" />
              Agregar Variante ({variantCount}/{maxVariants})
            </button>
          ) : (
            <div className="w-full py-3 bg-ds-warn/10 border border-ds-warn/40 rounded-lg text-center">
              <p className="text-sm text-ds-warn font-bold 3xl:text-base">
                Has alcanzado el límite de {maxVariants} variantes
              </p>
              {userTier === 'free' && (
                <p className="text-xs text-ds-warn mt-1 3xl:text-sm">
                  Actualiza a Supporter para más variantes
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VariantEditor;
