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

const cardClass = 'bg-ds-surface rounded-lg p-6 border border-ds-border ';
const labelClass = 'text-sm font-bold text-ds-soft ';
const inputClass = 'w-full px-4 py-2.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent';
const btnPrimary = 'px-4 py-2 bg-ds-accent text-ds-on-accent font-bold rounded-lg';
const btnSecondary = 'px-4 py-2 bg-ds-bg text-ds-soft font-medium rounded-lg border border-ds-border ';

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
            <Crown className="w-5 h-5 text-ds-accent-text" />
            <h3 className="text-lg font-black text-ds-text">Roles por Nivel</h3>
            <span className="px-2 py-0.5 bg-ds-bg rounded-lg text-xs font-bold text-ds-soft">
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
            <button onClick={onSyncDiscord} className={`${btnSecondary} flex items-center gap-2 hover:bg-ds-raised transition-colors`}>
              <RefreshCw className="w-4 h-4" />
              Sincronizar con Discord
            </button>
            {roles.length > 0 && (
              <button onClick={onSyncUsersRoles} className={`${btnPrimary} flex items-center gap-2`} title="Asigna roles a todos los usuarios segun su nivel actual">
                <RefreshCw className="w-4 h-4" />
                Sync Usuarios
              </button>
            )}
            <button onClick={onCleanupDiscord} className={`${btnSecondary} flex items-center gap-2 hover:bg-ds-raised transition-colors text-ds-warn`} title="Elimina roles con ✦ en Discord que ya no estan en la BD">
              <RefreshCw className="w-4 h-4" />
              Limpiar Discord
            </button>
            {roles.length > 0 && (
              <button onClick={onDeleteAll} className="px-4 py-2 bg-ds-danger/10 text-ds-danger font-bold rounded-lg border border-ds-danger/40 flex items-center gap-2 hover:bg-ds-danger/10 transition-colors">
                <Trash2 className="w-4 h-4" />
                Eliminar Todos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Important notice */}
      <div className="bg-ds-warn/10 rounded-lg p-4 border border-ds-warn/40 flex gap-3">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-bold text-ds-warn">Importante: Jerarquia de roles</p>
          <p className="text-xs text-ds-warn mt-1">
            Para que el bot pueda asignar roles, el rol <strong>"Decatron"</strong> debe estar <strong>arriba</strong> de todos los roles que quieras gestionar.
            Ve a <strong>Discord → Ajustes del servidor → Roles</strong> y arrastra el rol "Decatron" lo mas arriba posible (debajo de tu rol de Owner).
          </p>
        </div>
      </div>

      {/* Empty State */}
      {roles.length === 0 && (
        <div className={`${cardClass} text-center py-12`}>
          <Crown className="w-12 h-12 text-ds-text mx-auto mb-4" />
          <h4 className="text-lg font-bold text-ds-text mb-2">No hay roles configurados</h4>
          <p className="text-sm text-ds-soft mb-6 max-w-md mx-auto">
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
                <tr className="border-b border-ds-border">
                  <th className={`${labelClass} text-left pb-3 pl-2`}>Color</th>
                  <th className={`${labelClass} text-left pb-3`}>Nivel</th>
                  <th className={`${labelClass} text-left pb-3`}>Nombre</th>
                  <th className={`${labelClass} text-left pb-3`}>Estado</th>
                  <th className={`${labelClass} text-right pb-3 pr-2`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedRoles.map(role => (
                  <tr key={role.id} className="border-b border-ds-border/50 last:border-0">
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full border-2 border-ds-border"
                          style={{ backgroundColor: role.roleColor }}
                        />
                        <EditableField
                          value={role.roleColor}
                          onChange={val => onUpdateRole(role.id, { roleColor: val })}
                          className="w-20 px-2 py-1 bg-ds-bg border border-ds-border rounded-lg text-xs text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent"
                        />
                      </div>
                    </td>
                    <td className="py-3">
                      <EditableField
                        type="number"
                        min={1}
                        value={role.levelRequired}
                        onChange={val => onUpdateRole(role.id, { levelRequired: parseInt(val) || 1 })}
                        className="w-20 px-3 py-1.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent"
                      />
                    </td>
                    <td className="py-3">
                      <EditableField
                        value={role.roleName}
                        onChange={val => onUpdateRole(role.id, { roleName: val })}
                        className="w-full max-w-[200px] px-3 py-1.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent"
                      />
                    </td>
                    <td className="py-3">
                      {role.createdInDiscord ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-ds-ok/10 text-ds-ok">
                          Sincronizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-ds-warn/10 text-ds-warn">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <button
                        onClick={() => onDeleteRole(role.id)}
                        className="p-2 text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-colors"
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
          className={`${btnSecondary} flex items-center gap-2 hover:bg-ds-raised transition-colors w-full justify-center`}
        >
          <Plus className="w-4 h-4" />
          Agregar Rol
        </button>
      ) : (
        <div className={cardClass}>
          <h4 className="text-base font-bold text-ds-text mb-4">Nuevo Rol</h4>
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
                  className="w-10 h-10 rounded-full border-2 border-ds-border shrink-0"
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
