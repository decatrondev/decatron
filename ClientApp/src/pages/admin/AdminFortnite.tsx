import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Plus, Pencil, Trash2, Save, X,
    LayoutGrid, BarChart3, Check, AlertTriangle, RefreshCw,
    Eye, EyeOff, DownloadCloud
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
const THEMES   = ['Basic', 'Gold', 'Candy', 'Galaxy', 'Gem', 'Holofoil', 'Cube', 'Rift/Cube', 'Cheat', 'Quack', 'Hacker'];

const RARITY_COLORS: Record<string, string> = {
    Rare: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/30',
    Special: 'bg-ds-accent/20 text-ds-ok border-ds-ok/40',
    Epic: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/30',
    Legendary: 'bg-ds-warn/20 text-ds-warn border-ds-warn/40',
    Mythic: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/30',
};

// ─── Shared UI ───────────────────────────────────────────────────────────────

function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
        </div>
    );
}

function FormField({ label, value, onChange, type = 'text', placeholder, disabled }: {
    label: string; value: any; onChange: (v: string) => void;
    type?: string; placeholder?: string; disabled?: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">{label}</label>
            <input
                type={type}
                value={value ?? ''}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="ds-input w-full"
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
            <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="ds-input w-full"
            >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ds-input/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-ds-surface rounded-lg border border-ds-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-ds-text">{title}</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-ds-raised rounded-lg transition-colors">
                        <X className="w-5 h-5 text-ds-soft" />
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
    const [filterSeason, setFilterSeason] = useState('');
    const [allSeasons, setAllSeasons] = useState<string[]>([]);
    const [currentSeason, setCurrentSeason] = useState('');
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: Partial<FortniteSprite> } | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [testUsername, setTestUsername] = useState('');
    const [testingNotify, setTestingNotify] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const [syncing, setSyncing] = useState<'preview' | 'apply' | null>(null);
    const [syncResult, setSyncResult] = useState<{ ok: boolean; dryRun: boolean; msg: string; output: string } | null>(null);

    // Corre el mismo sync del cron horario contra la API propia, sin esperar a la proxima hora
    const handleSync = async (dryRun: boolean) => {
        setSyncing(dryRun ? 'preview' : 'apply');
        setSyncResult(null);
        try {
            const r = await api.post(`/admin/fortnite/sync?dryRun=${dryRun}`, null, { timeout: 200000 });
            setSyncResult({ ok: r.data.success, dryRun, msg: r.data.message, output: r.data.output ?? '' });
            if (!dryRun && r.data.success) load();
        } catch (e: any) {
            setSyncResult({ ok: false, dryRun, msg: e.response?.data?.message || 'Error al sincronizar', output: e.response?.data?.output ?? '' });
        }
        setSyncing(null);
    };

    const handleTestNotify = async (channel: 'twitch' | 'discord') => {
        if (!testUsername.trim()) return;
        setTestingNotify(true);
        setTestResult(null);
        try {
            const endpoint = channel === 'twitch' ? 'test-twitch-notify' : 'test-discord-notify';
            const r = await api.post(`/admin/fortnite/${endpoint}/${testUsername.trim().toLowerCase()}`);
            setTestResult({ ok: true, msg: r.data.message });
        } catch (e: any) {
            setTestResult({ ok: false, msg: e.response?.data?.message || 'Error al probar el aviso' });
        }
        setTestingNotify(false);
    };

    const load = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterCharacter) params.set('character', filterCharacter);
        if (filterRarity) params.set('rarity', filterRarity);
        if (filterUnreleased) params.set('unreleased', filterUnreleased);
        if (filterSeason) params.set('season', filterSeason);

        api.get(`/admin/fortnite/sprites${params.toString() ? '?' + params.toString() : ''}`)
            .then(r => { setSprites(r.data.sprites ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [filterCharacter, filterRarity, filterUnreleased, filterSeason]);

    useEffect(() => { load(); }, [load]);

    // Temporada actual + lista de temporadas: fuente unica en el backend
    useEffect(() => {
        api.get('/fortnite/current-season')
            .then(r => {
                setCurrentSeason(r.data.currentSeason ?? '');
                const found = [...(r.data.seasons ?? [])] as string[];
                found.sort((a, b) => a === r.data.currentSeason ? -1 : b === r.data.currentSeason ? 1 : a.localeCompare(b));
                setAllSeasons(found);
            })
            .catch(() => {});
    }, []);

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
            {/* Importar desde la API propia (decatron-fortnite-api) sin esperar al cron horario */}
            <div className="bg-ds-bg rounded-lg p-3 border border-ds-border space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-ds-soft uppercase">Importar desde la API</span>
                    <span className="text-xs text-ds-soft">Corre solo cada hora; aqui lo puedes forzar tras subir un parche</span>
                    <div className="flex-1" />
                    <button
                        onClick={() => handleSync(true)}
                        disabled={syncing !== null}
                        className="ds-btn ds-btn--secondary ds-btn--sm"
                    >
                        {syncing === 'preview' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                        Ver cambios
                    </button>
                    <button
                        onClick={() => handleSync(false)}
                        disabled={syncing !== null}
                        className="ds-btn ds-btn--primary ds-btn--sm"
                    >
                        {syncing === 'apply' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                        Sincronizar ahora
                    </button>
                </div>
                {syncResult && (
                    <div className="space-y-2">
                        <div className={`flex items-center gap-1.5 text-xs font-semibold ${syncResult.ok ? 'text-ds-ok ' : 'text-ds-danger '}`}>
                            {syncResult.ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            {syncResult.msg}
                        </div>
                        {syncResult.output && (
                            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words bg-ds-surface border border-ds-border rounded-lg p-3 text-xs font-mono text-ds-text">
                                {syncResult.output}
                            </pre>
                        )}
                    </div>
                )}
            </div>

            {/* Probar aviso de Twitch a mano — simula que el stream de ese usuario recien arranco */}
            <div className="flex flex-wrap items-center gap-2 bg-ds-bg rounded-lg p-3 border border-ds-border">
                <span className="text-xs font-bold text-ds-soft uppercase">Probar aviso</span>
                <input
                    type="text"
                    value={testUsername}
                    onChange={e => setTestUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTestNotify('twitch')}
                    placeholder="username"
                    className="ds-input w-40"
                />
                <button
                    onClick={() => handleTestNotify('twitch')}
                    disabled={testingNotify || !testUsername.trim()}
                    className="ds-btn ds-btn--primary ds-btn--sm"
                >
                    {testingNotify ? 'Enviando...' : 'Twitch'}
                </button>
                <button
                    onClick={() => handleTestNotify('discord')}
                    disabled={testingNotify || !testUsername.trim()}
                    className="px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 text-ds-text rounded-lg text-xs font-bold transition-colors"
                >
                    {testingNotify ? 'Enviando...' : 'Discord'}
                </button>
                {testResult && (
                    <span className={`text-xs font-semibold ${testResult.ok ? 'text-ds-ok ' : 'text-ds-danger '}`}>
                        {testResult.msg}
                    </span>
                )}
            </div>

            {/* Filters + Add button */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={filterCharacter}
                    onChange={e => setFilterCharacter(e.target.value)}
                    className="ds-input"
                >
                    <option value="">Todos los personajes</option>
                    {characters.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                    value={filterRarity}
                    onChange={e => setFilterRarity(e.target.value)}
                    className="ds-input"
                >
                    <option value="">Todas las rarezas</option>
                    {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select
                    value={filterUnreleased}
                    onChange={e => setFilterUnreleased(e.target.value as any)}
                    className="ds-input"
                >
                    <option value="">Todos</option>
                    <option value="false">Lanzados</option>
                    <option value="true">No lanzados</option>
                </select>

                <select
                    value={filterSeason}
                    onChange={e => setFilterSeason(e.target.value)}
                    className="ds-input"
                >
                    <option value="">Todas las temporadas</option>
                    {allSeasons.map(s => (
                        <option key={s} value={s}>{s === currentSeason ? `${s} (actual)` : s}</option>
                    ))}
                </select>

                <button
                    onClick={load}
                    className="ds-btn ds-btn--ghost ds-icon-btn"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>

                <div className="flex-1" />

                <button
                    onClick={() => { setModal({ mode: 'create', data: { ...emptySprite } }); setSaveError(null); }}
                    className="ds-btn ds-btn--primary"
                >
                    <Plus className="w-4 h-4" /> Nuevo sprite
                </button>
            </div>

            {/* Table */}
            {loading ? <LoadingSpinner /> : (
                <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ds-border">
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Imagen</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Nombre</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Personaje</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Tema</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Rareza</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Temporada</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Clave</th>
                                    <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Estado</th>
                                    <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sprites.map(sprite => (
                                    <tr key={sprite.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                        <td className="px-4 py-3">
                                            {sprite.imageUrl ? (
                                                <img src={sprite.imageUrl} alt={sprite.name} className="w-10 h-10 object-contain rounded-lg bg-ds-raised" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-ds-raised flex items-center justify-center">
                                                    <span className="text-[10px] text-ds-soft">—</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-ds-text">{sprite.name}</td>
                                        <td className="px-4 py-3 text-ds-soft">{sprite.character}</td>
                                        <td className="px-4 py-3 text-ds-soft">{sprite.theme}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${RARITY_COLORS[sprite.rarity] ?? 'bg-ds-faint/20 text-ds-soft border-ds-border/30'}`}>
                                                {sprite.rarity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {sprite.season ? (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                                                    sprite.season === currentSeason
                                                        ? 'bg-[#7B61FF]/10 text-[#7B61FF] border-[#7B61FF]/30'
                                                        : 'bg-ds-faint/10 text-ds-soft border-ds-border/20'
                                                }`}>
                                                    {sprite.season}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-ds-soft">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-ds-soft">{sprite.spriteKey}</td>
                                        <td className="px-4 py-3 text-center">
                                            {sprite.isUnreleased ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-ds-warn/10 text-ds-warn border border-ds-warn/40">
                                                    <EyeOff className="w-3 h-3" /> Unreleased
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-ds-accent/10 text-ds-ok border border-ds-ok/40">
                                                    <Eye className="w-3 h-3" /> Activo
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => { setModal({ mode: 'edit', data: { ...sprite } }); setSaveError(null); }}
                                                    className="p-1.5 hover:bg-ds-raised rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4 text-ds-soft" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(sprite.id)}
                                                    className="p-1.5 hover:bg-ds-danger-solid/10 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4 text-ds-danger" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sprites.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-12 text-center text-ds-soft">
                                            No hay sprites
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t border-ds-border text-xs text-ds-soft">
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
                            <div className="p-3 bg-ds-danger-solid/10 border border-ds-danger/40 rounded-lg text-sm text-ds-danger flex items-center gap-2">
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
                                className="w-4 h-4 rounded border-ds-border text-ds-accent-text focus:ring-ds-accent"
                            />
                            <span className="text-sm text-ds-text">No lanzado (Unreleased)</span>
                        </label>

                        {/* Preview */}
                        {modal.data.imageUrl && (
                            <div className="p-3 bg-ds-bg rounded-lg flex items-center gap-3">
                                <img
                                    src={modal.data.imageUrl}
                                    alt="preview"
                                    className="w-12 h-12 object-contain rounded-lg"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <div>
                                    <p className="text-sm font-bold text-ds-text">{modal.data.name || '—'}</p>
                                    <p className="text-xs text-ds-soft">{modal.data.character} · {modal.data.theme} · {modal.data.rarity}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => setModal(null)}
                                className="px-4 py-2 bg-ds-bg text-ds-soft rounded-lg text-sm font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="ds-btn ds-btn--primary"
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
                        <p className="text-sm text-ds-soft">
                            Esta accion eliminara el sprite y <strong className="text-ds-text">todas las colecciones de usuarios</strong> que lo tengan marcado. No se puede deshacer.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 bg-ds-bg text-ds-soft rounded-lg text-sm font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="ds-btn ds-btn--danger"
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
                <div className="bg-ds-surface rounded-lg p-5 border border-ds-border">
                    <p className="text-xs font-bold text-ds-soft uppercase mb-1">Total sprites</p>
                    <p className="text-3xl font-black text-ds-text">{total}</p>
                </div>
                <div className="bg-ds-surface rounded-lg p-5 border border-ds-border">
                    <p className="text-xs font-bold text-ds-soft uppercase mb-1">Usuarios en leaderboard</p>
                    <p className="text-3xl font-black text-ds-text">{leaderboard.length}</p>
                </div>
                <div className="bg-ds-surface rounded-lg p-5 border border-ds-border">
                    <p className="text-xs font-bold text-ds-soft uppercase mb-1">Top coleccionista</p>
                    <p className="text-3xl font-black text-ds-text">
                        {leaderboard[0]?.displayName ?? '—'}
                    </p>
                    {leaderboard[0] && (
                        <p className="text-xs text-ds-soft mt-1">{leaderboard[0].count}/{leaderboard[0].total} sprites</p>
                    )}
                </div>
            </div>

            {leaderboard.length > 0 && (
                <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                    <div className="px-6 py-4 border-b border-ds-border">
                        <h3 className="font-black text-ds-text">Leaderboard Global</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ds-border">
                                    <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase w-12">#</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Usuario</th>
                                    <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Sprites</th>
                                    <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Completado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((entry, i) => (
                                    <tr key={entry.username} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-sm font-black ${i === 0 ? 'text-ds-warn' : i === 1 ? 'text-ds-soft' : i === 2 ? 'text-ds-warn' : 'text-ds-soft'}`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-ds-text">{entry.displayName}</p>
                                            <p className="text-xs text-ds-soft">@{entry.username}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-ds-text">
                                            {entry.count}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-20 h-1.5 bg-ds-raised rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-ds-accent to-[#7B61FF] rounded-full"
                                                        style={{ width: `${Math.round(entry.count / entry.total * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-ds-soft w-10 text-right">
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
        <div className="panel-scale space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin')}
                    className="p-2 hover:bg-ds-raised rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-ds-soft" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-ds-text">Fortnite Spirit Tracker</h1>
                    <p className="text-ds-soft mt-1">Gestiona el catalogo de sprites y ve las estadisticas de coleccion</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                <div className="flex flex-wrap gap-2">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={activeTab === tab.id ? 'ds-btn ds-btn--primary whitespace-nowrap' : 'ds-btn ds-btn--secondary whitespace-nowrap'}
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
