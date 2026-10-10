/**
 * Event Alerts Extension - Follow Tab Component
 *
 * Configuración de alertas para follows
 * Diseño idéntico al Timer Extensible
 */

import { AnimationEffectsSection } from '../AnimationEffectsSection';
import React from 'react';
import type { FollowAlertConfig, VariantsConfig } from '../../types/index';
import { MediaEditor } from '../../../timer-extension/components/MediaEditor';
import { TtsSection } from '../../components/TtsSection';
import { ChatMessageSection } from '../../components/ChatMessageSection';
import { VariantEditor } from '../../components/VariantEditor';
import type { AlertMediaConfig } from '../../../../../types/timer-alerts';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';
import { EventSection } from '../EventSection';

interface FollowTabProps {
  config: FollowAlertConfig;
  onConfigChange: (updates: Partial<FollowAlertConfig>) => void;
}

export const FollowTab: React.FC<FollowTabProps> = ({ config, onConfigChange }) => {
  return (
    <div className="space-y-6">
      {/* Sistema Activado/Desactivado */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
              ❤️ Alertas de Follow
            </label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
              Configura las alertas que aparecen cuando alguien te sigue
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

      {/* Mensaje de la Alerta */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
            💬 Mensaje de la Alerta
          </label>
          {!config.alert.message && (
            <button
              onClick={() => onConfigChange({ alert: { ...config.alert, message: MESSAGE_TEMPLATES.follow } })}
              className="text-xs px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg hover:bg-ds-accent/10 font-bold 3xl:text-sm"
            >
              ✨ Usar predefinido
            </button>
          )}
        </div>
        <p className="text-xs text-ds-soft mb-4 3xl:text-sm">
          Variables: <code className="bg-ds-bg px-2 py-1 rounded text-ds-accent-text">{EVENT_VARIABLES.follow}</code>
        </p>

        <div className="relative">
          <textarea
            value={config.alert.message}
            onChange={(e) =>
              onConfigChange({
                alert: {
                  ...config.alert,
                  message: e.target.value,
                },
              })
            }
            placeholder={MESSAGE_TEMPLATES.follow}
            rows={2}
            className="w-full px-4 py-3 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none resize-none font-mono"
          />
        </div>

        {/* Sugerencia cuando está vacío */}
        {!config.alert.message && (
          <button
            onClick={() => onConfigChange({ alert: { ...config.alert, message: MESSAGE_TEMPLATES.follow } })}
            className="mt-2 w-full p-2 bg-ds-accent/10 rounded-lg border border-ds-accent text-left group hover:border-ds-accent transition-all"
          >
            <p className="text-xs text-ds-soft 3xl:text-sm">
              <span className="font-bold text-ds-accent-text">💡 Sugerido:</span>
            </p>
            <p className="text-sm text-ds-accent-text font-mono mt-1 3xl:text-base">
              "{MESSAGE_TEMPLATES.follow}"
            </p>
          </button>
        )}

        {/* Preview cuando hay mensaje */}
        {config.alert.message && (
          <div className="mt-2 p-3 bg-ds-accent/10 border border-ds-accent rounded-lg">
            <p className="text-xs text-ds-text 3xl:text-sm">
              <strong>📺 Se verá:</strong> {config.alert.message.replace('{username}', 'NombreEjemplo')}
            </p>
          </div>
        )}
      </div>

      {/* Duración y Volumen */}
      <EventSection title="⏱️ Duración y Volumen" defaultOpen><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
              Duración (segundos)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={config.alert.duration}
              onChange={(e) =>
                onConfigChange({
                  alert: {
                    ...config.alert,
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
              value={config.alert.volume}
              onChange={(e) =>
                onConfigChange({
                  alert: {
                    ...config.alert,
                    volume: parseInt(e.target.value) || 50,
                  },
                })
              }
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
            />
          </div>
        </div>
      </EventSection>

      {/* Media (Audio / Video / Imagen) */}
      <EventSection title="🎬 Multimedia de Alerta" description="Audio, video o imagen que se reproducirá con la alerta">
        <MediaEditor
          config={config.alert.media as AlertMediaConfig}
          onChange={(media) =>
            onConfigChange({ alert: { ...config.alert, media } })
          }
          alertContext={{
            message: config.alert.message || `¡{username} ahora te sigue!`,
            duration: config.alert.duration,
            emoji: '❤️',
          }}
        />
      </EventSection>

      {/* Animación y efectos */}
      <EventSection title="✨ Animación y efectos" description="Cómo entra y sale la alerta, y los efectos sobre la tarjeta">
        <AnimationEffectsSection animation={config.alert.animation} effects={config.alert.effects}
          onChange={patch => onConfigChange({ alert: { ...config.alert, ...patch } })} />
      </EventSection>

      {/* TTS */}
      <EventSection title="🗣️ Text-to-Speech" description="Reproduce un mensaje de voz cuando alguien haga follow">
        <TtsSection
          config={config.alert.tts}
          onChange={(updates) => onConfigChange({ alert: { ...config.alert, tts: { ...config.alert.tts, ...updates } } })}
          messageVariables={EVENT_VARIABLES.follow}
          hasUserMessage={false}
          suggestedTemplate={TTS_TEMPLATES.follow}
          eventType="follow"
        />
      </EventSection>

      {/* Mensaje en Chat */}
      <EventSection title="💬 Mensaje del Bot en Chat" description="El bot enviará un mensaje en el chat cuando alguien haga follow">
        <ChatMessageSection
          config={config.alert.chatMessage}
          onChange={(chatMessage) => onConfigChange({ alert: { ...config.alert, chatMessage } })}
          messageVariables={EVENT_VARIABLES.follow}
          suggestedTemplate={CHAT_TEMPLATES.follow}
        />
      </EventSection>

      {/* Variantes */}
      <EventSection title="🎲 Variantes de Alerta" description="Configura múltiples variantes que se reproducen aleatoriamente">
        <VariantEditor
          config={config.alert.variants}
          onChange={(variants: VariantsConfig) => onConfigChange({ alert: { ...config.alert, variants } })}
          userTier="free"
          messageVariables={EVENT_VARIABLES.follow}
          hasUserMessage={false}
          eventType="follow"
        />
      </EventSection>

      {/* Cooldown */}
      <EventSection title="⏱️ Cooldown Global" description="Tiempo mínimo entre cualquier alerta de follow (segundos)">

        <input
          type="number"
          min="0"
          max="300"
          value={config.cooldown}
          onChange={(e) => onConfigChange({ cooldown: parseInt(e.target.value) || 5 })}
          className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
        />

        <div className="mt-3 p-3 bg-ds-warn/10 border border-ds-warn/40 rounded-lg">
          <p className="text-xs text-ds-text 3xl:text-sm">
            💡 <strong>Recomendación:</strong> 5 segundos es ideal para evitar spam sin perder alertas
          </p>
        </div>
      </EventSection>

      {/* Anti-Spam por Usuario */}
      <div className="rounded-lg border-2 border-ds-warn/40 bg-ds-warn/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
              🛡️ Anti-Spam por Usuario
            </label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
              Evita que el mismo usuario dispare múltiples alertas de follow
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.antiSpam?.enabled ?? true}
              onChange={(e) => onConfigChange({
                antiSpam: { ...config.antiSpam, enabled: e.target.checked, perUserCooldown: config.antiSpam?.perUserCooldown ?? 86400 }
              })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-warn/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
            <span className="ml-3 text-sm font-bold text-ds-text 3xl:text-base">
              {config.antiSpam?.enabled !== false ? 'Activado' : 'Desactivado'}
            </span>
          </label>
        </div>

        {config.antiSpam?.enabled !== false && (
          <div className="pt-4 border-t border-ds-warn/40 space-y-4">
            <div>
              <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
                Cooldown por usuario (segundos)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="604800"
                  value={config.antiSpam?.perUserCooldown ?? 86400}
                  onChange={(e) => onConfigChange({
                    antiSpam: { ...config.antiSpam, enabled: config.antiSpam?.enabled ?? true, perUserCooldown: parseInt(e.target.value) || 86400 }
                  })}
                  className="flex-1 px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-warn/40 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onConfigChange({ antiSpam: { ...config.antiSpam, enabled: true, perUserCooldown: 3600 } })}
                    className="px-3 py-2 bg-ds-warn/10 text-ds-warn rounded-lg text-xs font-bold hover:bg-ds-warn/10 3xl:text-sm"
                  >
                    1h
                  </button>
                  <button
                    onClick={() => onConfigChange({ antiSpam: { ...config.antiSpam, enabled: true, perUserCooldown: 86400 } })}
                    className="px-3 py-2 bg-ds-warn/10 text-ds-warn rounded-lg text-xs font-bold hover:bg-ds-warn/10 3xl:text-sm"
                  >
                    24h
                  </button>
                  <button
                    onClick={() => onConfigChange({ antiSpam: { ...config.antiSpam, enabled: true, perUserCooldown: 604800 } })}
                    className="px-3 py-2 bg-ds-warn/10 text-ds-warn rounded-lg text-xs font-bold hover:bg-ds-warn/10 3xl:text-sm"
                  >
                    7d
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-ds-soft 3xl:text-sm">
                = {Math.floor((config.antiSpam?.perUserCooldown ?? 86400) / 3600)} horas / {Math.floor((config.antiSpam?.perUserCooldown ?? 86400) / 86400)} días
              </p>
            </div>

            <div className="p-3 bg-ds-warn/10 border border-ds-warn/40 rounded-lg">
              <p className="text-xs text-ds-warn 3xl:text-sm">
                ⚠️ <strong>Importante:</strong> Un usuario que haga follow y luego unfollow solo disparará la alerta una vez durante este período, evitando abuso.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
