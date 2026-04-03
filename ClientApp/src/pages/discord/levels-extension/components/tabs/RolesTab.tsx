import { useState } from 'react';
import { Crown, Plus, Trash2, RefreshCw, Wand2 } from 'lucide-react';
import type { XpRole } from '../../types';

interface RolesTabProps {
  roles: XpRole[];
  guildId: string;
  onCreateDefaults: () => void;
  onSyncDiscord: () => void;
  onUpdateRole: (roleId: number, data: any) => void;
  onDeleteRole: (roleId: number) => void;
  onDeleteAll: () => void;
  onCleanupDiscord: () => void;
  onSyncUsersRoles: () => void;
  onAddRole: (data: any) => void;
}

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const labelClass = 'text-sm font-bold text-gray-700 dark:text-gray-300';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent';
const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-bold rounded-xl';
const btnSecondary = 'px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151]';

// Inline editable field that saves on blur
function EditableField({ value, onChange, type = 'text', className, min }: { value: string | number; onChange: (val: string) => void; type?: string; className?: string; min?: number }) {
  const [local, setLocal] = useState(String(value));
  const handleBlur = () => { if (local !== String(value)) onChange(local); };
  // Sync if parent value changes
  if (String(value) !== local && document.activeElement !== document.querySelector(`[data-field-id="${value}"]`)) {
    // Only sync if not focused
  }
  return (
    <input
      type={type}
      min={min}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={className}
    />
  );
}

