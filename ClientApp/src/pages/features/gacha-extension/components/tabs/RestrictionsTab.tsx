import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Shield, X, DollarSign, Clock, Fingerprint } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaItemRestriction, GachaItem } from '../../types';
import { RARITY_CONFIG, getRarityStars } from '../../types';

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent';
const labelClass = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]';

const COOLDOWN_PERIODS = [
    { value: 'none', label: 'Sin cooldown' },
    { value: 'minutes', label: 'Minutos' },
    { value: 'hours', label: 'Horas' },
    { value: 'days', label: 'Dias' },
    { value: 'months', label: 'Meses' },
];

interface RestrictionForm {
    itemId: number;
    minDonationRequired: number;
    totalQuantity: string;
    isUnique: boolean;
    cooldownPeriod: string;
    cooldownValue: number;
}

const emptyForm: RestrictionForm = { itemId: 0, minDonationRequired: 0, totalQuantity: '', isUnique: false, cooldownPeriod: 'none', cooldownValue: 0 };

export const RestrictionsTab: React.FC = () => {
    const [restrictions, setRestrictions] = useState<GachaItemRestriction[]>([]);
    const [items, setItems] = useState<GachaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<RestrictionForm>(emptyForm);
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            const [resR, resI] = await Promise.all([
                api.get('/gacha/restrictions'),
                api.get('/gacha/items'),
            ]);
            setRestrictions(resR.data.restrictions || []);
            setItems(resI.data.items || []);
        } catch (err) {
            console.error('Error loading restrictions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const getItem = (id: number) => items.find(i => i.id === id);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm, itemId: items[0]?.id ?? 0 });
        setShowModal(true);
    };

    const openEdit = (r: GachaItemRestriction) => {
        setEditingId(r.id);
        setForm({
            itemId: r.itemId,
            minDonationRequired: r.minDonationRequired,
            totalQuantity: r.totalQuantity != null ? String(r.totalQuantity) : '',
            isUnique: r.isUnique,
            cooldownPeriod: r.cooldownPeriod || 'none',
            cooldownValue: r.cooldownValue || 0,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.itemId) return;
        setSaving(true);
        const payload = {
            ...form,
            totalQuantity: form.totalQuantity ? Number(form.totalQuantity) : null,
            cooldownPeriod: form.cooldownPeriod === 'none' ? null : form.cooldownPeriod,
            cooldownValue: form.cooldownPeriod === 'none' ? 0 : form.cooldownValue,
        };
        try {
            if (editingId) {
                await api.put(`/gacha/restrictions/${editingId}`, payload);
            } else {
                await api.post('/gacha/restrictions', payload);
            }
            setShowModal(false);
            await loadData();
        } catch (err) {
            console.error('Error saving restriction:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Eliminar esta restriccion?')) return;
        try {
            await api.delete(`/gacha/restrictions/${id}`);
            await loadData();
        } catch (err) {
            console.error('Error deleting restriction:', err);
        }
    };

    if (loading) {
        return <div className={cardClass}><p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando restricciones...</p></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Shield className="w-5 h-5" /> Restricciones ({restrictions.length})
                </h2>
                <button onClick={openCreate} disabled={items.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                    <Plus className="w-4 h-4" /> Agregar Restriccion
                </button>
            </div>

            {restrictions.length === 0 ? (
                <div className={cardClass}>
                    <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-12">No hay restricciones configuradas.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {restrictions.map(r => {
                        const item = r.item || getItem(r.itemId);
                        const rc = item ? RARITY_CONFIG[item.rarity] : null;
                        return (
                            <div key={r.id} className={`${cardClass} flex items-center gap-4`}>
                                {item?.image ? (
                                    <img src={item.image} alt={item.name} className="w-14 h-14 rounded-xl object-cover" />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-[#f1f5f9] dark:bg-[#374151] flex items-center justify-center">
                                        <Shield className="w-6 h-6 text-[#94a3b8]" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{item?.name ?? `Item #${r.itemId}`}</span>
                                        {rc && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: rc.bg, color: rc.color }}>
                                                {getRarityStars(item!.rarity)} {rc.label}
                                            </span>
                                        )}
                                        {r.isUnique && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center gap-1">
                                                <Fingerprint className="w-3 h-3" /> Unico
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> ${r.minDonationRequired.toFixed(2)}</span>
                                        <span>Cantidad: {r.totalQuantity != null ? r.totalQuantity : 'Ilimitado'}</span>
                                        {r.cooldownPeriod && r.cooldownPeriod !== 'none' && (
                                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {r.cooldownValue} {r.cooldownPeriod}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(r)} className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">{editingId ? 'Editar Restriccion' : 'Nueva Restriccion'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 text-[#64748b] hover:text-red-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className={labelClass}>Item</label>
                                <select className={`${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`} value={form.itemId} onChange={e => setForm({ ...form, itemId: Number(e.target.value) })}>
                                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Donacion minima ($)</label>
                                <input type="number" step="0.01" min="0" className={inputClass} value={form.minDonationRequired} onChange={e => setForm({ ...form, minDonationRequired: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className={labelClass}>Cantidad total (vacio = ilimitado)</label>
                                <input type="number" min="1" className={inputClass} value={form.totalQuantity} onChange={e => setForm({ ...form, totalQuantity: e.target.value })} placeholder="Ilimitado" />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className={labelClass}>Unico por participante</label>
                                <button onClick={() => setForm({ ...form, isUnique: !form.isUnique })} className={`w-12 h-6 rounded-full transition-colors ${form.isUnique ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isUnique ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            <div>
                                <label className={labelClass}>Cooldown</label>
                                <select className={`${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`} value={form.cooldownPeriod} onChange={e => setForm({ ...form, cooldownPeriod: e.target.value })}>
                                    {COOLDOWN_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                            {form.cooldownPeriod !== 'none' && (
                                <div>
                                    <label className={labelClass}>Valor cooldown</label>
                                    <input type="number" min="1" className={inputClass} value={form.cooldownValue} onChange={e => setForm({ ...form, cooldownValue: Number(e.target.value) })} />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#e2e8f0] dark:border-[#374151] rounded-xl font-bold text-[#64748b] hover:bg-gray-50 dark:hover:bg-[#374151]/50 transition-colors">Cancelar</button>
                            <button onClick={handleSave} disabled={saving || !form.itemId} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
