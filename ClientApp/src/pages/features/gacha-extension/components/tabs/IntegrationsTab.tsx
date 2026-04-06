import React, { useState, useEffect } from 'react';
import { Link2, DollarSign, Coins, Save, Zap, Star, Gift, Diamond } from 'lucide-react';
import api from '../../../../../services/api';

interface IntegrationConfig {
    tipsEnabled: boolean;
    pullsPerDollar: number;
    bitsEnabled: boolean;
    bitsPerPull: number;
    subsEnabled: boolean;
    pullsSubPrime: number;
    pullsSubTier1: number;
    pullsSubTier2: number;
    pullsSubTier3: number;
    giftSubsEnabled: boolean;
    pullsPerGift: number;
    coinsEnabled: boolean;
    coinsPerPull: number;
    coinsDailyLimit: number;
}

const defaultConfig: IntegrationConfig = {
    tipsEnabled: false, pullsPerDollar: 1,
    bitsEnabled: false, bitsPerPull: 100,
    subsEnabled: false, pullsSubPrime: 1, pullsSubTier1: 2, pullsSubTier2: 3, pullsSubTier3: 5,
    giftSubsEnabled: false, pullsPerGift: 1,
    coinsEnabled: false, coinsPerPull: 500, coinsDailyLimit: 0,
};

const inputClass = 'w-20 px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-center text-[#1e293b] dark:text-[#f8fafc]';