export default function RolesTab({ roles, guildId, onCreateDefaults, onSyncDiscord, onUpdateRole, onDeleteRole, onDeleteAll, onCleanupDiscord, onSyncUsersRoles, onAddRole }: RolesTabProps) {
  const [newRole, setNewRole] = useState({ levelRequired: 1, roleName: '', roleColor: '#3b82f6' });
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddRole = () => {
    if (!newRole.roleName.trim()) return;
    onAddRole({
      levelRequired: newRole.levelRequired,
      roleName: newRole.roleName.trim(),
      roleColor: newRole.roleColor,
    });
    setNewRole({ levelRequired: 1, roleName: '', roleColor: '#3b82f6' });
    setShowAddForm(false);
  };

  const sortedRoles = [...roles].sort((a, b) => a.levelRequired - b.levelRequired);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cardClass}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Roles por Nivel</h3>
            <span className="px-2 py-0.5 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-lg text-xs font-bold text-[#64748b]">
              {roles.length} roles
            </span>
          </div>
          <div className="flex items-center gap-3">
            {roles.length === 0 && (
              <button onClick={onCreateDefaults} className={`${btnPrimary} flex items-center gap-2`}>
                <Wand2 className="w-4 h-4" />
                Crear Roles Base
              </button>
            )}
            <button onClick={onSyncDiscord} className={`${btnSecondary} flex items-center gap-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151]/70 transition-colors`}>
              <RefreshCw className="w-4 h-4" />
              Sincronizar con Discord
            </button>
            {roles.length > 0 && (
              <button onClick={onSyncUsersRoles} className={`${btnPrimary} flex items-center gap-2`} title="Asigna roles a todos los usuarios segun su nivel actual">
                <RefreshCw className="w-4 h-4" />
                Sync Usuarios
              </button>
            )}
            <button onClick={onCleanupDiscord} className={`${btnSecondary} flex items-center gap-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151]/70 transition-colors text-amber-600`} title="Elimina roles con ✦ en Discord que ya no estan en la BD">
              <RefreshCw className="w-4 h-4" />
              Limpiar Discord
            </button>
            {roles.length > 0 && (
              <button onClick={onDeleteAll} className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <Trash2 className="w-4 h-4" />
                Eliminar Todos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Important notice */}
      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/50 flex gap-3">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Importante: Jerarquia de roles</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            Para que el bot pueda asignar roles, el rol <strong>"Decatron"</strong> debe estar <strong>arriba</strong> de todos los roles que quieras gestionar.
            Ve a <strong>Discord → Ajustes del servidor → Roles</strong> y arrastra el rol "Decatron" lo mas arriba posible (debajo de tu rol de Owner).
          </p>
        </div>
      </div>

      {/* Empty State */}
      {roles.length === 0 && (
        <div className={`${cardClass} text-center py-12`}>
          <Crown className="w-12 h-12 text-[#e2e8f0] dark:text-[#374151] mx-auto mb-4" />
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No hay roles configurados</h4>
          <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-6 max-w-md mx-auto">
            Crea roles base para empezar o agrega roles personalizados que se asignaran automaticamente al subir de nivel.
          </p>
          <button onClick={onCreateDefaults} className={`${btnPrimary} flex items-center gap-2 mx-auto`}>
            <Wand2 className="w-4 h-4" />
            Crear Roles Base
          </button>
        </div>
      )}

      {/* Roles List */}
      {roles.length > 0 && (
        <div className={cardClass}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                  <th className={`${labelClass} text-left pb-3 pl-2`}>Color</th>
                  <th className={`${labelClass} text-left pb-3`}>Nivel</th>
                  <th className={`${labelClass} text-left pb-3`}>Nombre</th>
                  <th className={`${labelClass} text-left pb-3`}>Estado</th>
                  <th className={`${labelClass} text-right pb-3 pr-2`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedRoles.map(role => (
                  <tr key={role.id} className="border-b border-[#e2e8f0]/50 dark:border-[#374151]/50 last:border-0">
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full border-2 border-white dark:border-[#1B1C1D] shadow-sm"
                          style={{ backgroundColor: role.roleColor }}
                        />
                        <EditableField
                          value={role.roleColor}
                          onChange={val => onUpdateRole(role.id, { roleColor: val })}
                          className="w-20 px-2 py-1 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                        />
                      </div>
                    </td>
                    <td className="py-3">
                      <EditableField
                        type="number"
                        min={1}
                        value={role.levelRequired}
                        onChange={val => onUpdateRole(role.id, { levelRequired: parseInt(val) || 1 })}
                        className="w-20 px-3 py-1.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                      />
                    </td>
                    <td className="py-3">
                      <EditableField
                        value={role.roleName}
                        onChange={val => onUpdateRole(role.id, { roleName: val })}
                        className="w-full max-w-[200px] px-3 py-1.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                      />
                    </td>
                    <td className="py-3">
                      {role.createdInDiscord ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Sincronizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <button
                        onClick={() => onDeleteRole(role.id)}
                        className="p-2 text-[#ef4444] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar rol"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Role */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className={`${btnSecondary} flex items-center gap-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151]/70 transition-colors w-full justify-center`}
        >
          <Plus className="w-4 h-4" />
          Agregar Rol
        </button>
      ) : (
        <div className={cardClass}>
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">Nuevo Rol</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                type="text"
                value={newRole.roleName}
                onChange={e => setNewRole(prev => ({ ...prev, roleName: e.target.value }))}
                placeholder="Ej: Veterano"
                className={`${inputClass} mt-2`}
              />
            </div>
            <div>
              <label className={labelClass}>Nivel requerido</label>
              <input
                type="number"
                min={1}
                value={newRole.levelRequired}
                onChange={e => setNewRole(prev => ({ ...prev, levelRequired: parseInt(e.target.value) || 1 }))}
                className={`${inputClass} mt-2`}
              />
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-10 h-10 rounded-full border-2 border-[#e2e8f0] dark:border-[#374151] shrink-0"
                  style={{ backgroundColor: newRole.roleColor }}
                />
                <input
                  type="text"
                  value={newRole.roleColor}
                  onChange={e => setNewRole(prev => ({ ...prev, roleColor: e.target.value }))}
                  placeholder="#3b82f6"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={handleAddRole} className={`${btnPrimary} flex items-center gap-2`}>
              <Plus className="w-4 h-4" />
              Agregar
            </button>
            <button onClick={() => setShowAddForm(false)} className={btnSecondary}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
