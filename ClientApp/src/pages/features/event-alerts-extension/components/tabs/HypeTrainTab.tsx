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

interface HypeTrainTabProps {
  config: HypeTrainAlertConfig;
  onConfigChange: (updates: Partial<HypeTrainAlertConfig>) => void;
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
  </label>
);

export const HypeTrainTab: React.FC<HypeTrainTabProps> = ({ config, onConfigChange }) => {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

  const inputClass = "w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none";
  const labelClass = "text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2";

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
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">🔥 Alertas de Hype Train</label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Configura alertas para cada nivel del Hype Train</p>
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={config.enabled} onChange={v => onConfigChange({ enabled: v })} />
            <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{config.enabled ? 'Activado' : 'Desactivado'}</span>
          </div>
        </div>
      </div>

      {/* Niveles 1-5 */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 block">🎯 Alertas por Nivel</label>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(level => {
            const levelConfig = config.levels[level];
            if (!levelConfig) return null;
            return (
              <div key={level} className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                  onClick={() => setExpandedLevel(expandedLevel === level ? null : level)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{levelEmojis[level - 1]}</span>
                    <div>
                      <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Nivel {level}</div>
                      <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{levelConfig.message.substring(0, 50)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={levelConfig.enabled} onChange={e => updateLevel(level, 'enabled', e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
                    </label>
                    {expandedLevel === level ? <ChevronUp className="w-5 h-5 text-[#64748b]" /> : <ChevronDown className="w-5 h-5 text-[#64748b]" />}
                  </div>
                </div>

                {expandedLevel === level && (
                  <div className="p-4 space-y-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={labelClass + ' mb-0'}>Mensaje · <code className="text-blue-500">{EVENT_VARIABLES.hypeTrain}</code></label>
                        {!levelConfig.message && getMessageTemplate(level) && (
                          <button
                            onClick={() => updateLevel(level, 'message', getMessageTemplate(level))}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 font-bold"
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
                          className="mt-2 w-full p-2 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200 dark:border-orange-800 text-left group hover:border-orange-400 transition-all"
                        >
                          <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">💡 <span className="font-bold text-orange-600 dark:text-orange-400">Sugerido:</span></p>
                          <p className="text-sm text-orange-700 dark:text-orange-300 font-mono mt-1">"{getMessageTemplate(level)}"</p>
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
                    <div>
                      <label className={labelClass}>Sonido</label>
                      <div className="flex gap-2">
                        <input type="text" value={levelConfig.sound} onChange={e => updateLevel(level, 'sound', e.target.value)} placeholder="https://ejemplo.com/sonido.mp3" className={inputClass + " font-mono text-sm"} />
                        <button className="px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white rounded-lg font-bold text-sm">📁</button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Mensaje del Bot en Chat</label>
                      <ChatMessageSection
                        config={levelConfig.chatMessage}
                        onChange={(chatMessage) => updateLevel(level, 'chatMessage', chatMessage)}
                        messageVariables={EVENT_VARIABLES.hypeTrain}
                        suggestedTemplate={getChatTemplate(level)}
                      />
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
      </div>

      {/* Alerta de Completado */}
      <div className="rounded-2xl border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setShowCompletion(!showCompletion)}>
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">🏆 Alerta de Hype Train Completado</label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Alerta especial cuando se completa el Hype Train</p>
          </div>
          {showCompletion ? <ChevronUp className="w-5 h-5 text-[#64748b]" /> : <ChevronDown className="w-5 h-5 text-[#64748b]" />}
        </div>

        {showCompletion && (
          <div className="space-y-4 pt-4 border-t border-yellow-200 dark:border-yellow-800">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + ' mb-0'}>Mensaje</label>
                {!config.completionAlert.message && (
                  <button
                    onClick={() => updateCompletion('message', MESSAGE_TEMPLATES.hypeTrain.completed)}
                    className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 font-bold"
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
                  className="mt-2 w-full p-2 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 text-left group hover:border-yellow-400 transition-all"
                >
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">💡 <span className="font-bold text-yellow-600 dark:text-yellow-400">Sugerido:</span></p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 font-mono mt-1">"{MESSAGE_TEMPLATES.hypeTrain.completed}"</p>
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
            <div>
              <label className={labelClass}>Sonido</label>
              <div className="flex gap-2">
                <input type="text" value={config.completionAlert.sound} onChange={e => updateCompletion('sound', e.target.value)} placeholder="https://ejemplo.com/epico.mp3" className={inputClass + " font-mono text-sm"} />
                <button className="px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white rounded-lg font-bold text-sm">📁</button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Mensaje del Bot en Chat</label>
              <ChatMessageSection
                config={config.completionAlert.chatMessage}
                onChange={(chatMessage) => updateCompletion('chatMessage', chatMessage)}
                messageVariables={EVENT_VARIABLES.hypeTrain}
                suggestedTemplate={CHAT_TEMPLATES.hypeTrain.completed}
              />
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
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">⏱️ Cooldown</label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">Tiempo mínimo entre alertas de Hype Train (segundos)</p>
        <input type="number" min="0" max="120" value={config.cooldown} onChange={e => onConfigChange({ cooldown: parseInt(e.target.value) || 10 })} className={inputClass} />
      </div>
    </div>
  );
};
