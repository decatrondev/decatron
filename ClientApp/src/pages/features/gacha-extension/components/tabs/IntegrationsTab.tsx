import React, { useState, useEffect } from 'react';
import { Link2, DollarSign, Coins, Save, Zap, Star, Gift, Diamond, HelpCircle, ChevronDown, ChevronUp, MessageSquare, Sparkles } from 'lucide-react';
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
    chatNotifyEnabled: boolean;
    bonusExpireOnStreamEnd: boolean;
}

const defaultConfig: IntegrationConfig = {
    tipsEnabled: false, pullsPerDollar: 1,
    bitsEnabled: false, bitsPerPull: 100,
    subsEnabled: false, pullsSubPrime: 1, pullsSubTier1: 2, pullsSubTier2: 3, pullsSubTier3: 5,
    giftSubsEnabled: false, pullsPerGift: 1,
    coinsEnabled: false, coinsPerPull: 500, coinsDailyLimit: 0,
    chatNotifyEnabled: true, bonusExpireOnStreamEnd: false,
};

const inputClass = 'w-20 px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-sm text-center text-ds-text ';

export const IntegrationsTab: React.FC = () => {
    const [config, setConfig] = useState<IntegrationConfig>(defaultConfig);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

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
        <button onClick={() => onChange(!checked)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${checked ? 'bg-ds-accent text-ds-on-accent shadow-green-600/25' : 'bg-ds-raised text-ds-soft '}`}>
            {checked ? 'Activado' : 'Desactivado'}
        </button>
    );

    if (loading) return <p className="text-center text-ds-soft py-8">Cargando...</p>;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-ds-accent to-fuchsia-600 rounded-lg">
                        <Link2 className="w-6 h-6 text-ds-on-accent" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-ds-text">Integraciones</h2>
                        <p className="text-sm text-ds-soft">Conecta eventos de Twitch con el gacha para dar tiros automaticamente</p>
                    </div>
                </div>
            </div>

            {/* Help Banner */}
            <div className="rounded-lg border border-ds-border bg-ds-bg overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-ds-soft flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-ds-soft">Como funcionan las integraciones</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-ds-soft">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Cada integracion convierte <strong className="text-ds-text">eventos de Twitch</strong> en tiros del gacha automaticamente</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span><strong className="text-ds-text">Tips/PayPal</strong> — cada dolar donado = X tiros</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span><strong className="text-ds-text">Bits</strong> — cada X bits = 1 tiro</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span><strong className="text-ds-text">Subs</strong> — tiros automaticos por tier (Prime, T1, T2, T3)</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">5</span>
                            <span><strong className="text-ds-text">Gift Subs</strong> — tiros para quien regala las subs</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">6</span>
                            <span><strong className="text-ds-text">DecaCoins</strong> — los viewers compran tiros con la moneda del bot</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">7</span>
                            <span><strong className="text-ds-text">Tiros bonus</strong> — los que vienen de la Rueda de la Suerte o que regalas a mano. No cuentan como donacion</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-ds-raised text-xs">
                            <strong className="text-ds-text">Tip:</strong> Puedes activar o desactivar cada integracion individualmente. Los tiros se dan automaticamente cuando ocurre el evento.
                        </div>
                        <div className="p-3 rounded-lg bg-ds-warn/10 border border-ds-warn/40 text-xs text-ds-warn">
                            <strong>Renovaciones:</strong> Twitch solo avisa de una resub cuando el viewer la <strong>comparte en el chat</strong>. Las renovaciones automaticas que no se comparten no generan ningun evento, ni para este bot ni para ningun otro.
                        </div>
                    </div>
                )}
            </div>

            {/* Bits */}
            <Section icon={<Diamond className="w-5 h-5 text-ds-accent-text" />} title="Bits" desc="Viewers donan bits y reciben tiros automaticamente" enabled={config.bitsEnabled} onToggle={v => setConfig({ ...config, bitsEnabled: v })}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-ds-soft">Cada</span>
                    <input type="number" min={1} value={config.bitsPerPull} onChange={e => setConfig({ ...config, bitsPerPull: Math.max(1, parseInt(e.target.value) || 100) })} className={inputClass} />
                    <span className="text-sm text-ds-soft">bits = 1 tiro</span>
                </div>
                <Example text={`500 bits con ${config.bitsPerPull} bits/tiro = ${Math.floor(500 / config.bitsPerPull)} tiros`} />
            </Section>

            {/* Subscriptions */}
            <Section icon={<Star className="w-5 h-5 text-ds-accent-text" />} title="Suscripciones" desc="Viewers que se suscriben reciben tiros segun su tier" enabled={config.subsEnabled} onToggle={v => setConfig({ ...config, subsEnabled: v })}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <TierInput label="Prime" value={config.pullsSubPrime} onChange={v => setConfig({ ...config, pullsSubPrime: v })} color="#6366f1" />
                    <TierInput label="Tier 1" value={config.pullsSubTier1} onChange={v => setConfig({ ...config, pullsSubTier1: v })} color="#3b82f6" />
                    <TierInput label="Tier 2" value={config.pullsSubTier2} onChange={v => setConfig({ ...config, pullsSubTier2: v })} color="#a855f7" />
                    <TierInput label="Tier 3" value={config.pullsSubTier3} onChange={v => setConfig({ ...config, pullsSubTier3: v })} color="#f59e0b" />
                </div>
            </Section>

            {/* Gift Subs */}
            <Section icon={<Gift className="w-5 h-5 text-ds-accent-text" />} title="Gift Subs" desc="El que regala suscripciones recibe tiros" enabled={config.giftSubsEnabled} onToggle={v => setConfig({ ...config, giftSubsEnabled: v })}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-ds-soft">Cada gift sub =</span>
                    <input type="number" min={1} value={config.pullsPerGift} onChange={e => setConfig({ ...config, pullsPerGift: Math.max(1, parseInt(e.target.value) || 1) })} className={inputClass} />
                    <span className="text-sm text-ds-soft">tiro(s)</span>
                </div>
                <Example text={`Regalar 5 subs con ${config.pullsPerGift} tiro/gift = ${5 * config.pullsPerGift} tiros para el que regala`} />
            </Section>

            {/* Tips */}
            <Section icon={<DollarSign className="w-5 h-5 text-ds-accent-text" />} title="Tips / PayPal" desc="Donaciones via PayPal se convierten en tiros" enabled={config.tipsEnabled} onToggle={v => setConfig({ ...config, tipsEnabled: v })}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-ds-soft">Cada $1 =</span>
                    <input type="number" min={1} value={config.pullsPerDollar} onChange={e => setConfig({ ...config, pullsPerDollar: Math.max(1, parseInt(e.target.value) || 1) })} className={inputClass} />
                    <span className="text-sm text-ds-soft">tiro(s)</span>
                </div>
                <Example text={`Donacion de $5 con ${config.pullsPerDollar} tiro/dolar = ${5 * config.pullsPerDollar} tiros`} />
            </Section>

            {/* DecaCoins */}
            <Section icon={<Coins className="w-5 h-5 text-ds-accent-text" />} title="DecaCoins" desc="Viewers compran tiros con DecaCoins del canal" enabled={config.coinsEnabled} onToggle={v => setConfig({ ...config, coinsEnabled: v })}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-ds-soft">Cada tiro cuesta</span>
                    <input type="number" min={1} value={config.coinsPerPull} onChange={e => setConfig({ ...config, coinsPerPull: Math.max(1, parseInt(e.target.value) || 500) })} className={inputClass} />
                    <span className="text-sm text-ds-soft">coins</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-ds-soft">Limite diario por viewer</span>
                    <input type="number" min={0} value={config.coinsDailyLimit} onChange={e => setConfig({ ...config, coinsDailyLimit: Math.max(0, parseInt(e.target.value) || 0) })} className={inputClass} />
                    <span className="text-sm text-ds-soft">tiros (0 = sin limite)</span>
                </div>
                <Example text={`Si un viewer compra 5 tiros a ${config.coinsPerPull} coins/tiro = ${5 * config.coinsPerPull} coins`} />
                <div className="flex items-start gap-2 p-3 bg-ds-warn/10 border border-ds-warn/40 rounded-lg">
                    <Coins className="w-4 h-4 text-ds-accent-text flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-ds-warn">Los viewers pueden comprar tiros con <strong>!gcbuy</strong> o desde su perfil</p>
                </div>
            </Section>

            {/* Chat notify */}
            <Section icon={<MessageSquare className="w-5 h-5 text-ds-accent-text" />} title="Aviso en chat" desc="El bot avisa en el chat cuando un viewer gana tiros por sub, resub, bits o gift subs" enabled={config.chatNotifyEnabled} onToggle={v => setConfig({ ...config, chatNotifyEnabled: v })}>
                <Example text="🎰 @viewer ganaste 1 tiro(s) del gacha por tu resub! Tienes 3 disponibles, usa !gcpull" />
            </Section>

            {/* Bonus pulls */}
            <Section icon={<Sparkles className="w-5 h-5 text-ds-accent-text" />} title="Tiros bonus vencen al terminar el stream" desc="Los tiros bonus (rueda, regalos) se pierden cuando el stream termina. Los de donacion y coins nunca vencen" enabled={config.bonusExpireOnStreamEnd} onToggle={v => setConfig({ ...config, bonusExpireOnStreamEnd: v })}>
                <div className="flex items-start gap-2 p-3 bg-ds-warn/10 border border-ds-warn/40 rounded-lg">
                    <Sparkles className="w-4 h-4 text-ds-accent-text flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-ds-warn">Sirve para que los viewers usen sus bonus en vivo. El bot los gasta primero al tirar con <strong>!gcpull</strong>, antes que los de donacion o coins.</p>
                </div>
            </Section>

            {/* Save */}
            <button onClick={handleSave} disabled={saving} className="ds-btn ds-btn--primary ds-btn--lg w-full">
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : saved ? 'Guardado!' : 'Guardar Configuracion'}
            </button>
        </div>
    );
};

function Section({ icon, title, desc, enabled, onToggle, children }: { icon: React.ReactNode; title: string; desc: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {icon}
                    <div>
                        <h3 className="text-base font-bold text-ds-text">{title}</h3>
                        <p className="text-xs text-ds-soft">{desc}</p>
                    </div>
                </div>
                <button onClick={() => onToggle(!enabled)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${enabled ? 'bg-ds-accent text-ds-on-accent shadow-green-600/25' : 'bg-ds-raised text-ds-soft '}`}>
                    {enabled ? 'Activado' : 'Desactivado'}
                </button>
            </div>
            {enabled && <div className="pt-2 space-y-3">{children}</div>}
        </div>
    );
}

function TierInput({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
    return (
        <div className="p-3 bg-ds-bg rounded-lg border border-ds-border text-center">
            <p className="text-xs font-bold mb-2" style={{ color }}>{label}</p>
            <input type="number" min={0} value={value} onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))} className="ds-input w-full text-center" />
            <p className="text-[10px] text-ds-soft mt-1">tiros</p>
        </div>
    );
}

function Example({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-2 p-3 bg-ds-accent/10 border border-ds-accent rounded-lg">
            <Zap className="w-4 h-4 text-ds-accent-text flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ds-accent-text"><strong>Ejemplo:</strong> {text}</p>
        </div>
    );
}
