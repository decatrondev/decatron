import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Megaphone, Plus, Save, Trash2, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { GameOverlayCard, CARD_LABELS } from '../features/game-overlays/GameOverlayCard';
import { AccountOverlayState, GameId, OverlayState, PromoItem, defaultGameConfig, formatTier, GAME_IDS, GAME_NAMES } from '../features/game-overlays/types';

interface Promo {
    id: number; isEnabled: boolean; weight: number; sortOrder: number;
    titleEs: string; titleEn: string; lineEs: string; lineEn: string;
    imageUrl: string | null; durationSeconds: number; games: string | null;
    createdAt?: string; updatedAt?: string;
}

const EMPTY: Promo = { id: 0, isEnabled: true, weight: 1, sortOrder: 0, titleEs: 'Consigue Decatron gratis en', titleEn: 'Get Decatron for free at', lineEs: '', lineEn: '', imageUrl: null, durationSeconds: 8, games: null };

const cardClass = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';
const h2 = 'text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4';
const muted = 'text-xs text-[#64748b] dark:text-[#94a3b8]';
const input = 'w-full px-3 py-2 rounded-lg bg-[#f8fafc] dark:bg-[#111214] border border-[#e2e8f0] dark:border-[#374151] text-sm text-[#1e293b] dark:text-[#f8fafc]';
const label = 'block text-[11px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8] mb-1';

/**
 * Admin → Anuncios de Game Overlays: el catálogo que tapa la tarjeta de la cuenta cada
 * cierto tiempo. Lo maneja el dueño de la plataforma, no el streamer (él solo puede
 * apagarlo desde Supporter). Plan: .dev/plans/LIVE_MATCH_OVERLAY_PLAN.md §2.3.
 */
