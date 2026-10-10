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
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
              🎉 Sistema de Event Alerts
            </label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
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
            <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
            <span className="ml-3 text-sm font-bold text-ds-text 3xl:text-base">
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
            className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-bg text-ds-text font-mono text-sm focus:ring-2 focus:ring-ds-accent outline-none 3xl:text-base"
          />
          <button
            onClick={handleCopy}
            disabled={!overlayUrl}
            className="px-4 py-2 bg-ds-accent hover:bg-ds-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-ds-on-accent rounded-lg transition-all font-bold text-sm flex items-center gap-2 whitespace-nowrap 3xl:text-base"
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
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
            />
          </div>

          {/* Volumen */}
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
            />
          </div>

          {/* Tipo de animación */}
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
              Tipo de Animación
            </label>
            <select
              value={config.defaultAnimation}
              onChange={(e) =>
                onConfigChange({ defaultAnimation: e.target.value as AnimationType })
              }
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
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
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
              Dirección de Animación
            </label>
            <select
              value={config.defaultAnimationDirection}
              onChange={(e) =>
                onConfigChange({
                  defaultAnimationDirection: e.target.value as AnimationDirection,
                })
              }
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
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
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
            />
          </div>
        </div>

        <div className="mt-4 p-4 bg-ds-accent/10 border border-ds-accent rounded-lg">
          <p className="text-xs text-ds-text 3xl:text-sm">
            💡 <strong>Tip:</strong> 50% en X y Y centra la alerta en el canvas. Puedes personalizar cada tipo de evento individualmente.
          </p>
        </div>
      </EventSection>

      {/* Sistema de Cola */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-ds-text flex items-center gap-2 3xl:text-base">
              📋 Sistema de Cola
            </label>
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
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
            <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
          </label>
        </div>

        {config.queueSettings.enabled && (
          <div className="space-y-4 mt-4 pt-4 border-t border-ds-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                  className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
                  className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
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
                className="w-5 h-5 text-ds-accent-text border-ds-border rounded focus:ring-2 focus:ring-ds-accent"
              />
              <span className="ml-2 text-sm text-ds-text 3xl:text-base">
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
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
            />
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
              Entre CUALQUIER alerta
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
            />
            <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
              Entre alertas del mismo tipo
            </p>
          </div>
        </div>
      </EventSection>

      {/* Tamaño de Canvas */}
      <EventSection title="🖼️ Tamaño de Canvas" description="Resolución del overlay en OBS (recomendado: 1920x1080)">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ds-soft block mb-2 3xl:text-sm">
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
              className="w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none"
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
