import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Sparkles, X, Globe, User, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaPreference, GachaItem, GachaParticipant } from '../../types';
import { RARITY_CONFIG, getRarityStars } from '../../types';

const cardClass = 'bg-ds-surface rounded-lg p-6 border border-ds-border ';
const inputClass = 'w-full px-4 py-2.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent';
const labelClass = 'text-sm font-bold text-ds-text ';

type PrefScope = 'global' | 'individual';

interface PrefForm {
    itemId: number;
    participantId: number | null;
    probabilityPercentage: number;
    coinProbabilityOverride: string;
    isActive: boolean;
    scope: PrefScope;
}

const emptyForm: PrefForm = { itemId: 0, participantId: null, probabilityPercentage: 0, coinProbabilityOverride: '', isActive: true, scope: 'global' };

export const PreferencesTab: React.FC = () => {
    const [preferences, setPreferences] = useState<GachaPreference[]>([]);
    const [items, setItems] = useState<GachaItem[]>([]);
    const [participants, setParticipants] = useState<GachaParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<PrefForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

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
            coinProbabilityOverride: p.coinProbabilityOverride != null ? String(p.coinProbabilityOverride) : '',
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
            coinProbabilityOverride: form.coinProbabilityOverride ? Number(form.coinProbabilityOverride) : null,
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
        return <div className={cardClass}><p className="text-center text-ds-soft py-8">Cargando preferencias...</p></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-black text-ds-text flex items-center gap-2">
                    <Sparkles className="w-5 h-5" /> Preferencias ({preferences.length})
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => openCreate('global')} disabled={items.length === 0} className="ds-btn ds-btn--primary">
                        <Globe className="w-4 h-4" /> Preferencia Global
                    </button>
                    <button onClick={() => openCreate('individual')} disabled={items.length === 0 || participants.length === 0} className="ds-btn ds-btn--primary">
                        <User className="w-4 h-4" /> Preferencia Individual
                    </button>
                </div>
            </div>

            {/* Help Banner */}
            <div className="rounded-lg border border-ds-border bg-ds-bg overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-ds-soft flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-ds-soft">Como funcionan las preferencias</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-ds-soft">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Las preferencias permiten <strong className="text-ds-text">modificar la probabilidad</strong> de una carta especifica</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span><strong className="text-ds-text">Global</strong> — aplica a todos los viewers del canal</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span><strong className="text-ds-text">Individual</strong> — aplica solo a un viewer especifico (tiene prioridad sobre global)</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span>Solo aplican si el viewer cumple el <strong className="text-ds-text">minimo de donacion</strong> de la carta</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-ds-raised text-xs">
                            <strong className="text-ds-text">Tip:</strong> Usa preferencias individuales para premiar a tus mejores donantes con mayor chance de cartas raras.
                        </div>
                    </div>
                )}
            </div>

            {preferences.length === 0 ? (
                <div className={cardClass}>
                    <p className="text-center text-ds-soft py-12">No hay preferencias configuradas.</p>
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
                                        <span className="font-bold text-ds-text">{item?.name ?? `Item #${p.itemId}`}</span>
                                        {rc && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: rc.bg, color: rc.color }}>
                                                {getRarityStars(item!.rarity)}
                                            </span>
                                        )}
                                        {isGlobal ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-ds-accent/10 text-ds-accent-text flex items-center gap-1">
                                                <Globe className="w-3 h-3" /> Global
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-ds-accent/10 text-ds-accent-text flex items-center gap-1">
                                                <User className="w-3 h-3" /> {participant?.name ?? `#${p.participantId}`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-ds-soft">
                                        <span>Donacion: <strong>{p.probabilityPercentage}%</strong></span>
                                        {p.coinProbabilityOverride != null && <span>Coins: <strong>{p.coinProbabilityOverride}%</strong></span>}
                                        <span className={p.isActive ? 'text-ds-ok' : 'text-ds-danger'}>{p.isActive ? 'Activa' : 'Inactiva'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg bg-ds-accent/10 text-ds-accent-text hover:bg-ds-accent/10 transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg bg-ds-danger/10 text-ds-danger hover:bg-ds-danger/10 transition-colors">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-ds-input/50 p-4">
                    <div className="bg-ds-surface rounded-lg border border-ds-border w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-ds-text">
                                {editingId ? 'Editar Preferencia' : `Nueva Preferencia ${form.scope === 'global' ? 'Global' : 'Individual'}`}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 text-ds-soft hover:text-ds-danger"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className={labelClass}>Item</label>
                                <select className={`${inputClass} [&>option]:bg-ds-surface `} value={form.itemId} onChange={e => setForm({ ...form, itemId: Number(e.target.value) })}>
                                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                            {form.scope === 'individual' && (
                                <div>
                                    <label className={labelClass}>Participante</label>
                                    <select className={`${inputClass} [&>option]:bg-ds-surface `} value={form.participantId ?? ''} onChange={e => setForm({ ...form, participantId: Number(e.target.value) })}>
                                        {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className={labelClass}>Probabilidad donacion (%)</label>
                                <input type="number" min="0" max="100" step="0.1" className={inputClass} value={form.probabilityPercentage} onChange={e => setForm({ ...form, probabilityPercentage: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className={labelClass}>Probabilidad coins (% — vacio = usa donacion)</label>
                                <input type="number" min="0" max="100" step="0.1" className={inputClass} value={form.coinProbabilityOverride} onChange={e => setForm({ ...form, coinProbabilityOverride: e.target.value })} placeholder="Misma que donacion" />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className={labelClass}>Activa</label>
                                <button onClick={() => setForm({ ...form, isActive: !form.isActive })} className={`w-12 h-6 rounded-full transition-colors ${form.isActive ? 'bg-ds-accent' : 'bg-ds-raised '}`}>
                                    <div className={`w-5 h-5 bg-ds-surface rounded-full shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-ds-border rounded-lg font-bold text-ds-soft hover:bg-ds-surface transition-colors">Cancelar</button>
                            <button onClick={handleSave} disabled={saving || !form.itemId} className="ds-btn ds-btn--primary flex-1">
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