export default function GameOverlayPromosAdmin() {
    const navigate = useNavigate();
    const [promos, setPromos] = useState<Promo[]>([]);
    const [everySeconds, setEverySeconds] = useState(180);
    const [editing, setEditing] = useState<Promo | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<AccountOverlayState | null>(null);
    const [previewLang, setPreviewLang] = useState<'es' | 'en'>('es');
    const [previewLayout, setPreviewLayout] = useState<'card' | 'compact' | 'bar'>('card');

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const r = await api.get('/admin/game-overlays/promos');
            setPromos(r.data.promos ?? []);
            setEverySeconds(r.data.everySeconds ?? 180);
        } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Error'); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        fetch('/api/game-overlays/preview-public?game=lol').then(r => r.json())
            .then((d: { success: boolean; state: OverlayState }) => { if (d.success) setPreview(d.state.accounts[0] ?? null); }).catch(() => {});
    }, []);

    const saveSettings = async () => {
        setSaving(true);
        try { await api.put('/admin/game-overlays/promos/settings', { everySeconds }); }
        catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Error'); }
        finally { setSaving(false); }
    };
    const savePromo = async () => {
        if (!editing) return;
        setSaving(true); setError(null);
        try { await api.put('/admin/game-overlays/promos', editing); setEditing(null); await load(); }
        catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Error'); }
        finally { setSaving(false); }
    };
    const toggle = async (p: Promo) => {
        try { await api.put('/admin/game-overlays/promos', { ...p, isEnabled: !p.isEnabled }); await load(); }
        catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Error'); }
    };
    const remove = async (p: Promo) => {
        if (!confirm(`¿Borrar el anuncio "${p.lineEs}"?`)) return;
        try { await api.delete(`/admin/game-overlays/promos/${p.id}`); await load(); }
        catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Error'); }
    };

    const previewItem: PromoItem | null = editing
        ? { id: editing.id, title: previewLang === 'en' && editing.titleEn ? editing.titleEn : editing.titleEs, line: previewLang === 'en' && editing.lineEn ? editing.lineEn : editing.lineEs, imageUrl: editing.imageUrl, weight: editing.weight, durationSeconds: editing.durationSeconds }
        : null;
    const previewCfg = { ...defaultGameConfig('lol' as GameId), layout: previewLayout, size: previewLayout === 'bar' ? { width: 1100, height: 64 } : previewLayout === 'compact' ? { width: 500, height: 130 } : { width: 340, height: 250 } };
    const totalWeight = promos.filter(p => p.isEnabled).reduce((s, p) => s + p.weight, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/admin')} className="p-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626]"><ArrowLeft className="w-5 h-5" /></button>
                <Megaphone className="w-6 h-6 text-[#2563eb]" />
                <div>
                    <h1 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Anuncios de Game Overlays</h1>
                    <p className={muted}>Tapan la tarjeta de rango del streamer unos segundos. El streamer no los edita: solo los apaga si es Supporter o más.</p>
                </div>
                <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#262626]" title="Recargar"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {error && <div className="rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 text-sm px-4 py-2">{error}</div>}

            <div className={cardClass}>
                <h2 className={h2}>Frecuencia</h2>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-48"><label className={label}>Cada cuántos segundos</label><input type="number" min={30} max={1800} className={input} value={everySeconds} onChange={e => setEverySeconds(Number(e.target.value))} /></div>
                    <button onClick={saveSettings} disabled={saving} className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2"><Save className="w-4 h-4" />Guardar</button>
                    <span className={muted}>Se aplica a todos los canales. Cada anuncio tiene su propia duración. El overlay lo relee en menos de un minuto.</span>
                </div>
            </div>

            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={h2 + ' mb-0'}>Catálogo ({promos.length})</h2>
                    <button onClick={() => setEditing({ ...EMPTY, sortOrder: promos.length })} className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo anuncio</button>
                </div>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : promos.length === 0 ? <p className={muted}>Sin anuncios: el overlay usa el mensaje de fábrica.</p> : (
                    <div className="space-y-2">
                        {promos.map(p => (
                            <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${p.isEnabled ? 'border-[#e2e8f0] dark:border-[#374151]' : 'border-dashed border-[#cbd5e1] dark:border-[#4b5563] opacity-60'}`}>
                                <button onClick={() => toggle(p)} className={`w-10 h-6 rounded-full relative transition-colors ${p.isEnabled ? 'bg-emerald-500' : 'bg-[#94a3b8]'}`} title={p.isEnabled ? 'Activo' : 'Apagado'}>
                                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${p.isEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                                </button>
                                <div className="flex-1 min-w-[240px]">
                                    <div className="text-sm text-[#1e293b] dark:text-[#f8fafc] font-medium">{p.lineEs}</div>
                                    <div className={muted}>{p.lineEn || <em>sin inglés (usa el español)</em>}</div>
                                </div>
                                <div className={muted + ' text-right'}>
                                    <div>peso {p.weight}{totalWeight > 0 && p.isEnabled ? ` · ${Math.round(100 * p.weight / totalWeight)}%` : ''} · {p.durationSeconds} s</div>
                                    <div>{p.games ? `solo ${p.games}` : 'todos los juegos'}{p.imageUrl ? ' · imagen propia' : ''}</div>
                                </div>
                                <button onClick={() => setEditing({ ...p })} className="px-3 py-1.5 rounded-lg bg-[#f1f5f9] dark:bg-[#262626] text-sm">Editar</button>
                                <button onClick={() => remove(p)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400" title="Borrar"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {editing && (
                <div className={cardClass}>
                    <h2 className={h2}>{editing.id ? `Editar anuncio #${editing.id}` : 'Nuevo anuncio'}</h2>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={label}>Título (es)</label><input className={input} value={editing.titleEs} onChange={e => setEditing({ ...editing, titleEs: e.target.value })} /></div>
                                <div><label className={label}>Título (en)</label><input className={input} value={editing.titleEn} onChange={e => setEditing({ ...editing, titleEn: e.target.value })} /></div>
                            </div>
                            <div><label className={label}>Mensaje (es) *</label><textarea rows={2} className={input} value={editing.lineEs} onChange={e => setEditing({ ...editing, lineEs: e.target.value })} /></div>
                            <div><label className={label}>Mensaje (en)</label><textarea rows={2} className={input} value={editing.lineEn} onChange={e => setEditing({ ...editing, lineEn: e.target.value })} /></div>
                            <div><label className={label}>Imagen (URL, opcional; vacío = logo de Decatron)</label><input className={input} value={editing.imageUrl ?? ''} onChange={e => setEditing({ ...editing, imageUrl: e.target.value || null })} placeholder="/brand/decatron-lockup-light.png" /></div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={label}>Peso</label><input type="number" min={0} max={100} className={input} value={editing.weight} onChange={e => setEditing({ ...editing, weight: Number(e.target.value) })} /></div>
                                <div><label className={label}>Duración (s)</label><input type="number" min={3} max={30} className={input} value={editing.durationSeconds} onChange={e => setEditing({ ...editing, durationSeconds: Number(e.target.value) })} /></div>
                                <div><label className={label}>Orden</label><input type="number" className={input} value={editing.sortOrder} onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })} /></div>
                            </div>
                            <div>
                                <label className={label}>Juegos (vacío = todos)</label>
                                <div className="flex flex-wrap gap-2">
                                    {GAME_IDS.map(g => {
                                        const set = new Set((editing.games ?? '').split(',').map(x => x.trim()).filter(Boolean));
                                        const on = set.has(g);
                                        return <button key={g} onClick={() => { if (on) set.delete(g); else set.add(g); setEditing({ ...editing, games: set.size ? [...set].join(',') : null }); }} className={`px-2.5 py-1 rounded-lg text-xs border ${on ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#f8fafc] dark:bg-[#111214] border-[#e2e8f0] dark:border-[#374151]'}`}>{GAME_NAMES[g]}</button>;
                                    })}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isEnabled} onChange={e => setEditing({ ...editing, isEnabled: e.target.checked })} />Activo</label>
                                <button onClick={savePromo} disabled={saving || !editing.lineEs.trim()} className="ml-auto px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar</button>
                                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-[#f1f5f9] dark:bg-[#262626] text-sm">Cancelar</button>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={muted}>Vista previa</span>
                                {(['card', 'compact', 'bar'] as const).map(l => <button key={l} onClick={() => setPreviewLayout(l)} className={`px-2 py-0.5 rounded text-xs border ${previewLayout === l ? 'bg-blue-600 border-blue-500 text-white' : 'border-[#374151]'}`}>{l}</button>)}
                                {(['es', 'en'] as const).map(l => <button key={l} onClick={() => setPreviewLang(l)} className={`px-2 py-0.5 rounded text-xs border ${previewLang === l ? 'bg-blue-600 border-blue-500 text-white' : 'border-[#374151]'}`}>{l.toUpperCase()}</button>)}
                            </div>
                            <div className="rounded-xl p-4 overflow-auto" style={{ background: 'radial-gradient(800px 300px at 30% 20%, #1c2230 0%, #0b0d10 60%)' }}>
                                {preview && <GameOverlayCard game="lol" gameName="League of Legends" config={previewCfg} account={preview} view="promo" promo={previewItem} accountIndex={0} accountCount={1} switchAnimation="none" formatTier={formatTier} lang={previewLang} labels={CARD_LABELS[previewLang]} />}
                            </div>
                            <p className={muted + ' mt-2'}>Con el fondo y acento por defecto; en OBS usa los del streamer, en su misma caja.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
