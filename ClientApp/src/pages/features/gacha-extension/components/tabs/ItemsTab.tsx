import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package, X, ImagePlus, HelpCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaItem, RarityType, GachaItemEffectType } from '../../types';
import { RARITY_CONFIG, getRarityStars, ITEM_EFFECTS, describeItemEffect } from '../../types';
import MediaSelector from '../../../../../components/timer/MediaSelector';

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent';
const labelClass = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]';

const RARITIES: RarityType[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

interface ItemForm {
    name: string;
    rarity: RarityType;
    image: string;
    available: boolean;
    effectType: GachaItemEffectType;
    effectValue: number;
    consumable: boolean;
}

const emptyForm: ItemForm = { name: '', rarity: 'common', image: '', available: true, effectType: 'none', effectValue: 0, consumable: false };

type TimeUnit = 's' | 'm' | 'h' | 'd';
const UNIT_SECONDS: Record<TimeUnit, number> = { s: 1, m: 60, h: 3600, d: 86400 };
const UNIT_LABEL: Record<TimeUnit, string> = { s: 'segundos', m: 'minutos', h: 'horas', d: 'dias' };

/** Elige la unidad mas grande que divide exacto, para mostrar 600s como 10m. */
function unitFor(seconds: number): TimeUnit {
    const abs = Math.abs(seconds);
    if (abs >= 86400 && abs % 86400 === 0) return 'd';
    if (abs >= 3600 && abs % 3600 === 0) return 'h';
    if (abs >= 60 && abs % 60 === 0) return 'm';
    return 's';
}

export const ItemsTab: React.FC = () => {
    const [items, setItems] = useState<GachaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<ItemForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [showMediaSelector, setShowMediaSelector] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [timeUnit, setTimeUnit] = useState<TimeUnit>('m');

    const loadItems = async () => {
        try {
            const { data } = await api.get('/gacha/items');
            setItems(data.items || []);
        } catch (err) {
            console.error('Error loading items:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadItems(); }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (item: GachaItem) => {
        setEditingId(item.id);
        setForm({
            name: item.name, rarity: item.rarity, image: item.image || '', available: item.available,
            effectType: item.effectType ?? 'none', effectValue: item.effectValue ?? 0, consumable: item.consumable ?? false,
        });
        setTimeUnit(item.effectType === 'timer_time' ? unitFor(item.effectValue ?? 0) : 'm');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            if (editingId) {
                await api.put(`/gacha/items/${editingId}`, form);
            } else {
                await api.post('/gacha/items', form);
            }
            setShowModal(false);
            await loadItems();
        } catch (err) {
            console.error('Error saving item:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Estas seguro de eliminar este item?')) return;
        try {
            await api.delete(`/gacha/items/${id}`);
            await loadItems();
        } catch (err) {
            console.error('Error deleting item:', err);
        }
    };

    if (loading) {
        return <div className={cardClass}><p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando items...</p></div>;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Package className="w-5 h-5" /> Items ({items.length})
                </h2>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
                    <Plus className="w-4 h-4" /> Agregar Item
                </button>
            </div>

            {/* Help Banner */}
            <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-[#94a3b8] flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Como crear cartas para tu gacha</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-[#94a3b8]" /> : <ChevronDown className="w-4 h-4 text-[#94a3b8]" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Haz clic en <strong className="text-[#1e293b] dark:text-[#f8fafc]">Agregar Item</strong> para crear una nueva carta</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span>Asigna un <strong className="text-[#1e293b] dark:text-[#f8fafc]">nombre</strong>, sube una <strong className="text-[#1e293b] dark:text-[#f8fafc]">imagen</strong> y selecciona la <strong className="text-[#1e293b] dark:text-[#f8fafc]">rareza</strong> (1-5 estrellas)</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span>Las cartas se muestran a los viewers cuando las ganan en un pull</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span>Puedes <strong className="text-[#1e293b] dark:text-[#f8fafc]">editar</strong> o <strong className="text-[#1e293b] dark:text-[#f8fafc]">eliminar</strong> cartas en cualquier momento</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-[#e2e8f0] dark:bg-[#374151] text-xs">
                            <strong className="text-[#1e293b] dark:text-[#f8fafc]">Tip:</strong> Las imagenes se recomiendan en formato vertical (3:4). Usa JPG o PNG de buena calidad.
                        </div>
                    </div>
                )}
            </div>

            {/* Grid */}
            {items.length === 0 ? (
                <div className={cardClass}>
                    <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-12">
                        No hay items configurados. Crea tu primer item para empezar.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {items.map(item => {
                        const rc = RARITY_CONFIG[item.rarity];
                        return (
                            <div key={item.id} className="rounded-2xl overflow-hidden border-2 transition-all hover:scale-[1.03] hover:shadow-xl group" style={{ borderColor: rc.border, background: `linear-gradient(180deg, ${rc.bg} 0%, transparent 100%)` }}>
                                {/* Image */}
                                <div className="aspect-[3/4] relative bg-[#0f172a]/5 dark:bg-[#0f172a]/40">
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-16 h-16" style={{ color: rc.color, opacity: 0.2 }} />
                                        </div>
                                    )}
                                    {/* Rarity badge */}
                                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ backgroundColor: rc.color, color: '#fff' }}>
                                        {getRarityStars(item.rarity)}
                                    </div>
                                    {/* Effect badge */}
                                    {describeItemEffect(item) && (
                                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500 text-white" title={item.consumable ? 'Consumible: no queda en la coleccion' : undefined}>
                                            {describeItemEffect(item)}{item.consumable ? ' ·1x' : ''}
                                        </div>
                                    )}
                                    {/* Available badge */}
                                    {!item.available && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg rotate-[-8deg]">NO DISPONIBLE</span>
                                        </div>
                                    )}
                                    {/* Actions overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2">
                                        <button onClick={() => openEdit(item)} className="p-2 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-white/30 transition">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-red-500/50 transition">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                {/* Info */}
                                <div className="p-3 bg-white dark:bg-[#1B1C1D] text-center">
                                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{item.name}</h3>
                                    <span className="text-xs font-bold" style={{ color: rc.color }}>{rc.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Media Selector */}
            <MediaSelector
                isOpen={showMediaSelector}
                onClose={() => setShowMediaSelector(false)}
                onSelect={(fileUrl) => {
                    setForm({ ...form, image: fileUrl });
                    setShowMediaSelector(false);
                }}
                allowedTypes={['image', 'gif']}
                currentUrl={form.image}
            />

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                {editingId ? 'Editar Item' : 'Nuevo Item'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 text-[#64748b] hover:text-red-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className={labelClass}>Nombre</label>
                                <input className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre del item" />
                            </div>
                            <div>
                                <label className={labelClass}>Rareza</label>
                                <select className={`${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`} value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value as RarityType })}>
                                    {RARITIES.map(r => (
                                        <option key={r} value={r}>{RARITY_CONFIG[r].label} ({getRarityStars(r)})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Imagen</label>
                                <div className="flex items-center gap-3 mt-1">
                                    {form.image ? (
                                        <div className="relative group">
                                            <img src={form.image} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-[#e2e8f0] dark:border-[#374151]" />
                                            <button
                                                onClick={() => setForm({ ...form, image: '' })}
                                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 rounded-xl bg-[#f1f5f9] dark:bg-[#374151] flex items-center justify-center">
                                            <Package className="w-8 h-8 text-[#94a3b8]" />
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowMediaSelector(true)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:border-blue-400 transition"
                                    >
                                        <ImagePlus className="w-4 h-4" />
                                        {form.image ? 'Cambiar' : 'Seleccionar'}
                                    </button>
                                </div>
                            </div>
                            {/* Effect */}
                            <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <label className={labelClass}>Efecto al salir</label>
                                </div>
                                <select
                                    className={`${inputClass} [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`}
                                    value={form.effectType}
                                    onChange={e => {
                                        const effectType = e.target.value as GachaItemEffectType;
                                        // Los que tienen efecto son consumibles por defecto; el streamer puede cambiarlo.
                                        setForm({ ...form, effectType, effectValue: effectType === 'extra_pulls' ? Math.max(1, form.effectValue) : effectType === 'timer_time' ? form.effectValue : 0, consumable: effectType !== 'none' });
                                    }}
                                >
                                    {ITEM_EFFECTS.map(ef => <option key={ef.id} value={ef.id}>{ef.label}</option>)}
                                </select>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{ITEM_EFFECTS.find(ef => ef.id === form.effectType)?.desc}</p>

                                {form.effectType === 'extra_pulls' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-[#64748b]">Cantidad</span>
                                        <input type="number" min={1} className={`${inputClass} w-24`} value={form.effectValue} onChange={e => setForm({ ...form, effectValue: Math.max(1, parseInt(e.target.value) || 1) })} />
                                        <span className="text-sm text-[#64748b]">tiros bonus</span>
                                    </div>
                                )}

                                {form.effectType === 'timer_time' && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <input
                                            type="number"
                                            className={`${inputClass} w-24`}
                                            value={form.effectValue / UNIT_SECONDS[timeUnit]}
                                            onChange={e => setForm({ ...form, effectValue: Math.round((parseFloat(e.target.value) || 0) * UNIT_SECONDS[timeUnit]) })}
                                        />
                                        <select
                                            className={`${inputClass} w-32 [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`}
                                            value={timeUnit}
                                            onChange={e => {
                                                // Cambiar de unidad conserva el numero visible, no los segundos
                                                const next = e.target.value as TimeUnit;
                                                const visible = form.effectValue / UNIT_SECONDS[timeUnit];
                                                setTimeUnit(next);
                                                setForm({ ...form, effectValue: Math.round(visible * UNIT_SECONDS[next]) });
                                            }}
                                        >
                                            {(Object.keys(UNIT_LABEL) as TimeUnit[]).map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
                                        </select>
                                        <span className="text-xs text-[#64748b] w-full">Negativo = resta tiempo (item "maldito"). Solo aplica si el timer esta corriendo o en pausa.</span>
                                    </div>
                                )}

                                {form.effectType !== 'none' && (
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setForm({ ...form, consumable: !form.consumable })} className={`w-12 h-6 rounded-full transition-colors ${form.consumable ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.consumable ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                        </button>
                                        <div>
                                            <span className={labelClass}>Consumible</span>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Se usa al salir y no queda en la coleccion</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <label className={labelClass}>Disponible</label>
                                <button onClick={() => setForm({ ...form, available: !form.available })} className={`w-12 h-6 rounded-full transition-colors ${form.available ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.available ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#e2e8f0] dark:border-[#374151] rounded-xl font-bold text-[#64748b] hover:bg-gray-50 dark:hover:bg-[#374151]/50 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
