import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, X, Globe, User, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaRarityRestriction, GachaItem, GachaParticipant, RarityType } from '../../types';
import { RARITY_CONFIG, RARITY_ORDER, getRarityStars } from '../../types';

export const RarityRestrictionsTab: React.FC = () => {
    const [restrictions, setRestrictions] = useState<GachaRarityRestriction[]>([]);
    const [items, setItems] = useState<GachaItem[]>([]);
    const [participants, setParticipants] = useState<GachaParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHelp, setShowHelp] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        itemId: '' as string | number,
        participantId: '' as string | number,
        rarity: 'common' as RarityType,
        pullInterval: 1,
        timeInterval: 1,
        timeUnit: 'hours',
        coinPullInterval: '' as string | number,
        coinTimeInterval: '' as string | number,
        coinTimeUnit: '',
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
                coinPullInterval: form.coinPullInterval || null,
                coinTimeInterval: form.coinTimeInterval || null,
                coinTimeUnit: form.coinTimeUnit || null,
                isActive: form.isActive,
            });
            setShowModal(false);
            setForm({ itemId: '', participantId: '', rarity: 'common', pullInterval: 1, timeInterval: 1, timeUnit: 'hours', coinPullInterval: '', coinTimeInterval: '', coinTimeUnit: '', isActive: true });
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
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-ds-border">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-ds-accent rounded-lg">
                        <Clock className="w-6 h-6 text-ds-on-accent" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-ds-text">Limites por Rareza</h2>
                        <p className="text-sm text-ds-soft">Intervalos de pulls y tiempo por rareza</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} className="ds-btn ds-btn--primary">
                    <Plus className="w-4 h-4" /> Agregar Restriccion
                </button>
            </div>

            {/* Help Banner */}
            <div className="rounded-lg border border-ds-border bg-ds-bg overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-ds-soft flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-ds-soft">Como funcionan los limites de rareza</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-ds-soft">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Los limites controlan <strong className="text-ds-text">cada cuanto</strong> puede salir una carta de cada rareza</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span><strong className="text-ds-text">Intervalo de pulls</strong> — minimo de tiros entre cartas de la misma rareza (ej: 5 pulls entre legendarias)</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span><strong className="text-ds-text">Intervalo de tiempo</strong> — tiempo minimo entre cartas de la misma rareza (ej: 1 hora entre epicas)</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span>Aplica por <strong className="text-ds-text">viewer individual</strong>, no globalmente</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-ds-raised text-xs">
                            <strong className="text-ds-text">Tip:</strong> Esto evita que un viewer con suerte se lleve todas las legendarias de golpe.
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            {loading ? (
                <p className="text-center text-ds-soft py-8">Cargando...</p>
            ) : restrictions.length === 0 ? (
                <p className="text-center text-ds-soft py-8">No hay restricciones de rareza configuradas</p>
            ) : (
                <div className="space-y-3">
                    {restrictions.map((r) => {
                        const rarity = (r.rarity as RarityType) || 'common';
                        const cfg = RARITY_CONFIG[rarity];
                        return (
                            <div key={r.id} className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        {r.participantId ? <User className="w-4 h-4 text-ds-accent-text" /> : <Globe className="w-4 h-4 text-ds-accent-text" />}
                                        <span className="font-bold text-ds-text">{getScopeName(r)}</span>
                                    </div>
                                    <span className="text-xs text-ds-soft">Item: {getItemName(r)}</span>
                                    <span className="text-sm font-bold" style={{ color: cfg?.color }}>{getRarityStars(rarity)} {cfg?.label}</span>
                                    <span className="text-xs text-ds-soft">Donacion: {r.pullInterval} pulls / {r.timeInterval} {r.timeUnit}</span>
                                    {(r.coinPullInterval || r.coinTimeInterval) && (
                                        <span className="text-xs text-ds-accent-text">Coins: {r.coinPullInterval ?? '—'} pulls / {r.coinTimeInterval ?? '—'} {r.coinTimeUnit ?? ''}</span>
                                    )}
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.isActive ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-bg text-ds-soft'}`}>
                                        {r.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <button onClick={() => handleDelete(r.id)} className="p-2 text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-ds-text">Nueva Restriccion</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-ds-bg rounded-lg"><X className="w-5 h-5 text-ds-soft" /></button>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-1">Item (opcional)</label>
                            <select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className="ds-input w-full">
                                <option value="">Todos los items</option>
                                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-1">Participante (opcional - vacio = global)</label>
                            <select value={form.participantId} onChange={(e) => setForm({ ...form, participantId: e.target.value })} className="ds-input w-full">
                                <option value="">Global</option>
                                {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-1">Rareza</label>
                            <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value as RarityType })} className="ds-input w-full">
                                {RARITY_ORDER.map((r) => <option key={r} value={r}>{RARITY_CONFIG[r].label} {getRarityStars(r)}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-1">Intervalo de Pulls</label>
                                <input type="number" min={1} value={form.pullInterval} onChange={(e) => setForm({ ...form, pullInterval: parseInt(e.target.value) || 1 })} className="ds-input w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-1">Intervalo de Tiempo</label>
                                <input type="number" min={1} value={form.timeInterval} onChange={(e) => setForm({ ...form, timeInterval: parseInt(e.target.value) || 1 })} className="ds-input w-full" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-ds-soft mb-1">Unidad de Tiempo</label>
                                <select value={form.timeUnit} onChange={(e) => setForm({ ...form, timeUnit: e.target.value })} className="ds-input w-full">
                                    <option value="minutes">Minutos</option>
                                    <option value="hours">Horas</option>
                                    <option value="days">Dias</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button onClick={() => setForm({ ...form, isActive: !form.isActive })} className={form.isActive ? 'ds-btn ds-btn--primary ds-btn--lg w-full' : 'ds-btn ds-btn--secondary ds-btn--lg w-full'}>
                                    {form.isActive ? 'Activo' : 'Inactivo'}
                                </button>
                            </div>
                        </div>

                        {/* Coin-specific intervals */}
                        <div className="pt-3 border-t border-ds-border">
                            <p className="text-xs font-bold text-ds-accent-text mb-2 uppercase tracking-wide">Intervalos para Coins (opcional)</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ds-soft mb-1">Pulls (coins)</label>
                                    <input type="number" min={0} value={form.coinPullInterval} onChange={(e) => setForm({ ...form, coinPullInterval: e.target.value })} placeholder="Usar donacion" className="ds-input w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ds-soft mb-1">Tiempo (coins)</label>
                                    <input type="number" min={0} value={form.coinTimeInterval} onChange={(e) => setForm({ ...form, coinTimeInterval: e.target.value })} placeholder="Usar donacion" className="ds-input w-full" />
                                </div>
                            </div>
                            <div className="mt-2">
                                <label className="block text-sm font-bold text-ds-soft mb-1">Unidad tiempo (coins)</label>
                                <select value={form.coinTimeUnit} onChange={(e) => setForm({ ...form, coinTimeUnit: e.target.value })} className="ds-input w-full">
                                    <option value="">Usar misma que donacion</option>
                                    <option value="minutes">Minutos</option>
                                    <option value="hours">Horas</option>
                                    <option value="days">Dias</option>
                                </select>
                            </div>
                        </div>

                        <button onClick={handleCreate} className="ds-btn ds-btn--primary ds-btn--lg w-full">
                            Crear Restriccion
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
