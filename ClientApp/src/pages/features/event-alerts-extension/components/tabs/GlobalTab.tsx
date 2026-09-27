/**
 * Event Alerts Extension - Global Tab Component
 *
 * Configuración global que afecta a todas las alertas de eventos
 * Diseño idéntico al Timer Extensible
 */

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { GlobalAlertsConfig, AnimationType, AnimationDirection } from '../../types/index';
import { TtsSection } from '../TtsSection';
import { EventSection } from '../EventSection';

interface GlobalTabProps {
  config: GlobalAlertsConfig;
  onConfigChange: (updates: Partial<GlobalAlertsConfig>) => void;
  overlayUrl?: string;
}

export const GlobalTab: React.FC<GlobalTabProps> = ({ config, onConfigChange, overlayUrl = '' }) => {
  const animationTypes: AnimationType[] = ['fade', 'slide', 'zoom', 'bounce', 'rotate', 'none'];
  const animationDirections: AnimationDirection[] = ['top', 'bottom', 'left', 'right', 'center'];
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Sistema Activado/Desactivado */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 3xl:text-base">
              🎉 Sistema de Event Alerts
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 3xl:text-sm">
              Activa o desactiva todas las alertas de eventos
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
            <span className="ml-3 text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] 3xl:text-base">
              {config.enabled ? 'Activado' : 'Desactivado'}
            </span>
          </label>
        </div>
      </div>

      {/* URL del Overlay */}
      <EventSection title="🔗 URL del Overlay" description="Agrega esta URL como fuente de navegador en OBS Studio (1920×1080)" defaultOpen>

        <div className="flex gap-2">
          <input
            type="text"
            value={overlayUrl || 'Cargando...'}
            readOnly
            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none 3xl:text-base"
          />
          <button
            onClick={handleCopy}
            disabled={!overlayUrl}
            className="px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-bold text-sm flex items-center gap-2 whitespace-nowrap 3xl:text-base"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
      </EventSection>

      {/* Configuración por Defecto */}
      <EventSection title="🎬 Configuración por Defecto" description="Estos valores se aplicarán a todas las alertas, a menos que se configuren individualmente">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Duración */}
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Duración de Alerta (segundos)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={config.defaultDuration}
              onChange={(e) =>
                onConfigChange({ defaultDuration: parseInt(e.target.value) || 5 })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Volumen */}
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Volumen (0-100)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={config.defaultVolume}
              onChange={(e) =>
                onConfigChange({ defaultVolume: parseInt(e.target.value) || 50 })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Tipo de animación */}
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Tipo de Animación
            </label>
            <select
              value={config.defaultAnimation}
              onChange={(e) =>
                onConfigChange({ defaultAnimation: e.target.value as AnimationType })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {animationTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Dirección de animación */}
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Dirección de Animación
            </label>
            <select
              value={config.defaultAnimationDirection}
              onChange={(e) =>
                onConfigChange({
                  defaultAnimationDirection: e.target.value as AnimationDirection,
                })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {animationDirections.map((dir) => (
                <option key={dir} value={dir}>
                  {dir.charAt(0).toUpperCase() + dir.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </EventSection>

      {/* Posición en Overlay */}
      <EventSection title="📍 Posición en Overlay" description="Posición por defecto donde aparecerán las alertas (% del canvas)">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Posición X (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={config.defaultPosition.x}
              onChange={(e) =>
                onConfigChange({
                  defaultPosition: {
                    ...config.defaultPosition,
                    x: parseInt(e.target.value) || 50,
                  },
                })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Posición Y (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={config.defaultPosition.y}
              onChange={(e) =>
                onConfigChange({
                  defaultPosition: {
                    ...config.defaultPosition,
                    y: parseInt(e.target.value) || 50,
                  },
                })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-[#1e293b] dark:text-blue-300 3xl:text-sm">
            💡 <strong>Tip:</strong> 50% en X y Y centra la alerta en el canvas. Puedes personalizar cada tipo de evento individualmente.
          </p>
        </div>
      </EventSection>

      {/* Sistema de Cola */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 3xl:text-base">
              📋 Sistema de Cola
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 3xl:text-sm">
              Gestiona cómo se muestran múltiples alertas simultáneas
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.queueSettings.enabled}
              onChange={(e) =>
                onConfigChange({
                  queueSettings: {
                    ...config.queueSettings,
                    enabled: e.target.checked,
                  },
                })
              }
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
          </label>
        </div>

        {config.queueSettings.enabled && (
          <div className="space-y-4 mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
                  Tamaño Máximo de Cola
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.queueSettings.maxQueueSize}
                  onChange={(e) =>
                    onConfigChange({
                      queueSettings: {
                        ...config.queueSettings,
                        maxQueueSize: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
                  Delay Entre Alertas (ms)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={config.queueSettings.delayBetweenAlerts}
                  onChange={(e) =>
                    onConfigChange({
                      queueSettings: {
                        ...config.queueSettings,
                        delayBetweenAlerts: parseInt(e.target.value) || 1000,
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.queueSettings.showQueueCounter}
                onChange={(e) =>
                  onConfigChange({
                    queueSettings: {
                      ...config.queueSettings,
                      showQueueCounter: e.target.checked,
                    },
                  })
                }
                className="w-5 h-5 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-[#1e293b] dark:text-[#f8fafc] 3xl:text-base">
                Mostrar contador de alertas en cola
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Cooldowns */}
      <EventSection title="⏱️ Cooldowns" description="Tiempo mínimo entre alertas para evitar spam">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Cooldown Global (segundos)
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={config.cooldownSettings.globalCooldown}
              onChange={(e) =>
                onConfigChange({
                  cooldownSettings: {
                    ...config.cooldownSettings,
                    globalCooldown: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 3xl:text-sm">
              Entre CUALQUIER alerta
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Cooldown Por Evento (segundos)
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={config.cooldownSettings.perEventCooldown}
              onChange={(e) =>
                onConfigChange({
                  cooldownSettings: {
                    ...config.cooldownSettings,
                    perEventCooldown: parseInt(e.target.value) || 5,
                  },
                })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 3xl:text-sm">
              Entre alertas del mismo tipo
            </p>
          </div>
        </div>
      </EventSection>

      {/* Tamaño de Canvas */}
      <EventSection title="🖼️ Tamaño de Canvas" description="Resolución del overlay en OBS (recomendado: 1920x1080)">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Ancho (px)
            </label>
            <input
              type="number"
              min="800"
              max="3840"
              step="10"
              value={config.canvas.width}
              onChange={(e) =>
                onConfigChange({
                  canvas: {
                    ...config.canvas,
                    width: parseInt(e.target.value) || 1920,
                  },
                })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2 3xl:text-sm">
              Alto (px)
            </label>
            <input
              type="number"
              min="600"
              max="2160"
              step="10"
              value={config.canvas.height}
              onChange={(e) =>
                onConfigChange({
                  canvas: {
                    ...config.canvas,
                    height: parseInt(e.target.value) || 1080,
                  },
                })
              }
              className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </EventSection>
      {/* TTS Global */}
      <EventSection title="🗣️ Text-to-Speech Global" description="Configuración TTS por defecto para todos los eventos. Cada evento puede sobrescribirla individualmente.">
        <TtsSection
          config={config.tts}
          onChange={(updates) => onConfigChange({ tts: { ...config.tts, ...updates } })}
          messageVariables="({username})"
        />
      </EventSection>
    </div>
  );
};
