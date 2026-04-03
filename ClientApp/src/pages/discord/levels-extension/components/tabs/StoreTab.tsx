import { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Trash2, Package, Clock, ToggleLeft, ToggleRight } from 'lucide-react';

interface StoreItem {
  id: number;
  name: string;
  description: string;
  icon: string;
  cost: number;
  itemType: string;
  durationHours: number | null;
  maxStock: number;
  currentStock: number;
  enabled: boolean;
}

interface StorePurchase {
  id: number;
  userId: string;
  username: string;
  costPaid: number;
  purchasedAt: string;
  itemName?: string;
}

interface DiscordChannel {
  id: string;
  name: string;
}

interface DiscordRole {
  id: string;
  name: string;
}

interface StoreTabProps {
  guildId: string;
  storeItems: StoreItem[];
  purchases: StorePurchase[];
  channels: DiscordChannel[];
  roles: DiscordRole[];
  onCreateItem: (data: any) => void;
  onUpdateItem: (id: number, data: any) => void;
  onDeleteItem: (id: number) => void;
  onLoadPurchases: () => void;
  onResetAllPurchases?: () => void;
  onResetUserPurchases?: (userId: string) => void;
  onDeliverPurchase?: (purchaseId: number) => void;
  pendingPurchases?: any[];
  onLoadPending?: () => void;
}

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const labelClass = 'text-sm font-bold text-gray-700 dark:text-gray-300';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent';
const selectClass = `${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`;
const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-bold rounded-xl';

const itemTypeLabels: Record<string, string> = {
  custom: 'Custom',
  role_temp: 'Rol Temporal',
  channel_access: 'Acceso Canal',
  shoutout: 'Shoutout',
};

const itemTypeBadgeColors: Record<string, string> = {
  custom: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  role_temp: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  channel_access: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  shoutout: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
};

