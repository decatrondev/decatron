import { useState, useMemo } from 'react';
import type { LevelsConfig } from '../../types';

interface LevelsTabProps {
  config: LevelsConfig;
}

const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  easy: 0.7,
  normal: 1.0,
  hard: 1.5,
  hardcore: 2.0,
};

const cardClass = 'bg-ds-surface rounded-lg p-6 border border-ds-border ';

function calculateRequiredXp(level: number, difficulty: number): number {
  return Math.round(100 * level * level * difficulty);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatTime(totalXp: number, avgXpPerMin: number): string {
  if (avgXpPerMin <= 0) return '—';
  const minutes = totalXp / avgXpPerMin;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days >= 30) return `~${Math.round(days / 30)} meses`;
  if (days >= 7) return `~${Math.round(days / 7)} semanas`;
  if (days >= 1) return `~${Math.round(days)} dias`;
  if (hours >= 1) return `~${Math.round(hours)} horas`;
  return `~${Math.round(minutes)} min`;
}

export default function LevelsTab({ config }: LevelsTabProps) {
  const [maxLevel, setMaxLevel] = useState(50);
  const [simulateLevel, setSimulateLevel] = useState(10);

  const difficulty = config.difficultyPreset === 'custom'
    ? config.customMultiplier
    : DIFFICULTY_MULTIPLIERS[config.difficultyPreset] ?? 1.0;

  // Average XP per message considering cooldown
  const avgXpPerMsg = (config.xpMin + config.xpMax) / 2;
  // Assume ~1 message per cooldown period, active for ~2 hours/day
  const msgsPerDay = (2 * 60 * 60) / config.cooldownSeconds;
  const xpPerDay = msgsPerDay * avgXpPerMsg;
  const avgXpPerMin = xpPerDay / (2 * 60); // XP per active minute

  const levelsData = useMemo(() => {
    const data = [];
    let totalXp = 0;
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const required = calculateRequiredXp(lvl, difficulty);
      totalXp += required;
      data.push({
        level: lvl,
        required,
        totalXp,
        estimatedTime: formatTime(totalXp, avgXpPerMin),
      });
    }
    return data;
  }, [maxLevel, difficulty, avgXpPerMin]);

  // Simulator
  const simData = useMemo(() => {
    let total = 0;
    for (let i = 1; i <= simulateLevel; i++) {
      total += calculateRequiredXp(i, difficulty);
    }
    const daysNeeded = total / xpPerDay;
    const msgsNeeded = total / avgXpPerMsg;
    return { totalXp: total, days: daysNeeded, messages: msgsNeeded };
  }, [simulateLevel, difficulty, xpPerDay, avgXpPerMsg]);

  return (
    <div className="space-y-6">
      {/* Simulator */}
      <div className={cardClass}>
        <h3 className="text-lg font-black text-ds-text mb-1">Simulador de Niveles</h3>
        <p className="text-xs text-ds-soft mb-5">
          Calcula cuanto tiempo toma llegar a un nivel con tu configuracion actual
        </p>

        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm font-bold text-ds-soft">Nivel objetivo:</label>
          <input
            type="range"
            min={1}
            max={100}
            value={simulateLevel}
            onChange={e => setSimulateLevel(parseInt(e.target.value))}
            className="flex-1 h-2 bg-ds-raised rounded-lg appearance-none cursor-pointer accent-ds-accent"
          />
          <span className="text-2xl font-black text-ds-accent-text w-12 text-right">{simulateLevel}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-ds-bg rounded-lg text-center">
            <p className="text-[10px] font-bold text-ds-soft mb-1">XP TOTAL NECESARIO</p>
            <p className="text-2xl font-black text-ds-text">{formatNumber(simData.totalXp)}</p>
          </div>
          <div className="p-4 bg-ds-bg rounded-lg text-center">
            <p className="text-[10px] font-bold text-ds-soft mb-1">TIEMPO ESTIMADO</p>
            <p className="text-2xl font-black text-ds-accent-text">~{Math.round(simData.days)} dias</p>
            <p className="text-[10px] text-ds-soft">(~2h activo/dia)</p>
          </div>
          <div className="p-4 bg-ds-bg rounded-lg text-center">
            <p className="text-[10px] font-bold text-ds-soft mb-1">MENSAJES NECESARIOS</p>
            <p className="text-2xl font-black text-ds-text">{formatNumber(Math.round(simData.messages))}</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-ds-accent/10 rounded-lg text-xs text-ds-soft">
          Basado en: {config.xpMin}-{config.xpMax} XP/msg, cooldown {config.cooldownSeconds}s, dificultad {config.difficultyPreset}
          {config.difficultyPreset !== 'normal' && ` (${difficulty}x)`}
        </div>
      </div>

      {/* Config */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-ds-text">Tabla de Niveles</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ds-soft">Mostrar hasta nivel:</label>
            <select
              value={maxLevel}
              onChange={e => setMaxLevel(parseInt(e.target.value))}
              className="ds-input"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ds-border">
                <th className="text-left text-xs font-bold text-ds-soft pb-3">Nivel</th>
                <th className="text-right text-xs font-bold text-ds-soft pb-3">XP para este nivel</th>
                <th className="text-right text-xs font-bold text-ds-soft pb-3">XP total acumulado</th>
                <th className="text-right text-xs font-bold text-ds-soft pb-3">Tiempo estimado</th>
                <th className="text-right text-xs font-bold text-ds-soft pb-3">Barra</th>
              </tr>
            </thead>
            <tbody>
              {levelsData.map(row => {
                const progress = maxLevel > 0 ? (row.level / maxLevel) * 100 : 0;
                const isHighlight = row.level === 1 || row.level === 5 || row.level === 10 ||
                  row.level === 25 || row.level === 50 || row.level === 75 || row.level === 100;
                return (
                  <tr
                    key={row.level}
                    className={`border-b border-ds-border/30 ${isHighlight ? 'bg-ds-accent/10 ' : ''}`}
                  >
                    <td className="py-2.5">
                      <span className={`font-black ${isHighlight ? 'text-ds-accent-text' : 'text-ds-text '}`}>
                        {row.level}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-sm text-ds-soft">
                      {formatNumber(row.required)}
                    </td>
                    <td className="py-2.5 text-right text-sm font-bold text-ds-text">
                      {formatNumber(row.totalXp)}
                    </td>
                    <td className="py-2.5 text-right text-sm text-ds-soft">
                      {row.estimatedTime}
                    </td>
                    <td className="py-2.5 pl-4 w-32">
                      <div className="w-full h-2 bg-ds-raised rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ds-accent rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-ds-soft">
          Formula: XP = 100 × nivel² × {difficulty} (dificultad). Tiempo estimado asumiendo ~2 horas de actividad diaria.
        </p>
      </div>
    </div>
  );
}
