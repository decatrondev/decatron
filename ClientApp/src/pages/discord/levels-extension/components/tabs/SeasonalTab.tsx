import { useState, useEffect } from 'react';
import { Calendar, Users, Zap, Crown, Medal } from 'lucide-react';
import api from '../../../../../services/api';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  xpGained: number;
  messagesCount: number;
}

interface SeasonalStats {
  totalUsers: number;
  totalXp: number;
  topUser: string;
}

interface SeasonalTabProps {
  guildId: string;
}

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent';

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthDisplay = (month: string): string => {
  const [year, m] = month.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

const medalColors: Record<number, string> = {
  1: 'text-[#f59e0b]',
  2: 'text-[#94a3b8]',
  3: 'text-[#cd7f32]',
};

export default function SeasonalTab({ guildId }: SeasonalTabProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<SeasonalStats>({ totalUsers: 0, totalXp: 0, topUser: '-' });
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/discord/levels/${guildId}/seasonal?month=${selectedMonth}`);
        if (cancelled) return;
        if (res.data.success) {
          setLeaderboard(res.data.leaderboard || []);
          setStats(res.data.stats || { totalUsers: 0, totalXp: 0, topUser: '-' });
        }
      } catch {
        if (!cancelled) {
          setLeaderboard([]);
          setStats({ totalUsers: 0, totalXp: 0, topUser: '-' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [guildId, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cardClass}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#2563eb]" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Leaderboard Mensual</h3>
          </div>
          <span className="px-4 py-1.5 rounded-xl text-sm font-bold bg-[#2563eb]/10 text-[#2563eb] dark:bg-[#2563eb]/20 dark:text-[#60a5fa] capitalize">
            {formatMonthDisplay(selectedMonth)}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-5 h-5 text-[#2563eb]" />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total Usuarios</span>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {loading ? '...' : stats.totalUsers.toLocaleString()}
          </p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-5 h-5 text-[#f59e0b]" />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total XP</span>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {loading ? '...' : stats.totalXp.toLocaleString()}
          </p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-3">
            <Crown className="w-5 h-5 text-[#f59e0b]" />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Top Usuario</span>
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white truncate">
            {loading ? '...' : stats.topUser || '-'}
          </p>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-5">
          <Medal className="w-5 h-5 text-[#f59e0b]" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Ranking</h3>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Cargando datos...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-10 h-10 text-[#64748b] mx-auto mb-3" />
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Sin datos para este mes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                  <th className="text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase py-3 px-2 w-16">Rank</th>
                  <th className="text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase py-3 px-2">Usuario</th>
                  <th className="text-right text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase py-3 px-2">XP Ganado</th>
                  <th className="text-right text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase py-3 px-2">Mensajes</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(entry => (
                  <tr
                    key={entry.userId}
                    className="border-b border-[#e2e8f0]/50 dark:border-[#374151]/50 hover:bg-[#f8fafc] dark:hover:bg-[#374151]/30 transition-colors"
                  >
                    <td className="py-3 px-2">
                      {entry.rank <= 3 ? (
                        <span className={`text-lg font-black ${medalColors[entry.rank]}`}>
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400">#{entry.rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{entry.username}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-sm font-bold text-[#2563eb] dark:text-[#60a5fa]">
                        {entry.xpGained.toLocaleString()} XP
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {entry.messagesCount.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Month selector */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-[#8b5cf6]" />
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Seleccionar Mes</h3>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          max={getCurrentMonth()}
          className={`${inputClass} max-w-[250px]`}
        />
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
          Selecciona un mes para ver el leaderboard historico
        </p>
      </div>
    </div>
  );
}
