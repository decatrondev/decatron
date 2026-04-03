import { useState } from 'react';
import { Trophy, Plus, Trash2, Sparkles } from 'lucide-react';

interface AchievementData {
  id: number;
  achievementKey: string;
  name: string;
  description: string;
  icon: string;
  conditionType: string;
  conditionValue: number;
  isSystem: boolean;
  enabled: boolean;
}

interface AchievementsTabProps {
  guildId: string;
  achievements: AchievementData[];
  onToggle: (id: number, enabled: boolean) => void;
  onCreate: (data: { name: string; description: string; icon: string; conditionType: string; conditionValue: number }) => void;
  onDelete: (id: number) => void;
  onResetAll?: () => void;
}

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const labelClass = 'text-sm font-bold text-gray-700 dark:text-gray-300';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent';
const selectClass = `${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`;
const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-bold rounded-xl';

const conditionLabel = (type: string, value: number): string => {
  switch (type) {
    case 'messages': return `${value} msgs`;
    case 'level': return `Nivel ${value}`;
    case 'streak': return `${value} dias`;
    default: return `${value}`;
  }
};

export default function AchievementsTab({ guildId, achievements, onToggle, onCreate, onDelete, onResetAll }: AchievementsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    icon: '',
    name: '',
    description: '',
    conditionType: 'messages',
    conditionValue: 100,
  });

  const systemAchievements = achievements.filter(a => a.isSystem);
  const customAchievements = achievements.filter(a => !a.isSystem);

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.icon.trim()) return;
    onCreate({
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      conditionType: formData.conditionType,
      conditionValue: formData.conditionValue,
    });
    setFormData({ icon: '', name: '', description: '', conditionType: 'messages', conditionValue: 100 });
    setShowForm(false);
  };

  const renderRow = (achievement: AchievementData, showDelete: boolean) => (
    <div
      key={achievement.id}
      className="flex items-center gap-4 p-4 rounded-xl bg-[#f8fafc] dark:bg-[#374151]/30 hover:bg-[#f1f5f9] dark:hover:bg-[#374151]/50 transition-colors"
    >
      <span className="text-2xl flex-shrink-0">{achievement.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{achievement.name}</p>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate">{achievement.description}</p>
      </div>
      <span className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold bg-[#2563eb]/10 text-[#2563eb] dark:bg-[#2563eb]/20 dark:text-[#60a5fa]">
        {conditionLabel(achievement.conditionType, achievement.conditionValue)}
      </span>
      {showDelete && (
        <button
          onClick={() => onDelete(achievement.id)}
          className="flex-shrink-0 p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
        <input
          type="checkbox"
          checked={achievement.enabled}
          onChange={e => onToggle(achievement.id, e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-14 h-7 bg-[#e2e8f0] dark:bg-[#374151] rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6] transition-all duration-300 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-7 after:shadow-md" />
      </label>
    </div>
  );

  if (achievements.length === 0) {
    return (
      <div className={`${cardClass} text-center py-12`}>
        <Sparkles className="w-12 h-12 text-[#2563eb] mx-auto mb-4" />
        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Sin Achievements</h3>
        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-6">
          Aun no hay achievements configurados para este servidor.
        </p>
        <button
          onClick={() => setShowForm(true)}
          className={btnPrimary}
        >
          Crear primer Achievement
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Achievements</h3>
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#f59e0b]/10 text-[#f59e0b]">
              {achievements.length} total
            </span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`${btnPrimary} flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            Crear Badge
          </button>
          {onResetAll && achievements.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Resetear achievements de TODOS los usuarios? (Los badges se mantienen, pero todos los usuarios deberan desbloquearlos de nuevo)')) onResetAll(); }}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Reset Todos
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-5">
            <Plus className="w-5 h-5 text-[#2563eb]" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Nuevo Achievement</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Icono (emoji)</label>
              <input
                type="text"
                value={formData.icon}
                onChange={e => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🏆"
                className={`${inputClass} mt-2`}
                maxLength={4}
              />
            </div>
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Chateador Pro"
                className={`${inputClass} mt-2`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Descripcion</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Envia 1000 mensajes en el servidor"
                className={`${inputClass} mt-2`}
              />
            </div>
            <div>
              <label className={labelClass}>Tipo de condicion</label>
              <select
                value={formData.conditionType}
                onChange={e => setFormData({ ...formData, conditionType: e.target.value })}
                className={`${selectClass} mt-2`}
              >
                <option value="messages">Mensajes</option>
                <option value="level">Nivel</option>
                <option value="streak">Racha (dias)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Valor</label>
              <input
                type="number"
                min={1}
                value={formData.conditionValue}
                onChange={e => setFormData({ ...formData, conditionValue: parseInt(e.target.value) || 1 })}
                className={`${inputClass} mt-2`}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl hover:bg-[#f1f5f9] dark:hover:bg-[#374151] transition-colors"
            >
              Cancelar
            </button>
            <button onClick={handleSubmit} className={btnPrimary}>
              Crear Achievement
            </button>
          </div>
        </div>
      )}

      {/* System Achievements */}
      {systemAchievements.length > 0 && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-5">
            <Sparkles className="w-5 h-5 text-[#8b5cf6]" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Achievements del Sistema</h3>
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#8b5cf6]/10 text-[#8b5cf6]">
              {systemAchievements.length}
            </span>
          </div>
          <div className="space-y-3">
            {systemAchievements.map(a => renderRow(a, false))}
          </div>
        </div>
      )}

      {/* Custom Achievements */}
      {customAchievements.length > 0 && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-5">
            <Trophy className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Achievements Personalizados</h3>
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#f59e0b]/10 text-[#f59e0b]">
              {customAchievements.length}
            </span>
          </div>
          <div className="space-y-3">
            {customAchievements.map(a => renderRow(a, true))}
          </div>
        </div>
      )}
    </div>
  );
}
