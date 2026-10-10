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

const cardClass = 'bg-ds-surface rounded-lg p-6 border border-ds-border ';
const labelClass = 'text-sm font-bold text-ds-soft ';
const inputClass = 'w-full px-4 py-2.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent';
const selectClass = `${inputClass} [&>option]:bg-ds-surface `;
const btnPrimary = 'px-4 py-2 bg-ds-accent text-ds-on-accent font-bold rounded-lg';

const itemTypeLabels: Record<string, string> = {
  custom: 'Custom',
  role_temp: 'Rol Temporal',
  channel_access: 'Acceso Canal',
  shoutout: 'Shoutout',
};

const itemTypeBadgeColors: Record<string, string> = {
  custom: 'bg-ds-accent/10 text-ds-accent-text ',
  role_temp: 'bg-ds-warn/10 text-ds-warn ',
  channel_access: 'bg-ds-ok/10 text-ds-ok ',
  shoutout: 'bg-ds-accent/10 text-ds-accent-text ',
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
            <div className="w-10 h-10 rounded-lg bg-ds-accent flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-ds-on-accent" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ds-text">XP Store</h3>
              <p className="text-sm text-ds-soft">
                {storeItems.length} {storeItems.length === 1 ? 'item' : 'items'} disponibles
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`${btnPrimary} flex items-center gap-2 transition-shadow`}
          >
            <Plus className="w-4 h-4" />
            Crear Item
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className={cardClass}>
          <h4 className="text-base font-bold text-ds-text mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-ds-accent-text" />
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
              <div className="p-3 bg-ds-warn/10 rounded-lg border border-ds-warn/40">
                <p className="text-xs text-ds-warn">
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
              <p className="text-xs text-ds-soft mt-1 mb-2">Variables: {'{user}'} = nombre, {'{mention}'} = @mencion, {'{item}'} = nombre del item</p>
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
              <p className="text-xs text-ds-soft mt-1 mb-2">Donde se anuncia la compra</p>
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
            <button onClick={handleSubmit} className={`${btnPrimary} transition-shadow`}>
              {editingId ? 'Guardar Cambios' : 'Crear Item'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-bold text-ds-soft hover:text-ds-text transition-colors"
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
            <ShoppingBag className="w-12 h-12 mx-auto text-ds-soft mb-3 opacity-50" />
            <p className="text-base font-bold text-ds-text mb-1">Sin items en la tienda</p>
            <p className="text-sm text-ds-soft">
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
                    <p className="text-sm font-bold text-ds-text truncate">{item.name}</p>
                    {!item.enabled && (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-ds-danger/10 text-ds-danger">
                        Desactivado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ds-soft mb-3 line-clamp-2">{item.description}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-ds-accent/10 text-ds-accent-text">
                      {item.cost.toLocaleString()} XP
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${itemTypeBadgeColors[item.itemType] || itemTypeBadgeColors.custom}`}>
                      {itemTypeLabels[item.itemType] || item.itemType}
                    </span>
                    {['role_temp', 'channel_access'].includes(item.itemType) && item.durationHours && (
                      <span className="px-3 py-1 rounded-lg text-xs font-bold bg-ds-accent/10 text-ds-accent-text flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(item.durationHours)}
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-ds-bg text-ds-soft">
                      {item.maxStock === 0
                        ? 'Ilimitado'
                        : `${item.currentStock}/${item.maxStock}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-ds-border">
                <button
                  onClick={() => handleToggleEnabled(item)}
                  className="flex items-center gap-1.5 text-xs font-bold text-ds-soft hover:text-ds-accent-text transition-colors"
                  title={item.enabled ? 'Desactivar' : 'Activar'}
                >
                  {item.enabled ? (
                    <ToggleRight className="w-5 h-5 text-ds-accent-text" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-ds-soft" />
                  )}
                  {item.enabled ? 'Activo' : 'Inactivo'}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => startEdit(item)}
                  className="p-2 rounded-lg text-ds-accent-text hover:bg-ds-accent/10 transition-colors"
                  title="Editar item"
                >
                  <Package className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { if (window.confirm(`Eliminar "${item.name}"?`)) onDeleteItem(item.id); }}
                  className="p-2 rounded-lg text-ds-danger hover:text-ds-danger hover:bg-ds-danger/10 transition-colors"
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
          <h4 className="text-base font-bold text-ds-text mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-ds-accent-text" />
            Canjes Pendientes ({pendingPurchases.length})
          </h4>
          <div className="space-y-2">
            {pendingPurchases.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-ds-warn/10 border border-ds-warn/40">
                <span className="text-lg">{p.itemIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ds-text">{p.username}</p>
                  <p className="text-xs text-ds-soft">{p.itemName} — {p.costPaid} XP</p>
                </div>
                <span className="text-xs text-ds-warn font-bold">Pendiente</span>
                {onDeliverPurchase && (
                  <button
                    onClick={() => onDeliverPurchase(p.id)}
                    className="ds-btn ds-btn--primary ds-btn--sm"
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
            <h4 className="text-base font-bold text-ds-text">Compras Recientes</h4>
            {onResetAllPurchases && (
              <button
                onClick={onResetAllPurchases}
                className="px-3 py-1.5 text-xs font-bold text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-colors border border-ds-danger/40"
              >
                Reset Historial
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ds-border">
                  <th className="text-left py-2 px-3 text-xs font-bold text-ds-soft uppercase tracking-wider">Usuario</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-ds-soft uppercase tracking-wider">Item</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-ds-soft uppercase tracking-wider">Costo</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-ds-soft uppercase tracking-wider">Fecha</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-ds-soft uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id} className="border-b border-ds-border/50 last:border-0">
                    <td className="py-2.5 px-3 text-ds-text font-medium">{p.username}</td>
                    <td className="py-2.5 px-3 text-ds-soft">{p.itemName || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-ds-accent-text">{p.costPaid.toLocaleString()} XP</td>
                    <td className="py-2.5 px-3 text-right text-ds-soft">{formatDate(p.purchasedAt)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {onResetUserPurchases && (
                        <button
                          onClick={() => { if (window.confirm(`Resetear compras de ${p.username}?`)) onResetUserPurchases(p.userId); }}
                          className="text-xs text-ds-danger hover:text-ds-danger font-bold"
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
