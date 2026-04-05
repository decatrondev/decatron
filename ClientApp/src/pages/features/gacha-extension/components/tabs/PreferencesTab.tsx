import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Sparkles, X, Globe, User } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaPreference, GachaItem, GachaParticipant } from '../../types';
import { RARITY_CONFIG, getRarityStars } from '../../types';

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent';
const labelClass = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]';

type PrefScope = 'global' | 'individual';

interface PrefForm {
    itemId: number;
    participantId: number | null;
    probabilityPercentage: number;
    isActive: boolean;
    scope: PrefScope;
}

const emptyForm: PrefForm = { itemId: 0, participantId: null, probabilityPercentage: 0, isActive: true, scope: 'global' };

export const PreferencesTab: React.FC = () => {
    const [preferences, setPreferences] = useState<GachaPreference[]>([]);
    const [items, setItems] = useState<GachaItem[]>([]);
    const [participants, setParticipants] = useState<GachaParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<PrefForm>(emptyForm);
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            const [resP, resI, resPart] = await Promise.all([
                api.get('/gacha/preferences'),
                api.get('/gacha/items'),
                api.get('/gacha/participants'),
            ]);
            setPreferences(resP.data.preferences || []);
            setItems(resI.data.items || []);
            setParticipants(resPart.data.participants || []);
        } catch (err) {
            console.error('Error loading preferences:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const getItem = (id: number) => items.find(i => i.id === id);
    const getParticipant = (id: number) => participants.find(p => p.id === id);

    const openCreate = (scope: PrefScope) => {
        setEditingId(null);
        setForm({ ...emptyForm, itemId: items[0]?.id ?? 0, scope, participantId: scope === 'individual' ? (participants[0]?.id ?? null) : null });
        setShowModal(true);
    };

    const openEdit = (p: GachaPreference) => {
        setEditingId(p.id);
        setForm({
            itemId: p.itemId,
            participantId: p.participantId ?? null,
            probabilityPercentage: p.probabilityPercentage,
            isActive: p.isActive,
            scope: p.participantId ? 'individual' : 'global',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.itemId) return;
        setSaving(true);
        const payload = {
            itemId: form.itemId,
            participantId: form.scope === 'global' ? null : form.participantId,
            probabilityPercentage: form.probabilityPercentage,
            isActive: form.isActive,
        };
        try {
            if (editingId) {
                await api.put(`/gacha/preferences/${editingId}`, payload);
            } else {
                await api.post('/gacha/preferences', payload);
            }
            setShowModal(false);
            await loadData();
        } catch (err) {
            console.error('Error saving preference:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Eliminar esta preferencia?')) return;
        try {
            await api.delete(`/gacha/preferences/${id}`);
            await loadData();
        } catch (err) {
            console.error('Error deleting preference:', err);
        }
    };

    if (loading) {
        return <div className={cardClass}><p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando preferencias...</p></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Sparkles className="w-5 h-5" /> Preferencias ({preferences.length})
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => openCreate('global')} disabled={items.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                        <Globe className="w-4 h-4" /> Preferencia Global
                    </button>
                    <button onClick={() => openCreate('individual')} disabled={items.length === 0 || participants.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                        <User className="w-4 h-4" /> Preferencia Individual
                    </button>
                </div>
            </div>

            {preferences.length === 0 ? (
                <div className={cardClass}>
                    <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-12">No hay preferencias configuradas.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {preferences.map(p => {
                        const item = p.item || getItem(p.itemId);
                        const participant = p.participantId ? (p.participant || getParticipant(p.participantId)) : null;
                        const isGlobal = !p.participantId;
                        const rc = item ? RARITY_CONFIG[item.rarity] : null;
                        return (
                            <div key={p.id} className={`${cardClass} flex items-center gap-4`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{item?.name ?? `Item #${p.itemId}`}</span>
                                        {rc && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: rc.bg, color: rc.color }}>
                                                {getRarityStars(item!.rarity)}
                                            </span>
                                        )}
                                        {isGlobal ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center gap-1">
                                                <Globe className="w-3 h-3" /> Global
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center gap-1">
                                                <User className="w-3 h-3" /> {participant?.name ?? `#${p.participantId}`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        <span>Probabilidad: <strong>{p.probabilityPercentage}%</strong></span>
                                        <span className={p.isActive ? 'text-green-500' : 'text-red-400'}>{p.isActive ? 'Activa' : 'Inactiva'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
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
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                {editingId ? 'Editar Preferencia' : `Nueva Preferencia ${form.scope === 'global' ? 'Global' : 'Individual'}`}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 text-[#64748b] hover:text-red-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className={labelClass}>Item</label>
                                <select className={`${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`} value={form.itemId} onChange={e => setForm({ ...form, itemId: Number(e.target.value) })}>
                                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                            {form.scope === 'individual' && (
                                <div>
                                    <label className={labelClass}>Participante</label>
                                    <select className={`${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`} value={form.participantId ?? ''} onChange={e => setForm({ ...form, participantId: Number(e.target.value) })}>
                                        {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className={labelClass}>Probabilidad (%)</label>
                                <input type="number" min="0" max="100" step="0.1" className={inputClass} value={form.probabilityPercentage} onChange={e => setForm({ ...form, probabilityPercentage: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className={labelClass}>Activa</label>
                                <button onClick={() => setForm({ ...form, isActive: !form.isActive })} className={`w-12 h-6 rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
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
