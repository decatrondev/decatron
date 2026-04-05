import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, X, Globe, User } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaRarityRestriction, GachaItem, GachaParticipant, RarityType } from '../../types';
import { RARITY_CONFIG, RARITY_ORDER, getRarityStars } from '../../types';

export const RarityRestrictionsTab: React.FC = () => {
    const [restrictions, setRestrictions] = useState<GachaRarityRestriction[]>([]);
    const [items, setItems] = useState<GachaItem[]>([]);
    const [participants, setParticipants] = useState<GachaParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        itemId: '' as string | number,
        participantId: '' as string | number,
        rarity: 'common' as RarityType,
        pullInterval: 1,
        timeInterval: 1,
        timeUnit: 'hours',
        isActive: true,
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [rRes, iRes, pRes] = await Promise.all([
                api.get('/gacha/rarity-restrictions'),
                api.get('/gacha/items'),
                api.get('/gacha/participants'),
            ]);
            setRestrictions(rRes.data.restrictions || []);
            setItems(iRes.data.items || []);
            setParticipants(pRes.data.participants || []);
        } catch (err) {
            console.error('Error loading rarity restrictions', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleCreate = async () => {
        try {
            await api.post('/gacha/rarity-restrictions', {
                itemId: form.itemId || null,
                participantId: form.participantId || null,
                rarity: form.rarity,
                pullInterval: form.pullInterval,
                timeInterval: form.timeInterval,
                timeUnit: form.timeUnit,
                isActive: form.isActive,
            });
            setShowModal(false);
            setForm({ itemId: '', participantId: '', rarity: 'common', pullInterval: 1, timeInterval: 1, timeUnit: 'hours', isActive: true });
            loadData();
        } catch (err) {
            console.error('Error creating restriction', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Eliminar esta restriccion?')) return;
        try {
            await api.delete(`/gacha/rarity-restrictions/${id}`);
            loadData();
        } catch (err) {
            console.error('Error deleting restriction', err);
        }
    };

    const getScopeName = (r: GachaRarityRestriction) => {
        if (r.participant) return r.participant.name;
        if (r.participantId) return `Participante #${r.participantId}`;
        return 'Global';
    };

    const getItemName = (r: GachaRarityRestriction) => {
        if (r.item) return r.item.name;
        if (r.itemId) return `Item #${r.itemId}`;
        return 'Todos';
    };

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl">
                        <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Limites por Rareza</h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Intervalos de pulls y tiempo por rareza</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all">
                    <Plus className="w-4 h-4" /> Agregar Restriccion
                </button>
            </div>

            {/* List */}
            {loading ? (
                <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando...</p>
            ) : restrictions.length === 0 ? (
                <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">No hay restricciones de rareza configuradas</p>
            ) : (
                <div className="space-y-3">
                    {restrictions.map((r) => {
                        const rarity = (r.rarity as RarityType) || 'common';
                        const cfg = RARITY_CONFIG[rarity];
                        return (
                            <div key={r.id} className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        {r.participantId ? <User className="w-4 h-4 text-blue-400" /> : <Globe className="w-4 h-4 text-green-400" />}
                                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{getScopeName(r)}</span>
                                    </div>
                                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Item: {getItemName(r)}</span>
                                    <span className="text-sm font-bold" style={{ color: cfg?.color }}>{getRarityStars(rarity)} {cfg?.label}</span>
                                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Cada {r.pullInterval} pulls</span>
                                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">o {r.timeInterval} {r.timeUnit}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                        {r.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <button onClick={() => handleDelete(r.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-2xl w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Nueva Restriccion</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="w-5 h-5 text-[#64748b]" /></button>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Item (opcional)</label>
                            <select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]">
                                <option value="">Todos los items</option>
                                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Participante (opcional - vacio = global)</label>
                            <select value={form.participantId} onChange={(e) => setForm({ ...form, participantId: e.target.value })} className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]">
                                <option value="">Global</option>
                                {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Rareza</label>
                            <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value as RarityType })} className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]">
                                {RARITY_ORDER.map((r) => <option key={r} value={r}>{RARITY_CONFIG[r].label} {getRarityStars(r)}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Intervalo de Pulls</label>
                                <input type="number" min={1} value={form.pullInterval} onChange={(e) => setForm({ ...form, pullInterval: parseInt(e.target.value) || 1 })} className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Intervalo de Tiempo</label>
                                <input type="number" min={1} value={form.timeInterval} onChange={(e) => setForm({ ...form, timeInterval: parseInt(e.target.value) || 1 })} className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Unidad de Tiempo</label>
                                <select value={form.timeUnit} onChange={(e) => setForm({ ...form, timeUnit: e.target.value })} className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]">
                                    <option value="minutes">Minutos</option>
                                    <option value="hours">Horas</option>
                                    <option value="days">Dias</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button onClick={() => setForm({ ...form, isActive: !form.isActive })} className={`w-full px-4 py-3 rounded-xl font-bold transition-all ${form.isActive ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                    {form.isActive ? 'Activo' : 'Inactivo'}
                                </button>
                            </div>
                        </div>

                        <button onClick={handleCreate} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all">
                            Crear Restriccion
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
