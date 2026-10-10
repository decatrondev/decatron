import { useState, useEffect } from 'react';
import { Terminal, Plus, Trash2, Save, RotateCcw, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../../services/api';

const cardClass = 'bg-ds-surface rounded-lg p-6 border border-ds-border ';
const inputClass = 'w-full px-4 py-2.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent';

const PERMISSIONS = [
    { value: 'everyone', label: 'Todos' },
    { value: 'subscriber', label: 'Suscriptores+' },
    { value: 'vip', label: 'VIP+' },
    { value: 'moderator', label: 'Moderadores+' },
    { value: 'broadcaster', label: 'Solo Broadcaster' },
];

const CMD_DESCRIPTIONS: Record<string, { label: string; desc: string; aliases: string }> = {
    pull: { label: 'Pull', desc: 'Tirar cartas', aliases: '!gcpull, !gacha pull' },
    pulls: { label: 'Pulls', desc: 'Ver tiros disponibles', aliases: '!gcpulls, !gacha pulls' },
    col: { label: 'Coleccion', desc: 'Ver coleccion', aliases: '!gccol, !gacha col' },
    top: { label: 'Ranking', desc: 'Top 3 coleccionistas + link al ranking', aliases: '!gctop, !gacha top' },
    buy: { label: 'Comprar', desc: 'Comprar tiros con coins', aliases: '!gcbuy, !gacha buy' },
    price: { label: 'Precio', desc: 'Ver precio de tiros', aliases: '!gcprice, !gacha price' },
    donate: { label: 'Donar', desc: 'Registrar donacion (mod)', aliases: '!gacha donate' },
    pause: { label: 'Pausar', desc: 'Pausar multi-pull', aliases: '!gcpause, !gacha pause' },
    resume: { label: 'Reanudar', desc: 'Reanudar multi-pull', aliases: '!gcresume, !gacha resume' },
};

const COMMANDS = ['pull', 'pulls', 'col', 'top', 'buy', 'price', 'donate', 'pause', 'resume'];

interface CmdConfig {
    id: number;
    command: string;
    enabled: boolean;
    permission: string;
    cooldownGlobal: number;
    cooldownUser: number;
    customResponse?: string;
}

interface CmdAlias {
    id: number;
    alias: string;
    targetCommand: string;
}

export const CommandsTab: React.FC = () => {
    const [configs, setConfigs] = useState<CmdConfig[]>([]);
    const [aliases, setAliases] = useState<CmdAlias[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [newAlias, setNewAlias] = useState('');
    const [newAliasTarget, setNewAliasTarget] = useState('pull');
    const [aliasMsg, setAliasMsg] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    // Multi-pull config
    const [multiPull, setMultiPull] = useState({ enabled: true, max: 10, delay: 10 });
    const [multiSaving, setMultiSaving] = useState(false);

    const loadData = async () => {
        try {
            const [cRes, aRes, iRes] = await Promise.all([
                api.get('/gacha/command-configs'),
                api.get('/gacha/command-aliases'),
                api.get('/gacha/integration-config'),
            ]);
            setConfigs(cRes.data.configs || []);
            setAliases(aRes.data.aliases || []);
            if (iRes.data.config) {
                setMultiPull({
                    enabled: iRes.data.config.multiPullEnabled ?? true,
                    max: iRes.data.config.multiPullMax ?? 10,
                    delay: iRes.data.config.multiPullDelay ?? 10,
                });
            }
        } catch (err) {
            console.error('Error loading command configs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const updateConfig = async (command: string, updates: Partial<CmdConfig>) => {
        const current = configs.find(c => c.command === command);
        if (!current) return;
        const payload = { ...current, ...updates };
        setSaving(command);
        try {
            await api.put(`/gacha/command-configs/${command}`, payload);
            setConfigs(prev => prev.map(c => c.command === command ? { ...c, ...updates } : c));
        } catch (err) {
            console.error('Error updating command:', err);
        } finally {
            setSaving(null);
        }
    };

    const addAlias = async () => {
        if (!newAlias.trim()) return;
        try {
            await api.post('/gacha/command-aliases', { alias: newAlias.trim(), targetCommand: newAliasTarget });
            setNewAlias('');
            setAliasMsg('');
            loadData();
        } catch (err: any) {
            setAliasMsg(err.response?.data?.message || 'Error al crear alias');
        }
    };

    const deleteAlias = async (alias: string) => {
        try {
            await api.delete(`/gacha/command-aliases/${alias}`);
            setAliases(prev => prev.filter(a => a.alias !== alias));
        } catch (err) {
            console.error('Error deleting alias:', err);
        }
    };

    const saveMultiPull = async () => {
        setMultiSaving(true);
        try {
            // We need to save via integration-config endpoint
            const current = (await api.get('/gacha/integration-config')).data.config || {};
            await api.post('/gacha/integration-config', {
                ...current,
                multiPullEnabled: multiPull.enabled,
                multiPullMax: multiPull.max,
                multiPullDelay: multiPull.delay,
            });
        } catch (err) {
            console.error('Error saving multi-pull config:', err);
        } finally {
            setMultiSaving(false);
        }
    };

    if (loading) {
        return <div className={cardClass}><p className="text-center text-ds-soft py-8">Cargando comandos...</p></div>;
    }

    return (
        <div className="space-y-6">
            {/* Help Banner */}
            <div className="rounded-lg border border-ds-border bg-ds-bg overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-ds-soft flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-ds-soft">Como funcionan los comandos</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-ds-soft">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Cada comando del gacha tiene <strong className="text-ds-text">permisos</strong> (todos, sub, vip, mod, broadcaster)</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span>Configura <strong className="text-ds-text">cooldowns</strong> globales y por usuario para evitar spam</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span>Crea <strong className="text-ds-text">aliases</strong> personalizados (ej: !go → !gcpull)</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span>Configura el <strong className="text-ds-text">multi-pull</strong> (max tiros y delay entre cada uno)</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-ds-raised text-xs">
                            <strong className="text-ds-text">Tip:</strong> Los aliases se resuelven a nivel global del bot. Si creas !go como alias de pull, funcionara en todo el chat.
                        </div>
                    </div>
                )}
            </div>

            {/* Commands List */}
            <div className={cardClass}>
                <h2 className="text-xl font-black text-ds-text flex items-center gap-2 mb-4">
                    <Terminal className="w-5 h-5" /> Comandos ({configs.length})
                </h2>
                <div className="space-y-3">
                    {configs.map(cfg => {
                        const info = CMD_DESCRIPTIONS[cfg.command] || { label: cfg.command, desc: '', aliases: '' };
                        return (
                            <div key={cfg.command} className={`p-4 rounded-lg border transition-all ${cfg.enabled ? 'bg-ds-bg border-ds-border ' : 'bg-ds-bg border-ds-border opacity-60'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <span className="font-bold text-ds-text">{info.label}</span>
                                        <span className="text-xs text-ds-soft ml-2">{info.desc}</span>
                                        <p className="text-[10px] text-ds-soft mt-0.5">{info.aliases}</p>
                                    </div>
                                    <button
                                        onClick={() => updateConfig(cfg.command, { enabled: !cfg.enabled })}
                                        className={`w-12 h-6 rounded-full transition-colors ${cfg.enabled ? 'bg-ds-accent' : 'bg-ds-raised '}`}
                                    >
                                        <div className={`w-5 h-5 bg-ds-surface rounded-full shadow transition-transform ${cfg.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                                {cfg.enabled && (
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-ds-soft">Permiso:</span>
                                            <select
                                                value={cfg.permission}
                                                onChange={e => updateConfig(cfg.command, { permission: e.target.value })}
                                                className="ds-input"
                                            >
                                                {PERMISSIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-ds-soft">CD Global:</span>
                                            <input
                                                type="number" min={0} max={300}
                                                value={cfg.cooldownGlobal}
                                                onChange={e => updateConfig(cfg.command, { cooldownGlobal: Math.max(0, parseInt(e.target.value) || 0) })}
                                                className="ds-input w-16 text-center"
                                            />
                                            <span className="text-[10px] text-ds-soft">s</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-ds-soft">CD Usuario:</span>
                                            <input
                                                type="number" min={0} max={300}
                                                value={cfg.cooldownUser}
                                                onChange={e => updateConfig(cfg.command, { cooldownUser: Math.max(0, parseInt(e.target.value) || 0) })}
                                                className="ds-input w-16 text-center"
                                            />
                                            <span className="text-[10px] text-ds-soft">s</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Aliases */}
            <div className={cardClass}>
                <h2 className="text-lg font-black text-ds-text mb-4">Aliases Personalizados</h2>
                <p className="text-xs text-ds-soft mb-3">Los aliases base (!gc*, !gacha *) siempre funcionan. Agrega tus propios atajos.</p>

                {aliases.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {aliases.map(a => (
                            <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-ds-bg rounded-lg border border-ds-border">
                                <div>
                                    <span className="font-bold text-ds-accent-text">!{a.alias}</span>
                                    <span className="text-xs text-ds-soft mx-2">→</span>
                                    <span className="text-sm text-ds-text">{CMD_DESCRIPTIONS[a.targetCommand]?.label || a.targetCommand}</span>
                                </div>
                                <button onClick={() => deleteAlias(a.alias)} className="p-1.5 text-ds-danger hover:bg-ds-danger/10 rounded-lg">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <span className="text-sm text-ds-soft">!</span>
                    <input
                        type="text"
                        value={newAlias}
                        onChange={e => setNewAlias(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())}
                        placeholder="micomando"
                        className={`${inputClass} w-40`}
                    />
                    <span className="text-xs text-ds-soft">→</span>
                    <select value={newAliasTarget} onChange={e => setNewAliasTarget(e.target.value)} className={`${inputClass} w-40`}>
                        {COMMANDS.map(c => <option key={c} value={c}>{CMD_DESCRIPTIONS[c]?.label || c}</option>)}
                    </select>
                    <button onClick={addAlias} disabled={!newAlias.trim()} className="ds-btn ds-btn--primary">
                        <Plus className="w-4 h-4" /> Agregar
                    </button>
                </div>
                {aliasMsg && <p className="text-xs text-ds-danger mt-2">{aliasMsg}</p>}
            </div>

            {/* Multi-Pull Config */}
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black text-ds-text">Multi-Pull</h2>
                    <button onClick={saveMultiPull} disabled={multiSaving} className="ds-btn ds-btn--primary">
                        <Save className="w-4 h-4" /> {multiSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="font-bold text-ds-text">Habilitado</span>
                            <p className="text-xs text-ds-soft">Permite !gcpull 5 (multiples tiros)</p>
                        </div>
                        <button onClick={() => setMultiPull(p => ({ ...p, enabled: !p.enabled }))} className={`w-12 h-6 rounded-full transition-colors ${multiPull.enabled ? 'bg-ds-accent' : 'bg-ds-raised '}`}>
                            <div className={`w-5 h-5 bg-ds-surface rounded-full shadow transition-transform ${multiPull.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    {multiPull.enabled && (
                        <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-ds-text">Max pulls por sesion</span>
                                    <p className="text-xs text-ds-soft">1 a 50 tiros por comando</p>
                                </div>
                                <input
                                    type="number" min={1} max={50}
                                    value={multiPull.max}
                                    onChange={e => setMultiPull(p => ({ ...p, max: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) }))}
                                    className={`${inputClass} w-20 text-center`}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-ds-text">Delay entre pulls</span>
                                    <p className="text-xs text-ds-soft">Segundos entre cada tiro (5-30)</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number" min={5} max={30}
                                        value={multiPull.delay}
                                        onChange={e => setMultiPull(p => ({ ...p, delay: Math.max(5, Math.min(30, parseInt(e.target.value) || 10)) }))}
                                        className={`${inputClass} w-20 text-center`}
                                    />
                                    <span className="text-xs text-ds-soft">s</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
