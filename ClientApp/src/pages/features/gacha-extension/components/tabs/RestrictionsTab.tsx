import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Shield, X, DollarSign, Clock, Fingerprint, GripVertical, Trophy, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
    allowedPullTypes: 'all' | 'donation_only' | 'coins_only';
    coinMinSpent: string;
    cumulativeDonationThreshold: string;
    cumulativeCoinsThreshold: string;
    cumulativeGuarantee: boolean;
    cumulativeProbability: string;
    milestonePriority: number;
}

const emptyForm: RestrictionForm = {
    itemId: 0, minDonationRequired: 0, totalQuantity: '', isUnique: false,
    cooldownPeriod: 'none', cooldownValue: 0, allowedPullTypes: 'all',
    coinMinSpent: '', cumulativeDonationThreshold: '', cumulativeCoinsThreshold: '',
    cumulativeGuarantee: true, cumulativeProbability: '', milestonePriority: 0
};

const PULL_TYPE_OPTIONS = [
    { value: 'all', label: 'Todos los tiros' },
    { value: 'donation_only', label: 'Solo donacion' },
    { value: 'coins_only', label: 'Solo coins' },
];

export const RestrictionsTab: React.FC = () => {
    const [restrictions, setRestrictions] = useState<GachaItemRestriction[]>([]);
    const [items, setItems] = useState<GachaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<RestrictionForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [savingOrder, setSavingOrder] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

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
            allowedPullTypes: r.allowedPullTypes || 'all',
            coinMinSpent: r.coinMinSpent != null ? String(r.coinMinSpent) : '',
            cumulativeDonationThreshold: r.cumulativeDonationThreshold != null ? String(r.cumulativeDonationThreshold) : '',
            cumulativeCoinsThreshold: r.cumulativeCoinsThreshold != null ? String(r.cumulativeCoinsThreshold) : '',
            cumulativeGuarantee: r.cumulativeGuarantee ?? true,
            cumulativeProbability: r.cumulativeProbability != null ? String(r.cumulativeProbability) : '',
            milestonePriority: r.milestonePriority ?? 0,
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
            coinMinSpent: form.coinMinSpent ? Number(form.coinMinSpent) : null,
            cumulativeDonationThreshold: form.cumulativeDonationThreshold ? Number(form.cumulativeDonationThreshold) : null,
            cumulativeCoinsThreshold: form.cumulativeCoinsThreshold ? Number(form.cumulativeCoinsThreshold) : null,
            cumulativeProbability: form.cumulativeProbability ? Number(form.cumulativeProbability) : null,
            milestonePriority: form.milestonePriority,
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

            {/* Help Banner */}
            <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-[#94a3b8] flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Como funcionan las restricciones</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-[#94a3b8]" /> : <ChevronDown className="w-4 h-4 text-[#94a3b8]" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Cada carta puede tener <strong className="text-[#1e293b] dark:text-[#f8fafc]">restricciones</strong> que controlan quien puede ganarla</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span><strong className="text-[#1e293b] dark:text-[#f8fafc]">Min Donado</strong> — el viewer debe haber donado al menos esta cantidad en total para que la carta aparezca</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span><strong className="text-[#1e293b] dark:text-[#f8fafc]">Milestone</strong> — sistema oculto que acumula progreso con cada donacion. Al llegar al threshold, la carta es garantizada</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span><strong className="text-[#1e293b] dark:text-[#f8fafc]">Unico</strong> — el viewer solo puede ganar esta carta una vez</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">5</span>
                            <span><strong className="text-[#1e293b] dark:text-[#f8fafc]">Cooldown</strong> — tiempo de espera entre wins de la misma carta</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-[#e2e8f0] dark:bg-[#374151] text-xs">
                            <strong className="text-[#1e293b] dark:text-[#f8fafc]">Tip:</strong> El milestone es invisible para los viewers. Solo tu ves el progreso en el tab Participantes. Usa "Orden de Milestones" abajo para controlar cual se activa primero.
                        </div>
                    </div>
                )}
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
                                    <div className="flex items-center gap-3 mt-1 text-sm text-[#64748b] dark:text-[#94a3b8] flex-wrap">
                                        <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> ${r.minDonationRequired.toFixed(2)}</span>
                                        <span>Qty: {r.totalQuantity != null ? r.totalQuantity : '∞'}</span>
                                        {r.cooldownPeriod && r.cooldownPeriod !== 'none' && (
                                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {r.cooldownValue} {r.cooldownPeriod}</span>
                                        )}
                                        {r.allowedPullTypes !== 'all' && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.allowedPullTypes === 'donation_only' ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-300' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300'}`}>
                                                {r.allowedPullTypes === 'donation_only' ? 'Solo Donacion' : 'Solo Coins'}
                                            </span>
                                        )}
                                        {r.cumulativeDonationThreshold != null && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300">
                                                Milestone ${r.cumulativeDonationThreshold} {r.cumulativeGuarantee ? '→ Garantizado' : `→ ${r.cumulativeProbability}%`}
                                            </span>
                                        )}
                                        {r.cumulativeCoinsThreshold != null && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
                                                Milestone {r.cumulativeCoinsThreshold} coins {r.cumulativeGuarantee ? '→ Garantizado' : `→ ${r.cumulativeProbability}%`}
                                            </span>
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

            {/* Milestone Priority Order */}
            {(() => {
                const milestones = restrictions
                    .filter(r => r.cumulativeDonationThreshold != null || r.cumulativeCoinsThreshold != null)
                    .sort((a, b) => (a.milestonePriority ?? 0) - (b.milestonePriority ?? 0));

                if (milestones.length < 2) return null;

                const handleDragStart = (idx: number) => setDragIdx(idx);
                const handleDragOver = (e: React.DragEvent, idx: number) => {
                    e.preventDefault();
                    if (dragIdx === null || dragIdx === idx) return;
                    const reordered = [...milestones];
                    const [moved] = reordered.splice(dragIdx, 1);
                    reordered.splice(idx, 0, moved);
                    const ids = reordered.map(r => r.id);
                    // Update priorities locally
                    setRestrictions(prev => prev.map(r => {
                        const newPrio = ids.indexOf(r.id);
                        return newPrio >= 0 ? { ...r, milestonePriority: newPrio } : r;
                    }));
                    setDragIdx(idx);
                };
                const handleDragEnd = async () => {
                    setDragIdx(null);
                    const ordered = restrictions
                        .filter(r => r.cumulativeDonationThreshold != null || r.cumulativeCoinsThreshold != null)
                        .sort((a, b) => (a.milestonePriority ?? 0) - (b.milestonePriority ?? 0));
                    setSavingOrder(true);
                    try {
                        await api.put('/gacha/restrictions/reorder-milestones', ordered.map(r => r.id));
                    } catch (err) {
                        console.error('Error saving milestone order:', err);
                    } finally {
                        setSavingOrder(false);
                    }
                };

                return (
                    <div className={`${cardClass} space-y-3`}>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Orden de Milestones</h3>
                            {savingOrder && <span className="text-xs text-blue-500 font-bold animate-pulse">Guardando...</span>}
                        </div>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            Arrastra para cambiar el orden en que se activan los milestones. El primero se activa antes.
                        </p>
                        <div className="space-y-2">
                            {milestones.map((r, idx) => {
                                const item = r.item || getItem(r.itemId);
                                const rc = item ? RARITY_CONFIG[item.rarity] : null;
                                return (
                                    <div
                                        key={r.id}
                                        draggable
                                        onDragStart={() => handleDragStart(idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDragEnd={handleDragEnd}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing transition-all ${
                                            dragIdx === idx
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 opacity-70'
                                                : 'border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]'
                                        }`}
                                    >
                                        <GripVertical className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
                                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                            {idx + 1}
                                        </span>
                                        {item?.image ? (
                                            <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-lg bg-[#e2e8f0] dark:bg-[#374151] flex items-center justify-center flex-shrink-0">
                                                <Trophy className="w-4 h-4 text-[#94a3b8]" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc] truncate block">
                                                {item?.name ?? `Item #${r.itemId}`}
                                            </span>
                                            <div className="flex gap-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                {r.cumulativeDonationThreshold != null && <span>${r.cumulativeDonationThreshold}</span>}
                                                {r.cumulativeCoinsThreshold != null && <span>{r.cumulativeCoinsThreshold} coins</span>}
                                                <span>{r.cumulativeGuarantee ? '→ Garantizado' : `→ ${r.cumulativeProbability}%`}</span>
                                            </div>
                                        </div>
                                        {rc && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0" style={{ backgroundColor: rc.bg, color: rc.color }}>
                                                {rc.label}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
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

                            {/* Pull Type */}
                            <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#374151]">
                                <label className={labelClass}>Tipo de tiro permitido</label>
                                <select className={`${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`} value={form.allowedPullTypes} onChange={e => setForm({ ...form, allowedPullTypes: e.target.value as RestrictionForm['allowedPullTypes'] })}>
                                    {PULL_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            {form.allowedPullTypes !== 'donation_only' && (
                                <div>
                                    <label className={labelClass}>Min coins gastados (vacio = sin requisito)</label>
                                    <input type="number" min="0" className={inputClass} value={form.coinMinSpent} onChange={e => setForm({ ...form, coinMinSpent: e.target.value })} placeholder="Sin minimo" />
                                </div>
                            )}

                            {/* Milestones */}
                            <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#374151]">
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">Milestones Acumulados</p>
                                <div>
                                    <label className={labelClass}>Acumulado donacion USD (vacio = desactivado)</label>
                                    <input type="number" step="0.01" min="0" className={inputClass} value={form.cumulativeDonationThreshold} onChange={e => setForm({ ...form, cumulativeDonationThreshold: e.target.value })} placeholder="Desactivado" />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Acumulado coins (vacio = desactivado)</label>
                                <input type="number" min="0" className={inputClass} value={form.cumulativeCoinsThreshold} onChange={e => setForm({ ...form, cumulativeCoinsThreshold: e.target.value })} placeholder="Desactivado" />
                            </div>
                            {(form.cumulativeDonationThreshold || form.cumulativeCoinsThreshold) && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <label className={labelClass}>Garantizado</label>
                                        <button onClick={() => setForm({ ...form, cumulativeGuarantee: !form.cumulativeGuarantee })} className={`w-12 h-6 rounded-full transition-colors ${form.cumulativeGuarantee ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.cumulativeGuarantee ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">{form.cumulativeGuarantee ? 'Premio seguro' : 'Por probabilidad'}</span>
                                    </div>
                                    {!form.cumulativeGuarantee && (
                                        <div>
                                            <label className={labelClass}>Probabilidad especial (%)</label>
                                            <input type="number" step="0.1" min="0" max="100" className={inputClass} value={form.cumulativeProbability} onChange={e => setForm({ ...form, cumulativeProbability: e.target.value })} placeholder="Ej: 50" />
                                        </div>
                                    )}
                                </>
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
