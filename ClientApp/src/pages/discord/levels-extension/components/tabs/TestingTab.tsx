import { Send, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { LevelsConfig, DiscordChannel } from '../../types';

interface TestingTabProps {
  guildId: string;
  config: LevelsConfig;
  channels: DiscordChannel[];
  onTestLevelUp: () => void;
}

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const labelClass = 'text-sm font-bold text-gray-700 dark:text-gray-300';
const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-bold rounded-xl';

export default function TestingTab({ guildId, config, channels, onTestLevelUp }: TestingTabProps) {
  const levelupChannel = channels.find(ch => ch.id === config.levelupChannelId);

  const difficultyLabels: Record<string, string> = {
    easy: 'Facil',
    normal: 'Normal',
    hard: 'Dificil',
    hardcore: 'Hardcore',
  };

  return (
    <div className="space-y-6">
      {/* Test Level Up */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Send className="w-5 h-5 text-[#2563eb]" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Test Level Up</h3>
        </div>

        {!config.levelupChannelId ? (
          <div className="p-4 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-[#f59e0b]">Sin canal configurado</p>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                Configura un canal de Level-Up en la pestana General para poder enviar tests.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#374151]/30 mb-4">
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                Se enviara un mensaje de prueba al canal:
              </p>
              <p className="text-base font-bold text-gray-900 dark:text-white mt-1">
                #{levelupChannel?.name || config.levelupChannelId}
              </p>
            </div>
            <button
              onClick={onTestLevelUp}
              disabled={!config.enabled}
              className={`${btnPrimary} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Send className="w-4 h-4" />
              Enviar Test Level Up
            </button>
            {!config.enabled && (
              <p className="text-xs text-[#ef4444] mt-2">
                El sistema de niveles esta desactivado. Activalo primero.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Informacion del Sistema */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Info className="w-5 h-5 text-[#8b5cf6]" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Informacion del Sistema</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ConfigItem
            label="Estado"
            value={config.enabled ? 'Activo' : 'Desactivado'}
            icon={config.enabled ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-[#ef4444]" />}
          />
          <ConfigItem
            label="Dificultad"
            value={difficultyLabels[config.difficultyPreset] || config.difficultyPreset}
          />
          <ConfigItem
            label="Rango XP"
            value={`${config.xpMin} - ${config.xpMax} por mensaje`}
          />
          <ConfigItem
            label="Cooldown"
            value={`${config.cooldownSeconds} segundos`}
          />
          <ConfigItem
            label="Max XP/hora"
            value={config.maxXpPerHour.toLocaleString()}
          />
          <ConfigItem
            label="Largo minimo mensaje"
            value={`${config.minMessageLength} caracteres`}
          />
          <ConfigItem
            label="Canal Level-Up"
            value={levelupChannel ? `#${levelupChannel.name}` : 'Sin canal'}
          />
          <ConfigItem
            label="Canales excluidos"
            value={`${(config.excludedChannels || []).length} canales`}
          />
          <ConfigItem
            label="Modo nocturno"
            value={config.nightModeEnabled ? `Activo (${config.nightModeMultiplier}x)` : 'Desactivado'}
          />
          <ConfigItem
            label="Guild ID"
            value={guildId}
            mono
          />
        </div>
      </div>
    </div>
  );
}

function ConfigItem({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#374151]/30">
      <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {icon}
        <p className={`text-sm font-bold text-gray-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
