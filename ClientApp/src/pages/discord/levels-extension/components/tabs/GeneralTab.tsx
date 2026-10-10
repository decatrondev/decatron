import { useState } from 'react';
import { Settings, Moon, Shield, MessageSquare, Hash } from 'lucide-react';
import type { LevelsConfig, DiscordChannel } from '../../types';

interface GeneralTabProps {
  config: LevelsConfig;
  onConfigChange: (updates: Partial<LevelsConfig>) => void;
  channels: DiscordChannel[];
}

const cardClass = 'bg-ds-surface rounded-lg p-6 border border-ds-border ';
const labelClass = 'text-sm font-bold text-ds-soft ';
const inputClass = 'w-full px-4 py-2.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent';
const selectClass = `${inputClass} [&>option]:bg-ds-surface `;

export default function GeneralTab({ config, onConfigChange, channels }: GeneralTabProps) {
  const [expandedExcluded, setExpandedExcluded] = useState(false);

  const toggleExcludedChannel = (channelId: string) => {
    const current = config.excludedChannels || [];
    if (current.includes(channelId)) {
      onConfigChange({ excludedChannels: current.filter(c => c !== channelId) });
    } else {
      onConfigChange({ excludedChannels: [...current, channelId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Setup notice */}
      <div className="bg-ds-accent/10 rounded-lg p-4 border border-ds-accent flex gap-3">
        <span className="text-xl flex-shrink-0">💡</span>
        <div>
          <p className="text-sm font-bold text-ds-accent-text">Configuracion inicial</p>
          <p className="text-xs text-ds-accent-text mt-1">
            Para que el bot pueda asignar roles automaticamente al subir de nivel, asegurate de que el rol <strong>"Decatron"</strong> este lo mas arriba posible en la jerarquia de roles de tu servidor de Discord.
            Ve a <strong>Discord → Ajustes del servidor → Roles</strong> y arrastralo arriba.
          </p>
        </div>
      </div>

      {/* Sistema XP */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Settings className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">Sistema XP</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className={labelClass}>Activar sistema de niveles</p>
            <p className="text-xs text-ds-soft mt-1">
              Los usuarios ganaran XP por enviar mensajes
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e => onConfigChange({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-ds-raised rounded-full peer peer-checked:bg-ds-accent transition-all duration-300 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-7" />
          </label>
        </div>
        <div className="mt-3">
          <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${config.enabled ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-danger/10 text-ds-danger '}`}>
            {config.enabled ? 'Activo' : 'Desactivado'}
          </span>
        </div>
      </div>

      {/* Dificultad */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Shield className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">Dificultad</h3>
        </div>
        <div>
          <label className={labelClass}>Preset de dificultad</label>
          <select
            value={config.difficultyPreset}
            onChange={e => onConfigChange({ difficultyPreset: e.target.value })}
            className={`${selectClass} mt-2`}
          >
            <option value="easy">Facil — Subir de nivel rapido</option>
            <option value="normal">Normal — Equilibrado</option>
            <option value="hard">Dificil — Requiere mas actividad</option>
            <option value="hardcore">Hardcore — Solo los mas activos</option>
          </select>
        </div>
      </div>

      {/* XP por Mensaje */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <MessageSquare className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">XP por Mensaje</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>XP Minimo</label>
            <input
              type="number"
              min={1}
              value={config.xpMin}
              onChange={e => onConfigChange({ xpMin: parseInt(e.target.value) || 0 })}
              className={`${inputClass} mt-2`}
            />
          </div>
          <div>
            <label className={labelClass}>XP Maximo</label>
            <input
              type="number"
              min={1}
              value={config.xpMax}
              onChange={e => onConfigChange({ xpMax: parseInt(e.target.value) || 0 })}
              className={`${inputClass} mt-2`}
            />
          </div>
        </div>
      </div>

      {/* Anti-exploit */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Shield className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">Anti-exploit</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Cooldown (segundos)</label>
            <input
              type="number"
              min={0}
              value={config.cooldownSeconds}
              onChange={e => onConfigChange({ cooldownSeconds: parseInt(e.target.value) || 0 })}
              className={`${inputClass} mt-2`}
            />
          </div>
          <div>
            <label className={labelClass}>Max XP/hora</label>
            <input
              type="number"
              min={0}
              value={config.maxXpPerHour}
              onChange={e => onConfigChange({ maxXpPerHour: parseInt(e.target.value) || 0 })}
              className={`${inputClass} mt-2`}
            />
          </div>
          <div>
            <label className={labelClass}>Largo minimo mensaje</label>
            <input
              type="number"
              min={0}
              value={config.minMessageLength}
              onChange={e => onConfigChange({ minMessageLength: parseInt(e.target.value) || 0 })}
              className={`${inputClass} mt-2`}
            />
          </div>
        </div>
      </div>

      {/* Canal de Level-Up */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Hash className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">Canal de Level-Up</h3>
        </div>
        <div>
          <label className={labelClass}>Canal para notificaciones de nivel</label>
          <select
            value={config.levelupChannelId || ''}
            onChange={e => onConfigChange({ levelupChannelId: e.target.value || null })}
            className={`${selectClass} mt-2`}
          >
            <option value="">Sin canal</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>#{ch.name}</option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Canal para achievements</label>
          <p className="text-xs text-ds-soft mt-1 mb-2">Donde se anuncian los logros desbloqueados</p>
          <select
            value={config.achievementChannelId || ''}
            onChange={e => onConfigChange({ achievementChannelId: e.target.value || null })}
            className={`${selectClass}`}
          >
            <option value="">Mismo canal de level-up</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>#{ch.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Canales Excluidos */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Hash className="w-5 h-5 text-ds-accent-text" />
            <h3 className="text-lg font-black text-ds-text">Canales Excluidos</h3>
          </div>
          {channels.length > 6 && (
            <button
              onClick={() => setExpandedExcluded(!expandedExcluded)}
              className="text-xs font-bold text-ds-accent-text hover:underline"
            >
              {expandedExcluded ? 'Mostrar menos' : 'Mostrar todos'}
            </button>
          )}
        </div>
        <p className="text-xs text-ds-soft mb-4">
          Los mensajes en estos canales no generaran XP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {(expandedExcluded ? channels : channels.slice(0, 6)).map(ch => (
            <label
              key={ch.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-ds-bg hover:bg-ds-raised cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={(config.excludedChannels || []).includes(ch.id)}
                onChange={() => toggleExcludedChannel(ch.id)}
                className="w-4 h-4 rounded border-ds-border text-ds-accent-text focus:ring-ds-accent"
              />
              <span className="text-sm text-ds-text">#{ch.name}</span>
            </label>
          ))}
        </div>
        {channels.length === 0 && (
          <p className="text-sm text-ds-soft text-center py-4">No hay canales disponibles</p>
        )}
      </div>

      {/* Bonus en Vivo */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Moon className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">Bonus en Vivo</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className={labelClass}>Bonus cuando el streamer esta en vivo</p>
            <p className="text-xs text-ds-soft mt-1">
              Cuando el streamer esta transmitiendo en Twitch, todos ganan XP extra en Discord
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.nightModeEnabled}
              onChange={e => onConfigChange({ nightModeEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-ds-raised rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-ds-accent peer-checked:to-[#a78bfa] transition-all duration-300 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-7" />
          </label>
        </div>
        {config.nightModeEnabled && (
          <div className="mt-4 pt-4 border-t border-ds-border">
            <label className={labelClass}>Multiplicador</label>
            <input
              type="number"
              min={1}
              max={10}
              step={0.1}
              value={config.nightModeMultiplier}
              onChange={e => onConfigChange({ nightModeMultiplier: parseFloat(e.target.value) || 1 })}
              className={`${inputClass} mt-2 max-w-[200px]`}
            />
            <p className="text-xs text-ds-soft mt-2">
              El XP ganado se multiplicara por {config.nightModeMultiplier}x durante la noche
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
