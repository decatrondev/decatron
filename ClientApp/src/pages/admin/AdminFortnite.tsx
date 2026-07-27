import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Plus, Pencil, Trash2, Save, X,
    LayoutGrid, BarChart3, Check, AlertTriangle, RefreshCw,
    Eye, EyeOff
} from 'lucide-react';
import api from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FortniteSprite {
    id: number;
    spriteKey: string;
    name: string;
    character: string;
    theme: string;
    rarity: string;
    imageUrl?: string;
    isUnreleased: boolean;
    season?: string;
    createdAt: string;
    updatedAt: string;
}

type TabId = 'sprites' | 'stats';

const tabs: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'sprites', label: 'Sprites',     icon: LayoutGrid },
    { id: 'stats',   label: 'Estadisticas', icon: BarChart3  },
];

const RARITIES = ['Rare', 'Special', 'Epic', 'Legendary', 'Mythic'];
const THEMES   = ['Basic', 'Gold', 'Candy', 'Galaxy', 'Gem', 'Holofoil', 'Rift'];

const RARITY_COLORS: Record<string, string> = {
    Rare:      'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Special:   'bg-green-500/20 text-green-400 border-green-500/30',
    Epic:      'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Legendary: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Mythic:    'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

// ─── Shared UI ───────────────────────────────────────────────────────────────

function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
        </div>
    );
}

