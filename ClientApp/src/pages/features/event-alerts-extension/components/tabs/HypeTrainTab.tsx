/**
 * Event Alerts Extension - HypeTrain Tab Component
 * Diseño idéntico al Timer Extensible
 */
import React, { useState } from 'react';
import type { HypeTrainAlertConfig, VariantsConfig } from '../../types/index';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';
import { ChatMessageSection } from '../../components/ChatMessageSection';
import { VariantEditor } from '../../components/VariantEditor';
import { EventSection } from '../EventSection';
import { AnimationEffectsSection } from '../AnimationEffectsSection';
import { TtsSection } from '../TtsSection';
import { MediaEditor } from '../../../timer-extension/components/MediaEditor';
import MediaInputWithSelector from '../../../../../components/timer/MediaInputWithSelector';
import type { AlertMediaConfig } from '../../../../../types/timer-alerts';

interface HypeTrainTabProps {
  config: HypeTrainAlertConfig;
  onConfigChange: (updates: Partial<HypeTrainAlertConfig>) => void;
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
  </label>
);

export const HypeTrainTab: React.FC<HypeTrainTabProps> = ({ config, onConfigChange }) => {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

  const inputClass = "w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none";
  const labelClass = "text-xs font-bold text-ds-soft block mb-2";

  const levelEmojis = ['🔥', '🔥🔥', '🔥🔥🔥', '🔥🔥🔥🔥', '🔥🔥🔥🔥🔥'];

  // Helper para obtener template de mensaje según nivel
  const getMessageTemplate = (level: number) => {
    const key = `level${level}` as keyof typeof MESSAGE_TEMPLATES.hypeTrain;
    return MESSAGE_TEMPLATES.hypeTrain[key] || '';
  };

  // Helper para obtener template de TTS según nivel
  const getTtsTemplate = (level: number) => {
    const key = `level${level}` as keyof typeof TTS_TEMPLATES.hypeTrain;
    return TTS_TEMPLATES.hypeTrain[key] || '';
  };

  // Helper para obtener template de chat según nivel
  const getChatTemplate = (level: number) => {
    const key = `level${level}` as keyof typeof CHAT_TEMPLATES.hypeTrain;
    return CHAT_TEMPLATES.hypeTrain[key] || '';
  };

  const updateLevel = (level: number, field: string, value: any) => {
    onConfigChange({
      levels: { ...config.levels, [level]: { ...config.levels[level], [field]: value } }
    });
  };

  const updateCompletion = (field: string, value: any) => {
    onConfigChange({ completionAlert: { ...config.completionAlert, [field]: value } });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-bold text-ds-text 3xl:text-base">🔥 Alertas de Hype Train</label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">Configura alertas para cada nivel del Hype Train</p>
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={config.enabled} onChange={v => onConfigChange({ enabled: v })} />
            <span className="text-sm font-bold text-ds-text 3xl:text-base">{config.enabled ? 'Activado' : 'Desactivado'}</span>
          </div>
        </div>
      </div>

      {/* Niveles 1-5 */}
      <EventSection title="🎯 Alertas por Nivel" defaultOpen><div className="space-y-3">
          {[1, 2, 3, 4, 5].map(level => {
            const levelConfig = config.levels[level];
            if (!levelConfig) return null;
            return (
              <div key={level} className="border border-ds-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-ds-bg cursor-pointer hover:bg-ds-raised transition-colors"
                  onClick={() => setExpandedLevel(expandedLevel === level ? null : level)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{levelEmojis[level - 1]}</span>
                    <div>
                      <div className="font-bold text-ds-text">Nivel {level}</div>
                      <div className="text-xs text-ds-soft 3xl:text-sm">{levelConfig.message.substring(0, 50)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={levelConfig.enabled} onChange={e => updateLevel(level, 'enabled', e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-accent"></div>
                    </label>
                    {expandedLevel === level ? <ChevronUp className="w-5 h-5 text-ds-soft" /> : <ChevronDown className="w-5 h-5 text-ds-soft" />}
                  </div>
                </div>

                {expandedLevel === level && (
                  <div className="p-4 space-y-4 border-t border-ds-border">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelClass + ' mb-0'}>Mensaje · <code className="text-ds-accent-text">{EVENT_VARIABLES.hypeTrain}</code></label>
                        {!levelConfig.message && getMessageTemplate(level) && (
                          <button
                            onClick={() => updateLevel(level, 'message', getMessageTemplate(level))}
                            className="text-xs px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg hover:bg-ds-accent/10 font-bold 3xl:text-sm"
                          >
                            ✨ Usar predefinido
                          </button>
                        )}
                      </div>
                      <input type="text" value={levelConfig.message} onChange={e => updateLevel(level, 'message', e.target.value)}
                        placeholder={getMessageTemplate(level)}
                        className={inputClass + " font-mono text-sm"} />
                      {!levelConfig.message && getMessageTemplate(level) && (
                        <button
                          onClick={() => updateLevel(level, 'message', getMessageTemplate(level))}
                          className="mt-2 w-full p-2 bg-ds-warn/10 rounded-lg border border-ds-warn/40 text-left group hover:border-ds-warn/40 transition-all"
                        >
                          <p className="text-xs text-ds-soft 3xl:text-sm">💡 <span className="font-bold text-ds-warn">Sugerido:</span></p>
                          <p className="text-sm text-ds-warn font-mono mt-1 3xl:text-base">"{getMessageTemplate(level)}"</p>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Duración (seg)</label>
                        <input type="number" min="1" max="30" value={levelConfig.duration} onChange={e => updateLevel(level, 'duration', parseInt(e.target.value) || 5)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Volumen</label>
                        <input type="number" min="0" max="100" value={levelConfig.volume} onChange={e => updateLevel(level, 'volume', parseInt(e.target.value) || 50)} className={inputClass} />
                      </div>
                    </div>
                    <MediaInputWithSelector label="Sonido" value={levelConfig.sound} onChange={v => updateLevel(level, 'sound', v)} placeholder="https://ejemplo.com/sonido.mp3" allowedTypes={['audio']} />
                    <div>
                      <label className={labelClass}>Mensaje del Bot en Chat</label>
                      <ChatMessageSection
                        config={levelConfig.chatMessage}
                        onChange={(chatMessage) => updateLevel(level, 'chatMessage', chatMessage)}
                        messageVariables={EVENT_VARIABLES.hypeTrain}
                        suggestedTemplate={getChatTemplate(level)}
                      />
                    </div>

                    {/* Multimedia, voz, animación y efectos (el backend ya los usaba; faltaban en la vista) */}
                    <div>
                      <label className={labelClass}>Multimedia (audio, video o imagen)</label>
                      <MediaEditor config={levelConfig.media as AlertMediaConfig} onChange={media => updateLevel(level, 'media', media)}
                        alertContext={{ message: levelConfig.message, duration: levelConfig.duration, emoji: '🔥' }} />
                    </div>
                    <div>
                      <label className={labelClass}>Text-to-Speech</label>
                      <TtsSection config={levelConfig.tts} onChange={updates => updateLevel(level, 'tts', { ...levelConfig.tts, ...updates })}
                        messageVariables={EVENT_VARIABLES.hypeTrain} hasUserMessage={false} suggestedTemplate={getTtsTemplate(level)} eventType="hypeTrain" />
                    </div>
                    <div>
                      <label className={labelClass}>Animación y efectos</label>
                      <AnimationEffectsSection animation={levelConfig.animation} effects={levelConfig.effects}
                        onChange={patch => { onConfigChange({ levels: { ...config.levels, [level]: { ...config.levels[level], ...patch } } }); }} />
                    </div>

                    {/* Variantes */}
                    <VariantEditor
                      config={levelConfig.variants}
                      onChange={(variants: VariantsConfig) => updateLevel(level, 'variants', variants)}
                      userTier="free"
                      messageVariables={EVENT_VARIABLES.hypeTrain}
                      hasUserMessage={false}
                      eventType="hypeTrain"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </EventSection>

      {/* Alerta de Completado */}
      <div className="rounded-lg border-2 border-ds-warn/40 bg-ds-warn/10 p-6">
        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setShowCompletion(!showCompletion)}>
          <div>
            <label className="text-sm font-bold text-ds-text 3xl:text-base">🏆 Alerta de Hype Train Completado</label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">Alerta especial cuando se completa el Hype Train</p>
          </div>
          {showCompletion ? <ChevronUp className="w-5 h-5 text-ds-soft" /> : <ChevronDown className="w-5 h-5 text-ds-soft" />}
        </div>

        {showCompletion && (
          <div className="space-y-4 pt-4 border-t border-ds-warn/40">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + ' mb-0'}>Mensaje</label>
                {!config.completionAlert.message && (
                  <button
                    onClick={() => updateCompletion('message', MESSAGE_TEMPLATES.hypeTrain.completed)}
                    className="text-xs px-2 py-1 bg-ds-warn/10 text-ds-warn rounded-lg hover:bg-ds-warn/10 font-bold 3xl:text-sm"
                  >
                    ✨ Usar predefinido
                  </button>
                )}
              </div>
              <input type="text" value={config.completionAlert.message} onChange={e => updateCompletion('message', e.target.value)}
                placeholder={MESSAGE_TEMPLATES.hypeTrain.completed}
                className={inputClass + " font-mono text-sm"} />
              {!config.completionAlert.message && (
                <button
                  onClick={() => updateCompletion('message', MESSAGE_TEMPLATES.hypeTrain.completed)}
                  className="mt-2 w-full p-2 bg-ds-warn/10 rounded-lg border border-ds-warn/40 text-left group hover:border-ds-warn/40 transition-all"
                >
                  <p className="text-xs text-ds-soft 3xl:text-sm">💡 <span className="font-bold text-ds-warn">Sugerido:</span></p>
                  <p className="text-sm text-ds-warn font-mono mt-1 3xl:text-base">"{MESSAGE_TEMPLATES.hypeTrain.completed}"</p>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Duración (seg)</label>
                <input type="number" min="1" max="30" value={config.completionAlert.duration} onChange={e => updateCompletion('duration', parseInt(e.target.value) || 10)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Volumen</label>
                <input type="number" min="0" max="100" value={config.completionAlert.volume} onChange={e => updateCompletion('volume', parseInt(e.target.value) || 80)} className={inputClass} />
              </div>
            </div>
            <MediaInputWithSelector label="Sonido" value={config.completionAlert.sound} onChange={v => updateCompletion('sound', v)} placeholder="https://ejemplo.com/epico.mp3" allowedTypes={['audio']} />
            <div>
              <label className={labelClass}>Mensaje del Bot en Chat</label>
              <ChatMessageSection
                config={config.completionAlert.chatMessage}
                onChange={(chatMessage) => updateCompletion('chatMessage', chatMessage)}
                messageVariables={EVENT_VARIABLES.hypeTrain}
                suggestedTemplate={CHAT_TEMPLATES.hypeTrain.completed}
              />
            </div>

            {/* Multimedia, voz, animación y efectos */}
            <div>
              <label className={labelClass}>Multimedia (audio, video o imagen)</label>
              <MediaEditor config={config.completionAlert.media as AlertMediaConfig} onChange={media => updateCompletion('media', media)}
                alertContext={{ message: config.completionAlert.message, duration: config.completionAlert.duration, emoji: '🏆' }} />
            </div>
            <div>
              <label className={labelClass}>Text-to-Speech</label>
              <TtsSection config={config.completionAlert.tts} onChange={updates => updateCompletion('tts', { ...config.completionAlert.tts, ...updates })}
                messageVariables={EVENT_VARIABLES.hypeTrain} hasUserMessage={false} suggestedTemplate={TTS_TEMPLATES.hypeTrain.completed ?? ''} eventType="hypeTrain" />
            </div>
            <div>
              <label className={labelClass}>Animación y efectos</label>
              <AnimationEffectsSection animation={config.completionAlert.animation} effects={config.completionAlert.effects}
                onChange={patch => onConfigChange({ completionAlert: { ...config.completionAlert, ...patch } })} />
            </div>

            {/* Variantes */}
            <VariantEditor
              config={config.completionAlert.variants}
              onChange={(variants: VariantsConfig) => updateCompletion('variants', variants)}
              userTier="free"
              messageVariables={EVENT_VARIABLES.hypeTrain}
              hasUserMessage={false}
              eventType="hypeTrain"
            />
          </div>
        )}
      </div>

      {/* Cooldown */}
      <EventSection title="⏱️ Cooldown" description="Tiempo mínimo entre alertas de Hype Train (segundos)">
        <input type="number" min="0" max="120" value={config.cooldown} onChange={e => onConfigChange({ cooldown: parseInt(e.target.value) || 10 })} className={inputClass} />
      </EventSection>
    </div>
  );
};
