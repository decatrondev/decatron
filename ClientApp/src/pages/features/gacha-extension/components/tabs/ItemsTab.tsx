import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package, X, ImagePlus } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaItem, RarityType } from '../../types';
import { RARITY_CONFIG, getRarityStars } from '../../types';
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
}

const emptyForm: ItemForm = { name: '', rarity: 'common', image: '', available: true };

export const ItemsTab: React.FC = () => {
    const [items, setItems] = useState<GachaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<ItemForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [showMediaSelector, setShowMediaSelector] = useState(false);

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
        setForm({ name: item.name, rarity: item.rarity, image: item.image || '', available: item.available });
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