function FormField({ label, value, onChange, type = 'text', placeholder, disabled }: {
    label: string; value: any; onChange: (v: string) => void;
    type?: string; placeholder?: string; disabled?: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1 uppercase">{label}</label>
            <input
                type={type}
                value={value ?? ''}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/50 placeholder-[#94a3b8] disabled:opacity-50"
            />
        </div>
    );
}

function FormSelect({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void;
    options: string[];
}) {
    return (
        <div>
            <label className="block text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1 uppercase">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/50 [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]"
            >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">{title}</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors">
                        <X className="w-5 h-5 text-[#64748b]" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

// ─── Sprites Tab ─────────────────────────────────────────────────────────────

function SpritesTab() {
    const [sprites, setSprites] = useState<FortniteSprite[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCharacter, setFilterCharacter] = useState('');
    const [filterRarity, setFilterRarity] = useState('');
    const [filterUnreleased, setFilterUnreleased] = useState<'' | 'true' | 'false'>('');
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: Partial<FortniteSprite> } | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterCharacter) params.set('character', filterCharacter);
        if (filterRarity) params.set('rarity', filterRarity);
        if (filterUnreleased) params.set('unreleased', filterUnreleased);

        api.get(`/admin/fortnite/sprites${params.toString() ? '?' + params.toString() : ''}`)
            .then(r => { setSprites(r.data.sprites ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [filterCharacter, filterRarity, filterUnreleased]);

    useEffect(() => { load(); }, [load]);

    const characters = [...new Set(sprites.map(s => s.character))].sort();

    const emptySprite: Partial<FortniteSprite> = {
        spriteKey: '', name: '', character: '', theme: 'Basic',
        rarity: 'Rare', imageUrl: '', isUnreleased: false, season: ''
    };

    const handleSave = async () => {
        if (!modal) return;
        setSaveError(null);
        if (!modal.data.spriteKey?.trim()) { setSaveError('La clave del sprite es obligatoria'); return; }
        if (!modal.data.name?.trim()) { setSaveError('El nombre es obligatorio'); return; }
        if (!modal.data.character?.trim()) { setSaveError('El personaje es obligatorio'); return; }

        setSaving(true);
        try {
            if (modal.mode === 'create') {
                await api.post('/admin/fortnite/sprites', modal.data);
            } else {
                await api.put(`/admin/fortnite/sprites/${modal.data.id}`, modal.data);
            }
            setModal(null);
            load();
        } catch (e: any) {
            setSaveError(e.response?.data?.message || 'Error al guardar');
        }
        setSaving(false);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/admin/fortnite/sprites/${id}`);
            setDeleteConfirm(null);
            load();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Error al eliminar');
        }
    };

    const update = (key: keyof FortniteSprite, value: any) => {
        if (!modal) return;
        setModal({ ...modal, data: { ...modal.data, [key]: value } });
    };

    return (
        <div className="space-y-4">
            {/* Filters + Add button */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={filterCharacter}
                    onChange={e => setFilterCharacter(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]"
                >
                    <option value="">Todos los personajes</option>
                    {characters.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                    value={filterRarity}
                    onChange={e => setFilterRarity(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]"
                >
                    <option value="">Todas las rarezas</option>
                    {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select
                    value={filterUnreleased}
                    onChange={e => setFilterUnreleased(e.target.value as any)}
                    className="px-3 py-2 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]"
                >
                    <option value="">Todos</option>
                    <option value="false">Lanzados</option>
                    <option value="true">No lanzados</option>
                </select>

                <button
                    onClick={load}
                    className="p-2 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#64748b] hover:bg-[#f8fafc] dark:hover:bg-[#374151]/50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>

                <div className="flex-1" />

                <button
                    onClick={() => { setModal({ mode: 'create', data: { ...emptySprite } }); setSaveError(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
                >
                    <Plus className="w-4 h-4" /> Nuevo sprite
                </button>
            </div>

            {/* Table */}
            {loading ? <LoadingSpinner /> : (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Imagen</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Nombre</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Personaje</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Tema</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Rareza</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Clave</th>
                                    <th className="text-center px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Estado</th>
                                    <th className="text-center px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sprites.map(sprite => (
                                    <tr key={sprite.id} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0 hover:bg-[#f8fafc] dark:hover:bg-[#374151]/30">
                                        <td className="px-4 py-3">
                                            {sprite.imageUrl ? (
                                                <img src={sprite.imageUrl} alt={sprite.name} className="w-10 h-10 object-contain rounded-lg bg-[#f1f5f9] dark:bg-[#374151]/50" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-[#f1f5f9] dark:bg-[#374151]/50 flex items-center justify-center">
                                                    <span className="text-[10px] text-[#94a3b8]">—</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-[#1e293b] dark:text-[#f8fafc]">{sprite.name}</td>
                                        <td className="px-4 py-3 text-[#64748b]">{sprite.character}</td>
                                        <td className="px-4 py-3 text-[#64748b]">{sprite.theme}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${RARITY_COLORS[sprite.rarity] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                                                {sprite.rarity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{sprite.spriteKey}</td>
                                        <td className="px-4 py-3 text-center">
                                            {sprite.isUnreleased ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                                    <EyeOff className="w-3 h-3" /> Unreleased
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                                    <Eye className="w-3 h-3" /> Activo
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => { setModal({ mode: 'edit', data: { ...sprite } }); setSaveError(null); }}
                                                    className="p-1.5 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4 text-[#64748b]" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(sprite.id)}
                                                    className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sprites.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-[#64748b]">
                                            No hay sprites
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t border-[#e2e8f0] dark:border-[#374151] text-xs text-[#94a3b8]">
                        {sprites.length} sprite{sprites.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}

            {/* Create / Edit Modal */}
            {modal && (
                <Modal
                    title={modal.mode === 'create' ? 'Nuevo sprite' : `Editar: ${modal.data.name}`}
                    onClose={() => setModal(null)}
                >
                    <div className="space-y-4">
                        {saveError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {saveError}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                label="Clave (sprite_key)"
                                value={modal.data.spriteKey}
                                onChange={v => update('spriteKey', v.toLowerCase().replace(/\s+/g, '_'))}
                                placeholder="water_basic"
                                disabled={modal.mode === 'edit'}
                            />
                            <FormField
                                label="Nombre"
                                value={modal.data.name}
                                onChange={v => update('name', v)}
                                placeholder="Basic Water"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                label="Personaje"
                                value={modal.data.character}
                                onChange={v => update('character', v)}
                                placeholder="Water"
                            />
                            <FormSelect
                                label="Tema"
                                value={modal.data.theme ?? 'Basic'}
                                onChange={v => update('theme', v)}
                                options={THEMES}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormSelect
                                label="Rareza"
                                value={modal.data.rarity ?? 'Rare'}
                                onChange={v => update('rarity', v)}
                                options={RARITIES}
                            />
                            <FormField
                                label="Temporada"
                                value={modal.data.season}
                                onChange={v => update('season', v)}
                                placeholder="CH6 S2"
                            />
                        </div>

                        <FormField
                            label="URL de imagen"
                            value={modal.data.imageUrl}
                            onChange={v => update('imageUrl', v)}
                            placeholder="https://..."
                        />

                        <label className="flex items-center gap-3 cursor-pointer py-2">
                            <input
                                type="checkbox"
                                checked={modal.data.isUnreleased ?? false}
                                onChange={e => update('isUnreleased', e.target.checked)}
                                className="w-4 h-4 rounded border-[#e2e8f0] dark:border-[#374151] text-[#2563eb] focus:ring-[#2563eb]"
                            />
                            <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">No lanzado (Unreleased)</span>
                        </label>

                        {/* Preview */}
                        {modal.data.imageUrl && (
                            <div className="p-3 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl flex items-center gap-3">
                                <img
                                    src={modal.data.imageUrl}
                                    alt="preview"
                                    className="w-12 h-12 object-contain rounded-lg"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <div>
                                    <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{modal.data.name || '—'}</p>
                                    <p className="text-xs text-[#64748b]">{modal.data.character} · {modal.data.theme} · {modal.data.rarity}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => setModal(null)}
                                className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] rounded-xl text-sm font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm !== null && (
                <Modal title="Eliminar sprite" onClose={() => setDeleteConfirm(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Esta accion eliminara el sprite y <strong className="text-[#1e293b] dark:text-[#f8fafc]">todas las colecciones de usuarios</strong> que lo tengan marcado. No se puede deshacer.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] rounded-xl text-sm font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Eliminar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab() {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/fortnite/leaderboard/global?top=20'),
            api.get('/fortnite/sprites'),
        ]).then(([lbRes, spRes]) => {
            setLeaderboard(lbRes.data.leaderboard ?? []);
            setTotal(spRes.data.count ?? 0);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-xs font-bold text-[#64748b] uppercase mb-1">Total sprites</p>
                    <p className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{total}</p>
                </div>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-xs font-bold text-[#64748b] uppercase mb-1">Usuarios en leaderboard</p>
                    <p className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{leaderboard.length}</p>
                </div>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-xs font-bold text-[#64748b] uppercase mb-1">Top coleccionista</p>
                    <p className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                        {leaderboard[0]?.displayName ?? '—'}
                    </p>
                    {leaderboard[0] && (
                        <p className="text-xs text-[#64748b] mt-1">{leaderboard[0].count}/{leaderboard[0].total} sprites</p>
                    )}
                </div>
            </div>

            {leaderboard.length > 0 && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                        <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc]">Leaderboard Global</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                                    <th className="text-center px-4 py-3 text-[#64748b] font-bold text-xs uppercase w-12">#</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Usuario</th>
                                    <th className="text-right px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Sprites</th>
                                    <th className="text-right px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Completado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((entry, i) => (
                                    <tr key={entry.username} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0 hover:bg-[#f8fafc] dark:hover:bg-[#374151]/30">
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-sm font-black ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-[#94a3b8]' : i === 2 ? 'text-amber-700' : 'text-[#64748b]'}`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{entry.displayName}</p>
                                            <p className="text-xs text-[#64748b]">@{entry.username}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            {entry.count}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-20 h-1.5 bg-[#e2e8f0] dark:bg-[#374151] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-[#2563eb] to-[#7B61FF] rounded-full"
                                                        style={{ width: `${Math.round(entry.count / entry.total * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-[#64748b] w-10 text-right">
                                                    {Math.round(entry.count / entry.total * 100)}%
                                                </span>
                                            </div>
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminFortnite() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabId>('sprites');

    const renderTab = () => {
        switch (activeTab) {
            case 'sprites': return <SpritesTab />;
            case 'stats':   return <StatsTab />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin')}
                    className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-[#64748b]" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Fortnite Spirit Tracker</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">Gestiona el catalogo de sprites y ve las estadisticas de coleccion</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                <div className="flex flex-wrap gap-2">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === tab.id
                                        ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div>{renderTab()}</div>
        </div>
    );
}
