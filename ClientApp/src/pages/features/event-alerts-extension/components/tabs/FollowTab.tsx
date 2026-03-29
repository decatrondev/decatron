/**
 * Event Alerts Extension - Follow Tab Component
 *
 * Configuración de alertas para follows
 * Diseño idéntico al Timer Extensible
 */

import React from 'react';
import type { FollowAlertConfig, VariantsConfig } from '../../types/index';
import { MediaEditor } from '../../../timer-extension/components/MediaEditor';
import { TtsSection } from '../../components/TtsSection';
import { ChatMessageSection } from '../../components/ChatMessageSection';
import { VariantEditor } from '../../components/VariantEditor';
import type { AlertMediaConfig } from '../../../../../types/timer-alerts';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';

interface FollowTabProps {
  config: FollowAlertConfig;
  onConfigChange: (updates: Partial<FollowAlertConfig>) => void;
}

export const FollowTab: React.FC<FollowTabProps> = ({ config, onConfigChange }) => {
  return (
    <div className="space-y-6">
      {/* Sistema Activado/Desactivado */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
              ❤️ Alertas de Follow
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
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
            <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
            <span className="ml-3 text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
              {config.enabled ? 'Activado' : 'Desactivado'}
            </span>
          </label>
        </div>
      </div>

      {/* Mensaje de la Alerta */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
            💬 Mensaje de la Alerta
          </label>
          {!config.alert.message && (
            <button
              onClick={() => onConfigChange({ alert: { ...config.alert, message: MESSAGE_TEMPLATES.follow } })}
              className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 font-bold"
            >
              ✨ Usar predefinido
            </button>
          )}
        </div>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Variables: <code className="bg-[#f8fafc] dark:bg-[#262626] px-2 py-1 rounded text-blue-600">{EVENT_VARIABLES.follow}</code>
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
            className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono"
          />
        </div>

        {/* Sugerencia cuando está vacío */}
        {!config.alert.message && (
          <button
            onClick={() => onConfigChange({ alert: { ...config.alert, message: MESSAGE_TEMPLATES.follow } })}
            className="mt-2 w-full p-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-left group hover:border-blue-400 transition-all"
          >
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              <span className="font-bold text-blue-600 dark:text-blue-400">💡 Sugerido:</span>
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 font-mono mt-1">
              "{MESSAGE_TEMPLATES.follow}"
            </p>
          </button>
        )}

        {/* Preview cuando hay mensaje */}
        {config.alert.message && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs text-[#1e293b] dark:text-blue-300">
              <strong>📺 Se verá:</strong> {config.alert.message.replace('{username}', 'NombreEjemplo')}
            </p>
          </div>
        )}
      </div>

      {/* Duración y Volumen */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          ⏱️ Duración y Volumen
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
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
              value={config.alert.volume}
              onChange={(e) =>
                onConfigChange({
                  alert: {
                    ...config.alert,
                    volume: parseInt(e.target.value) || 50,
                  },
                })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Media (Audio / Video / Imagen) */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-2">
          🎬 Multimedia de Alerta
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Audio, video o imagen que se reproducirá con la alerta
        </p>
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
      </div>

      {/* TTS */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-2">
          🗣️ Text-to-Speech
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Reproduce un mensaje de voz cuando alguien haga follow
        </p>
        <TtsSection
          config={config.alert.tts}
          onChange={(updates) => onConfigChange({ alert: { ...config.alert, tts: { ...config.alert.tts, ...updates } } })}
          messageVariables={EVENT_VARIABLES.follow}
          hasUserMessage={false}
          suggestedTemplate={TTS_TEMPLATES.follow}
          eventType="follow"
        />
      </div>

      {/* Mensaje en Chat */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          💬 Mensaje del Bot en Chat
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          El bot enviará un mensaje en el chat cuando alguien haga follow
        </p>
        <ChatMessageSection
          config={config.alert.chatMessage}
          onChange={(chatMessage) => onConfigChange({ alert: { ...config.alert, chatMessage } })}
          messageVariables={EVENT_VARIABLES.follow}
          suggestedTemplate={CHAT_TEMPLATES.follow}
        />
      </div>

      {/* Variantes */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-2">
          🎲 Variantes de Alerta
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Configura múltiples variantes que se reproducen aleatoriamente
        </p>
        <VariantEditor
          config={config.alert.variants}
          onChange={(variants: VariantsConfig) => onConfigChange({ alert: { ...config.alert, variants } })}
          userTier="free"
          messageVariables={EVENT_VARIABLES.follow}
          hasUserMessage={false}
          eventType="follow"
        />
      </div>

      {/* Cooldown */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          ⏱️ Cooldown Global
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Tiempo mínimo entre cualquier alerta de follow (segundos)
        </p>

        <input
          type="number"
          min="0"
          max="300"
          value={config.cooldown}
          onChange={(e) => onConfigChange({ cooldown: parseInt(e.target.value) || 5 })}
          className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
        />

        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-xs text-[#1e293b] dark:text-yellow-300">
            💡 <strong>Recomendación:</strong> 5 segundos es ideal para evitar spam sin perder alertas
          </p>
        </div>
      </div>

      {/* Anti-Spam por Usuario */}
      <div className="rounded-2xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
              🛡️ Anti-Spam por Usuario
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
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
            <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-orange-600"></div>
            <span className="ml-3 text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
              {config.antiSpam?.enabled !== false ? 'Activado' : 'Desactivado'}
            </span>
          </label>
        </div>

        {config.antiSpam?.enabled !== false && (
          <div className="pt-4 border-t border-orange-200 dark:border-orange-800 space-y-4">
            <div>
              <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
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
                  className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onConfigChange({ antiSpam: { ...config.antiSpam, enabled: true, perUserCooldown: 3600 } })}
                    className="px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 rounded-lg text-xs font-bold hover:bg-orange-200"
                  >
                    1h
                  </button>
                  <button
                    onClick={() => onConfigChange({ antiSpam: { ...config.antiSpam, enabled: true, perUserCooldown: 86400 } })}
                    className="px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 rounded-lg text-xs font-bold hover:bg-orange-200"
                  >
                    24h
                  </button>
                  <button
                    onClick={() => onConfigChange({ antiSpam: { ...config.antiSpam, enabled: true, perUserCooldown: 604800 } })}
                    className="px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 rounded-lg text-xs font-bold hover:bg-orange-200"
                  >
                    7d
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
                = {Math.floor((config.antiSpam?.perUserCooldown ?? 86400) / 3600)} horas / {Math.floor((config.antiSpam?.perUserCooldown ?? 86400) / 86400)} días
              </p>
            </div>

            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg">
              <p className="text-xs text-orange-700 dark:text-orange-300">
                ⚠️ <strong>Importante:</strong> Un usuario que haga follow y luego unfollow solo disparará la alerta una vez durante este período, evitando abuso.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