export const IntegrationsTab: React.FC = () => {
    const [config, setConfig] = useState<IntegrationConfig>(defaultConfig);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/gacha/integration-config');
                setConfig(res.data.config || defaultConfig);
            } catch { /* use defaults */ }
            finally { setLoading(false); }
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.post('/gacha/integration-config', config);
            setConfig(res.data.config || config);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch { /* error */ }
        finally { setSaving(false); }
    };

    const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
        <button onClick={() => onChange(!checked)} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${checked ? 'bg-green-600 text-white shadow-lg shadow-green-600/25' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            {checked ? 'Activado' : 'Desactivado'}
        </button>
    );

    if (loading) return <p className="text-center text-[#64748b] py-8">Cargando...</p>;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-xl">
                        <Link2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Integraciones</h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Conecta eventos de Twitch con el gacha para dar tiros automaticamente</p>
                    </div>
                </div>
            </div>

            {/* Bits */}
            <Section icon={<Diamond className="w-5 h-5 text-purple-500" />} title="Bits" desc="Viewers donan bits y reciben tiros automaticamente" enabled={config.bitsEnabled} onToggle={v => setConfig({ ...config, bitsEnabled: v })}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-[#64748b]">Cada</span>
                    <input type="number" min={1} value={config.bitsPerPull} onChange={e => setConfig({ ...config, bitsPerPull: Math.max(1, parseInt(e.target.value) || 100) })} className={inputClass} />
                    <span className="text-sm text-[#64748b]">bits = 1 tiro</span>
                </div>
                <Example text={`500 bits con ${config.bitsPerPull} bits/tiro = ${Math.floor(500 / config.bitsPerPull)} tiros`} />
            </Section>

            {/* Subscriptions */}
            <Section icon={<Star className="w-5 h-5 text-yellow-500" />} title="Suscripciones" desc="Viewers que se suscriben reciben tiros segun su tier" enabled={config.subsEnabled} onToggle={v => setConfig({ ...config, subsEnabled: v })}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <TierInput label="Prime" value={config.pullsSubPrime} onChange={v => setConfig({ ...config, pullsSubPrime: v })} color="#6366f1" />
                    <TierInput label="Tier 1" value={config.pullsSubTier1} onChange={v => setConfig({ ...config, pullsSubTier1: v })} color="#3b82f6" />
                    <TierInput label="Tier 2" value={config.pullsSubTier2} onChange={v => setConfig({ ...config, pullsSubTier2: v })} color="#a855f7" />
                    <TierInput label="Tier 3" value={config.pullsSubTier3} onChange={v => setConfig({ ...config, pullsSubTier3: v })} color="#f59e0b" />
                </div>
            </Section>

            {/* Gift Subs */}
            <Section icon={<Gift className="w-5 h-5 text-pink-500" />} title="Gift Subs" desc="El que regala suscripciones recibe tiros" enabled={config.giftSubsEnabled} onToggle={v => setConfig({ ...config, giftSubsEnabled: v })}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-[#64748b]">Cada gift sub =</span>
                    <input type="number" min={1} value={config.pullsPerGift} onChange={e => setConfig({ ...config, pullsPerGift: Math.max(1, parseInt(e.target.value) || 1) })} className={inputClass} />
                    <span className="text-sm text-[#64748b]">tiro(s)</span>
                </div>
                <Example text={`Regalar 5 subs con ${config.pullsPerGift} tiro/gift = ${5 * config.pullsPerGift} tiros para el que regala`} />
            </Section>

            {/* Tips */}
            <Section icon={<DollarSign className="w-5 h-5 text-green-500" />} title="Tips / PayPal" desc="Donaciones via PayPal se convierten en tiros" enabled={config.tipsEnabled} onToggle={v => setConfig({ ...config, tipsEnabled: v })}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-[#64748b]">Cada $1 =</span>
                    <input type="number" min={1} value={config.pullsPerDollar} onChange={e => setConfig({ ...config, pullsPerDollar: Math.max(1, parseInt(e.target.value) || 1) })} className={inputClass} />
                    <span className="text-sm text-[#64748b]">tiro(s)</span>
                </div>
                <Example text={`Donacion de $5 con ${config.pullsPerDollar} tiro/dolar = ${5 * config.pullsPerDollar} tiros`} />
            </Section>

            {/* DecaCoins */}
            <Section icon={<Coins className="w-5 h-5 text-amber-500" />} title="DecaCoins" desc="Viewers compran tiros con DecaCoins del canal" enabled={config.coinsEnabled} onToggle={v => setConfig({ ...config, coinsEnabled: v })}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-[#64748b]">Cada tiro cuesta</span>
                    <input type="number" min={1} value={config.coinsPerPull} onChange={e => setConfig({ ...config, coinsPerPull: Math.max(1, parseInt(e.target.value) || 500) })} className={inputClass} />
                    <span className="text-sm text-[#64748b]">coins</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-[#64748b]">Limite diario por viewer</span>
                    <input type="number" min={0} value={config.coinsDailyLimit} onChange={e => setConfig({ ...config, coinsDailyLimit: Math.max(0, parseInt(e.target.value) || 0) })} className={inputClass} />
                    <span className="text-sm text-[#64748b]">tiros (0 = sin limite)</span>
                </div>
                <Example text={`Si un viewer compra 5 tiros a ${config.coinsPerPull} coins/tiro = ${5 * config.coinsPerPull} coins`} />
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                    <Coins className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">Los viewers pueden comprar tiros con <strong>!gcbuy</strong> o desde su perfil</p>
                </div>
            </Section>

            {/* Save */}
            <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-bold transition flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : saved ? 'Guardado!' : 'Guardar Configuracion'}
            </button>
        </div>
    );
};

function Section({ icon, title, desc, enabled, onToggle, children }: { icon: React.ReactNode; title: string; desc: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {icon}
                    <div>
                        <h3 className="text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">{title}</h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{desc}</p>
                    </div>
                </div>
                <button onClick={() => onToggle(!enabled)} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${enabled ? 'bg-green-600 text-white shadow-lg shadow-green-600/25' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                    {enabled ? 'Activado' : 'Desactivado'}
                </button>
            </div>
            {enabled && <div className="pt-2 space-y-3">{children}</div>}
        </div>
    );
}

function TierInput({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
    return (
        <div className="p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151] text-center">
            <p className="text-xs font-bold mb-2" style={{ color }}>{label}</p>
            <input type="number" min={0} value={value} onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-2 py-1.5 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-center text-[#1e293b] dark:text-[#f8fafc]" />
            <p className="text-[10px] text-[#64748b] mt-1">tiros</p>
        </div>
    );
}

function Example({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl">
            <Zap className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300"><strong>Ejemplo:</strong> {text}</p>
        </div>
    );
}
