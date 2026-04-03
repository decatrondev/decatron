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

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const labelClass = 'text-sm font-bold text-gray-700 dark:text-gray-300';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent';
const selectClass = `${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`;
const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-bold rounded-xl';
const btnSecondary = 'px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151]';

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
          <Zap className="w-5 h-5 text-[#f59e0b]" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white">XP Boost</h3>
        </div>

        {activeBoost && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[#f59e0b]/10 to-[#f97316]/10 border border-[#f59e0b]/30">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold text-[#f59e0b]">Boost Activo</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                  {activeBoost.multiplier}x XP
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Tiempo restante</p>
                <p className="text-xl font-black text-[#f59e0b] mt-1 font-mono">{countdown}</p>
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
          <Users className="w-5 h-5 text-[#2563eb]" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Gestion de Usuarios</h3>
          <span className="px-2 py-0.5 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-lg text-xs font-bold text-[#64748b]">
            {usersTotal} total
          </span>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
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
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] text-center py-8">
              No se encontraron usuarios
            </p>
          )}
          {users.map(user => (
            <div
              key={user.userId}
              className="flex items-center gap-4 p-3 rounded-xl bg-[#f8fafc] dark:bg-[#374151]/30 hover:bg-[#f1f5f9] dark:hover:bg-[#374151]/50 transition-colors"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#e2e8f0] dark:bg-[#374151] overflow-hidden shrink-0">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[#64748b]">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.username}</p>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  {user.xp.toLocaleString()} XP — {user.totalMessages.toLocaleString()} msgs
                </p>
              </div>

              {/* Level Badge */}
              <span className="shrink-0 px-3 py-1 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-xs font-black rounded-full">
                Lv. {user.level}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onUpdateUserXp(user.userId, 'give', 100)}
                  className="px-2 py-1 text-xs font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Dar +100 XP"
                >
                  <Plus className="w-3 h-3 inline" /> 100
                </button>
                <button
                  onClick={() => onUpdateUserXp(user.userId, 'give', 500)}
                  className="px-2 py-1 text-xs font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Dar +500 XP"
                >
                  <Plus className="w-3 h-3 inline" /> 500
                </button>
                <button
                  onClick={() => onUpdateUserXp(user.userId, 'reset')}
                  className="px-2 py-1 text-xs font-bold text-[#ef4444] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Reset XP"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                {onResetUserAchievements && (
                  <button
                    onClick={() => { if (window.confirm(`Resetear badges de ${user.username}?`)) onResetUserAchievements(user.userId); }}
                    className="px-2 py-1 text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                    title="Reset solo achievements"
                  >
                    🏆
                  </button>
                )}
                {onFullResetUser && (
                  <button
                    onClick={() => { if (window.confirm(`Reset COMPLETO de ${user.username}? (XP + Achievements + Seasonal + Roles)`)) onFullResetUser(user.userId); }}
                    className="px-2 py-1 text-xs font-bold text-[#ef4444] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className={`${btnSecondary} text-sm disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Anterior
            </button>
            <span className="text-sm text-[#64748b] dark:text-[#94a3b8] px-3">
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
          <Clock className="w-5 h-5 text-[#8b5cf6]" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Historial de Boosts</h3>
        </div>

        {boosts.length === 0 ? (
          <p className="text-sm text-[#64748b] dark:text-[#94a3b8] text-center py-6">
            No hay boosts registrados
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                  <th className={`${labelClass} text-left pb-3`}>Multiplicador</th>
                  <th className={`${labelClass} text-left pb-3`}>Activado por</th>
                  <th className={`${labelClass} text-left pb-3`}>Inicio</th>
                  <th className={`${labelClass} text-left pb-3`}>Fin</th>
                  <th className={`${labelClass} text-left pb-3`}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {boosts.map(boost => (
                  <tr key={boost.id} className="border-b border-[#e2e8f0]/50 dark:border-[#374151]/50 last:border-0">
                    <td className="py-3">
                      <span className="font-bold text-gray-900 dark:text-white">{boost.multiplier}x</span>
                    </td>
                    <td className="py-3 text-sm text-gray-700 dark:text-gray-300">{boost.activatedByUsername}</td>
                    <td className="py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
                      {new Date(boost.startsAt).toLocaleString()}
                    </td>
                    <td className="py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
                      {new Date(boost.expiresAt).toLocaleString()}
                    </td>
                    <td className="py-3">
                      {boost.isActive && !boost.isExpired ? (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b]">
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