export default function StoreTab({
  guildId,
  storeItems,
  purchases,
  channels,
  roles,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onLoadPurchases,
  onResetAllPurchases,
  onResetUserPurchases,
  onDeliverPurchase,
  pendingPurchases = [],
  onLoadPending,
}: StoreTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    icon: '🎁',
    name: '',
    description: '',
    cost: 100,
    itemType: 'custom',
    durationValue: 1,
    durationUnit: 'days' as string,
    maxStock: 0,
    roleId: '',
    channelId: '',
    announcementChannelId: '',
    customMessage: '',
  });

  const durationUnits = [
    { value: 'minutes', label: 'Minutos' },
    { value: 'hours', label: 'Horas' },
    { value: 'days', label: 'Dias' },
    { value: 'weeks', label: 'Semanas' },
    { value: 'months', label: 'Meses' },
  ];

  const toHours = (value: number, unit: string): number => {
    switch (unit) {
      case 'minutes': return value / 60;
      case 'hours': return value;
      case 'days': return value * 24;
      case 'weeks': return value * 24 * 7;
      case 'months': return value * 24 * 30;
      default: return value;
    }
  };

  const fromHours = (hours: number): { value: number; unit: string } => {
    if (hours < 1) return { value: Math.round(hours * 60), unit: 'minutes' };
    if (hours < 24) return { value: hours, unit: 'hours' };
    if (hours < 168) return { value: Math.round(hours / 24), unit: 'days' };
    if (hours < 720) return { value: Math.round(hours / 168), unit: 'weeks' };
    return { value: Math.round(hours / 720), unit: 'months' };
  };

  const formatDuration = (hours: number | null): string => {
    if (!hours) return '';
    const { value, unit } = fromHours(hours);
    const labels: Record<string, string> = { minutes: 'min', hours: 'h', days: 'd', weeks: 'sem', months: 'mes' };
    return `${value} ${labels[unit] || unit}`;
  };

  useEffect(() => {
    onLoadPurchases();
    onLoadPending?.();
  }, []);

  const startEdit = (item: StoreItem & { roleId?: string; channelId?: string; announcementChannelId?: string }) => {
    const dur = item.durationHours ? fromHours(item.durationHours) : { value: 1, unit: 'days' };
    setFormData({
      icon: item.icon,
      name: item.name,
      description: item.description,
      cost: item.cost,
      itemType: item.itemType,
      durationValue: dur.value,
      durationUnit: dur.unit,
      maxStock: item.maxStock,
      roleId: (item as any).roleId || '',
      channelId: (item as any).channelId || '',
      announcementChannelId: (item as any).announcementChannelId || '',
      customMessage: (item as any).customMessage || '',
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.icon.trim()) return;
    const durationHours = ['role_temp', 'channel_access'].includes(formData.itemType)
      ? toHours(formData.durationValue, formData.durationUnit)
      : null;

    if (editingId) {
      onUpdateItem(editingId, {
        icon: formData.icon,
        name: formData.name,
        description: formData.description,
        cost: formData.cost,
        enabled: true,
        durationHours,
        maxStock: formData.maxStock,
        roleId: formData.itemType === 'role_temp' ? formData.roleId || null : null,
        channelId: formData.itemType === 'channel_access' ? formData.channelId || null : null,
        announcementChannelId: formData.announcementChannelId || null,
        customMessage: formData.customMessage || null,
      });
      setEditingId(null);
      setFormData({ icon: '🎁', name: '', description: '', cost: 100, itemType: 'custom', durationValue: 1, durationUnit: 'days', maxStock: 0, roleId: '', channelId: '', announcementChannelId: '', customMessage: '' });
      setShowForm(false);
      return;
    }

    onCreateItem({
      icon: formData.icon,
      name: formData.name,
      description: formData.description,
      cost: formData.cost,
      itemType: formData.itemType,
      durationHours,
      maxStock: formData.maxStock,
      roleId: formData.itemType === 'role_temp' ? formData.roleId || null : null,
      channelId: formData.itemType === 'channel_access' ? formData.channelId || null : null,
      announcementChannelId: formData.announcementChannelId || null,
      customMessage: formData.customMessage || null,
    });
    setFormData({ icon: '🎁', name: '', description: '', cost: 100, itemType: 'custom', durationValue: 1, durationUnit: 'days', maxStock: 0, roleId: '', channelId: '', announcementChannelId: '', customMessage: '' });
    setShowForm(false);
  };

  const handleCancel = () => {
    setFormData({ icon: '🎁', name: '', description: '', cost: 100, itemType: 'custom', durationValue: 1, durationUnit: 'days', maxStock: 0, roleId: '', channelId: '', announcementChannelId: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleToggleEnabled = (item: StoreItem) => {
    onUpdateItem(item.id, { ...item, enabled: !item.enabled });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#7c3aed] flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">XP Store</h3>
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                {storeItems.length} {storeItems.length === 1 ? 'item' : 'items'} disponibles
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`${btnPrimary} flex items-center gap-2 hover:shadow-lg transition-shadow`}
          >
            <Plus className="w-4 h-4" />
            Crear Item
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className={cardClass}>
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#2563eb]" />
            {editingId ? 'Editar Item' : 'Nuevo Item'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Icono (emoji)</label>
              <input
                type="text"
                className={`${inputClass} mt-1`}
                value={formData.icon}
                onChange={e => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🎁"
                maxLength={4}
              />
            </div>
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                type="text"
                className={`${inputClass} mt-1`}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre del item"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Descripcion</label>
              <input
                type="text"
                className={`${inputClass} mt-1`}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripcion del item..."
              />
            </div>
            <div>
              <label className={labelClass}>Costo (XP)</label>
              <input
                type="number"
                className={`${inputClass} mt-1`}
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: Math.max(1, parseInt(e.target.value) || 1) })}
                min={1}
              />
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <select
                className={`${selectClass} mt-1`}
                value={formData.itemType}
                onChange={e => setFormData({ ...formData, itemType: e.target.value })}
              >
                <option value="custom">Custom</option>
                <option value="role_temp">Rol Temporal</option>
                <option value="channel_access">Acceso Canal</option>
                <option value="shoutout">Shoutout</option>
              </select>
            </div>
            {['role_temp', 'channel_access'].includes(formData.itemType) && (
              <div>
                <label className={labelClass}>Duracion</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    className={`${inputClass} w-24`}
                    value={formData.durationValue}
                    onChange={e => setFormData({ ...formData, durationValue: Math.max(1, parseInt(e.target.value) || 1) })}
                    min={1}
                  />
                  <select
                    value={formData.durationUnit}
                    onChange={e => setFormData({ ...formData, durationUnit: e.target.value })}
                    className={selectClass}
                  >
                    {durationUnits.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className={labelClass}>Stock (0 = ilimitado)</label>
              <input
                type="number"
                className={`${inputClass} mt-1`}
                value={formData.maxStock}
                onChange={e => setFormData({ ...formData, maxStock: Math.max(0, parseInt(e.target.value) || 0) })}
                min={0}
              />
            </div>
          </div>

          {/* Conditional fields based on type */}
          {formData.itemType === 'role_temp' && (
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Importante:</strong> El rol "Decatron" debe estar arriba del rol que quieras asignar en la jerarquia de Discord.
                </p>
              </div>
              <label className={labelClass}>Rol a asignar</label>
              <select
                value={formData.roleId}
                onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                className={`${selectClass} mt-1`}
              >
                <option value="">Seleccionar rol...</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.itemType === 'channel_access' && (
            <div className="mt-4">
              <label className={labelClass}>Canal a dar acceso</label>
              <select
                value={formData.channelId}
                onChange={e => setFormData({ ...formData, channelId: e.target.value })}
                className={`${selectClass} mt-1`}
              >
                <option value="">Seleccionar canal...</option>
                {channels.map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            </div>
          )}

          {['shoutout', 'custom'].includes(formData.itemType) && (
            <div className="mt-4">
              <label className={labelClass}>Mensaje personalizado</label>
              <p className="text-xs text-[#64748b] mt-1 mb-2">Variables: {'{user}'} = nombre, {'{mention}'} = @mencion, {'{item}'} = nombre del item</p>
              <input
                type="text"
                value={formData.customMessage || ''}
                onChange={e => setFormData({ ...formData, customMessage: e.target.value })}
                placeholder={formData.itemType === 'shoutout' ? 'Sigan a {mention}! Es un crack!' : 'Gracias {user} por canjear {item}!'}
                className={inputClass}
              />
            </div>
          )}

          {['shoutout', 'role_temp', 'channel_access', 'custom'].includes(formData.itemType) && (
            <div className="mt-4">
              <label className={labelClass}>Canal de anuncio</label>
              <p className="text-xs text-[#64748b] mt-1 mb-2">Donde se anuncia la compra</p>
              <select
                value={formData.announcementChannelId}
                onChange={e => setFormData({ ...formData, announcementChannelId: e.target.value })}
                className={`${selectClass}`}
              >
                <option value="">Sin anuncio</option>
                {channels.map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 mt-5">
            <button onClick={handleSubmit} className={`${btnPrimary} hover:shadow-lg transition-shadow`}>
              {editingId ? 'Guardar Cambios' : 'Crear Item'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Items List */}
      {storeItems.length === 0 ? (
        <div className={cardClass}>
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 mx-auto text-[#64748b] dark:text-[#94a3b8] mb-3 opacity-50" />
            <p className="text-base font-bold text-gray-900 dark:text-white mb-1">Sin items en la tienda</p>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
              Crea tu primer item para que los usuarios gasten su XP.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {storeItems.map(item => (
            <div key={item.id} className={`${cardClass} relative`}>
              <div className="flex items-start gap-4">
                <span className="text-3xl flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                    {!item.enabled && (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                        Desactivado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3 line-clamp-2">{item.description}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#2563eb]/10 text-[#2563eb] dark:bg-[#2563eb]/20 dark:text-[#60a5fa]">
                      {item.cost.toLocaleString()} XP
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${itemTypeBadgeColors[item.itemType] || itemTypeBadgeColors.custom}`}>
                      {itemTypeLabels[item.itemType] || item.itemType}
                    </span>
                    {['role_temp', 'channel_access'].includes(item.itemType) && item.durationHours && (
                      <span className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(item.durationHours)}
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-300">
                      {item.maxStock === 0
                        ? 'Ilimitado'
                        : `${item.currentStock}/${item.maxStock}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                <button
                  onClick={() => handleToggleEnabled(item)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition-colors"
                  title={item.enabled ? 'Desactivar' : 'Activar'}
                >
                  {item.enabled ? (
                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                  )}
                  {item.enabled ? 'Activo' : 'Inactivo'}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => startEdit(item)}
                  className="p-2 rounded-lg text-[#2563eb] hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                  title="Editar item"
                >
                  <Package className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (window.confirm(`Eliminar "${item.name}"?`)) onDeleteItem(item.id); }}
                  className="p-2 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title="Eliminar item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Purchases */}
      {/* Pending deliveries */}
      {pendingPurchases.length > 0 && (
        <div className={cardClass}>
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Canjes Pendientes ({pendingPurchases.length})
          </h4>
          <div className="space-y-2">
            {pendingPurchases.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                <span className="text-lg">{p.itemIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{p.username}</p>
                  <p className="text-xs text-[#64748b]">{p.itemName} — {p.costPaid} XP</p>
                </div>
                <span className="text-xs text-amber-600 font-bold">Pendiente</span>
                {onDeliverPurchase && (
                  <button
                    onClick={() => onDeliverPurchase(p.id)}
                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    Entregar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {purchases.length > 0 && (
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-gray-900 dark:text-white">Compras Recientes</h4>
            {onResetAllPurchases && (
              <button
                onClick={onResetAllPurchases}
                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
              >
                Reset Historial
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                  <th className="text-left py-2 px-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Usuario</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Item</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Costo</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Fecha</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id} className="border-b border-[#e2e8f0]/50 dark:border-[#374151]/50 last:border-0">
                    <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">{p.username}</td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{p.itemName || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#2563eb] dark:text-[#60a5fa]">{p.costPaid.toLocaleString()} XP</td>
                    <td className="py-2.5 px-3 text-right text-[#64748b] dark:text-[#94a3b8]">{formatDate(p.purchasedAt)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {onResetUserPurchases && (
                        <button
                          onClick={() => { if (window.confirm(`Resetear compras de ${p.username}?`)) onResetUserPurchases(p.userId); }}
                          className="text-xs text-red-500 hover:text-red-700 font-bold"
                          title={`Reset compras de ${p.username}`}
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
