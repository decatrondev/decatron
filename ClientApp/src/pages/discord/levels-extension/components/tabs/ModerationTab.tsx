import { useState, useEffect } from 'react';
import { Zap, Users, Clock, Search, RotateCcw, Plus } from 'lucide-react';
import type { XpBoost, XpUser } from '../../types';

interface ModerationTabProps {
  guildId: string;
  users: XpUser[];
  usersTotal: number;
  boosts: XpBoost[];
  activeBoost: { multiplier: number; expiresAt: string } | null;
  onLoadUsers: (search?: string, page?: number) => void;
  onUpdateUserXp: (userId: string, action: string, amount?: number) => void;
  onResetUserAchievements?: (userId: string) => void;
  onFullResetUser?: (userId: string) => void;
  onLoadBoosts: () => void;
  onCreateBoost: (multiplier: number, hours: number) => void;
}

const cardClass = 'bg-ds-surface rounded-lg p-6 border border-ds-border ';
const labelClass = 'text-sm font-bold text-ds-soft ';
const inputClass = 'w-full px-4 py-2.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent';
const selectClass = `${inputClass} [&>option]:bg-ds-surface `;
const btnPrimary = 'px-4 py-2 bg-ds-accent text-ds-on-accent font-bold rounded-lg';
const btnSecondary = 'px-4 py-2 bg-ds-bg text-ds-soft font-medium rounded-lg border border-ds-border ';

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function ModerationTab({
  guildId,
  users,
  usersTotal,
  boosts,
  activeBoost,
  onLoadUsers,
  onUpdateUserXp,
  onResetUserAchievements,
  onFullResetUser,
  onLoadBoosts,
  onCreateBoost,
}: ModerationTabProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [boostMultiplier, setBoostMultiplier] = useState(2);
  const [boostDuration, setBoostDuration] = useState(1);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    onLoadUsers();
    onLoadBoosts();
  }, []);

  useEffect(() => {
    if (!activeBoost) {
      setCountdown('');
      return;
    }
    setCountdown(formatCountdown(activeBoost.expiresAt));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(activeBoost.expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBoost]);

  const handleSearch = () => {
    setPage(1);
    onLoadUsers(search || undefined, 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    onLoadUsers(search || undefined, newPage);
  };

  const durationOptions = [
    { value: 0.5, label: '30 minutos' },
    { value: 1, label: '1 hora' },
    { value: 2, label: '2 horas' },
    { value: 4, label: '4 horas' },
    { value: 8, label: '8 horas' },
    { value: 24, label: '24 horas' },
  ];

  const multiplierOptions = [
    { value: 1.5, label: '1.5x' },
    { value: 2, label: '2x' },
    { value: 3, label: '3x' },
    { value: 5, label: '5x' },
  ];

  return (
    <div className="space-y-6">
      {/* XP Boost */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Zap className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">XP Boost</h3>
        </div>

        {activeBoost && (
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-ds-accent/10 to-[#f97316]/10 border border-ds-warn/40">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold text-ds-warn">Boost Activo</p>
                <p className="text-2xl font-black text-ds-text mt-1">
                  {activeBoost.multiplier}x XP
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-ds-soft">Tiempo restante</p>
                <p className="text-xl font-black text-ds-warn mt-1 font-mono">{countdown}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className={labelClass}>Multiplicador</label>
            <select
              value={boostMultiplier}
              onChange={e => setBoostMultiplier(parseFloat(e.target.value))}
              className={`${selectClass} mt-2`}
            >
              {multiplierOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Duracion</label>
            <select
              value={boostDuration}
              onChange={e => setBoostDuration(parseFloat(e.target.value))}
              className={`${selectClass} mt-2`}
            >
              {durationOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => onCreateBoost(boostMultiplier, boostDuration)}
            className={`${btnPrimary} flex items-center justify-center gap-2`}
          >
            <Zap className="w-4 h-4" />
            Activar Boost
          </button>
        </div>
      </div>

      {/* Gestion de Usuarios */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Users className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">Gestion de Usuarios</h3>
          <span className="px-2 py-0.5 bg-ds-bg rounded-lg text-xs font-bold text-ds-soft">
            {usersTotal} total
          </span>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-soft" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar usuario..."
              className={`${inputClass} pl-10`}
            />
          </div>
          <button onClick={handleSearch} className={`${btnPrimary} shrink-0`}>
            Buscar
          </button>
        </div>

        {/* Users List */}
        <div className="space-y-2">
          {users.length === 0 && (
            <p className="text-sm text-ds-soft text-center py-8">
              No se encontraron usuarios
            </p>
          )}
          {users.map(user => (
            <div
              key={user.userId}
              className="flex items-center gap-4 p-3 rounded-lg bg-ds-bg hover:bg-ds-raised transition-colors"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-ds-raised overflow-hidden shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-ds-soft">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ds-text truncate">{user.username}</p>
                <p className="text-xs text-ds-soft">
                  {user.xp.toLocaleString()} XP — {user.totalMessages.toLocaleString()} msgs
                </p>
              </div>

              {/* Level Badge */}
              <span className="shrink-0 px-3 py-1 bg-ds-accent text-ds-on-accent text-xs font-black rounded-full">
                Lv. {user.level}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onUpdateUserXp(user.userId, 'give', 100)}
                  className="px-2 py-1 text-xs font-bold text-ds-ok hover:bg-ds-ok/10 rounded-lg transition-colors"
                  title="Dar +100 XP"
                >
                  <Plus className="w-3 h-3 inline" /> 100
                </button>
                <button
                  onClick={() => onUpdateUserXp(user.userId, 'give', 500)}
                  className="px-2 py-1 text-xs font-bold text-ds-ok hover:bg-ds-ok/10 rounded-lg transition-colors"
                  title="Dar +500 XP"
                >
                  <Plus className="w-3 h-3 inline" /> 500
                </button>
                <button
                  onClick={() => onUpdateUserXp(user.userId, 'reset')}
                  className="px-2 py-1 text-xs font-bold text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-colors"
                  title="Reset XP"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                {onResetUserAchievements && (
                  <button
                    onClick={() => { if (window.confirm(`Resetear badges de ${user.username}?`)) onResetUserAchievements(user.userId); }}
                    className="px-2 py-1 text-xs font-bold text-ds-warn hover:bg-ds-warn/10 rounded-lg transition-colors"
                    title="Reset solo achievements"
                  >
                    🏆
                  </button>
                )}
                {onFullResetUser && (
                  <button
                    onClick={() => { if (window.confirm(`Reset COMPLETO de ${user.username}? (XP + Achievements + Seasonal + Roles)`)) onFullResetUser(user.userId); }}
                    className="px-2 py-1 text-xs font-bold text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-colors"
                    title="Reset completo (XP + Achievements + Seasonal)"
                  >
                    Full Reset
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {usersTotal > 20 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-ds-border">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className={`${btnSecondary} text-sm disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Anterior
            </button>
            <span className="text-sm text-ds-soft px-3">
              Pagina {page} de {Math.ceil(usersTotal / 20)}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= Math.ceil(usersTotal / 20)}
              className={`${btnSecondary} text-sm disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Historial de Boosts */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Clock className="w-5 h-5 text-ds-accent-text" />
          <h3 className="text-lg font-black text-ds-text">Historial de Boosts</h3>
        </div>

        {boosts.length === 0 ? (
          <p className="text-sm text-ds-soft text-center py-6">
            No hay boosts registrados
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ds-border">
                  <th className={`${labelClass} text-left pb-3`}>Multiplicador</th>
                  <th className={`${labelClass} text-left pb-3`}>Activado por</th>
                  <th className={`${labelClass} text-left pb-3`}>Inicio</th>
                  <th className={`${labelClass} text-left pb-3`}>Fin</th>
                  <th className={`${labelClass} text-left pb-3`}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {boosts.map(boost => (
                  <tr key={boost.id} className="border-b border-ds-border/50 last:border-0">
                    <td className="py-3">
                      <span className="font-bold text-ds-text">{boost.multiplier}x</span>
                    </td>
                    <td className="py-3 text-sm text-ds-soft">{boost.activatedByUsername}</td>
                    <td className="py-3 text-sm text-ds-soft">
                      {new Date(boost.startsAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-ds-soft">
                      {new Date(boost.expiresAt).toLocaleString()}
                    </td>
                    <td className="py-3">
                      {boost.isActive && !boost.isExpired ? (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-ds-ok/10 text-ds-ok">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-ds-bg text-ds-soft">
                          Expirado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
