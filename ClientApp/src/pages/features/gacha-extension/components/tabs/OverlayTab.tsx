import React, { useState, useEffect } from 'react';
import { Monitor, Copy, ExternalLink, Save, Check, Bug, Volume2, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaOverlayConfig } from '../../types';

const SIZE_PRESETS: { label: string; value: string; width: number; height: number }[] = [
    { label: 'Compacto', value: 'compact', width: 400, height: 600 },
    { label: 'Estandar', value: 'standard', width: 480, height: 720 },
    { label: 'Grande', value: 'large', width: 640, height: 960 },
    { label: 'Personalizado', value: 'custom', width: 0, height: 0 },
]; // Kept for backwards compatibility with saved configs

const SPEED_PRESETS: { label: string; value: number }[] = [
    { label: 'Rapido (8s)', value: 8 },
    { label: 'Normal (10s)', value: 10 },
    { label: 'Lento (12s)', value: 12 },
];

export const OverlayTab: React.FC = () => {
    const [config, setConfig] = useState<GachaOverlayConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [channelName, setChannelName] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    const defaultConfig: GachaOverlayConfig = {
        id: 0, channelName: '', overlaySize: 'standard',
        customWidth: 480, customHeight: 720, animationSpeed: 10,
        enableDebug: false, enableSounds: false,
    };

    const loadConfig = async () => {
        setLoading(true);
        try {
            const res = await api.get('/gacha/overlay-config');
            setConfig(res.data.config || defaultConfig);
            setChannelName(res.data.channelName || res.data.config?.channelName || '');
        } catch (err) {
            console.error('Error loading overlay config', err);
            setConfig(defaultConfig);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadConfig(); }, []);

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        try {
            await api.post('/gacha/overlay-config', {
                overlaySize: config.overlaySize,
                customWidth: config.customWidth,
                customHeight: config.customHeight,
                animationSpeed: config.animationSpeed,
                enableDebug: config.enableDebug,
                enableSounds: config.enableSounds,
            });
        } catch (err) {
            console.error('Error saving overlay config', err);
        } finally {
            setSaving(false);
        }
    };

    const overlayUrl = `${window.location.origin}/overlay/gacha?channel=${channelName}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(overlayUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* fallback */ }
    };

    const handleTest = () => {
        window.open(overlayUrl, '_blank');
    };

    if (loading) return <p className="text-center text-ds-soft py-8">Cargando...</p>;
    if (!config) return <p className="text-center text-ds-danger py-8">Error al cargar configuracion</p>;

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
                <div className="p-3 bg-ds-accent rounded-lg">
                    <Monitor className="w-6 h-6 text-ds-on-accent" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-ds-text">Overlay</h2>
                    <p className="text-sm text-ds-soft">Configura el overlay del gacha para OBS</p>
                </div>
            </div>

            {/* Help Banner */}
            <div className="rounded-lg border border-ds-border bg-ds-bg overflow-hidden">
                <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                    <HelpCircle className="w-5 h-5 text-ds-soft flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-ds-soft">
                        Como agregar el overlay a OBS
                    </span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-ds-soft">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Copia la <strong className="text-ds-text">URL</strong> de abajo</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span>En OBS, agrega una fuente <strong className="text-ds-text">Navegador (Browser)</strong></span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span>Pega la URL y usa las dimensiones recomendadas abajo</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span>Agrega el CSS: <code className="px-1.5 py-0.5 bg-ds-raised rounded text-xs">body {'{'} background: transparent; {'}'}</code></span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-ds-raised text-xs">
                            <strong className="text-ds-text">Tip:</strong> Usa el boton "Test Overlay" para verificar que funciona antes de ir en vivo. Los sonidos se configuran en el tab <strong className="text-ds-text">Sonidos</strong>.
                        </div>
                    </div>
                )}
            </div>

            {/* OBS URL */}
            <div className="space-y-2">
                <label className="block text-sm font-bold text-ds-soft">URL para OBS</label>
                <div className="flex gap-2">
                    <input type="text" readOnly value={overlayUrl} className="flex-1 px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text select-all" />
                    <button onClick={handleCopy} className="px-4 py-3 bg-ds-bg border border-ds-border rounded-lg hover:border-ds-accent transition-all" title="Copiar">
                        {copied ? <Check className="w-4 h-4 text-ds-ok" /> : <Copy className="w-4 h-4 text-ds-soft" />}
                    </button>
                    <button onClick={handleTest} className="px-4 py-3 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg font-bold transition-all flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" /> Test Overlay
                    </button>
                </div>
            </div>

            {/* Size Info */}
            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                <p className="text-sm font-bold text-ds-text mb-2">Tamano del Overlay</p>
                <p className="text-xs text-ds-soft">
                    El overlay se adapta automaticamente al tamano que configures en OBS. Recomendamos entre <strong className="text-ds-text">400x600</strong> y <strong className="text-ds-text">640x960</strong> px. La carta, particulas y texto escalan proporcionalmente.
                </p>
            </div>

            {/* Animation Speed */}
            <div className="space-y-3">
                <label className="block text-sm font-bold text-ds-soft">Velocidad de Animacion</label>
                <p className="text-xs text-ds-soft -mt-1">Cuanto dura la animacion completa desde el flash hasta el fadeout</p>
                <div className="flex gap-2">
                    {SPEED_PRESETS.map((s) => (
                        <button key={s.value} onClick={() => setConfig({ ...config, animationSpeed: s.value })} className={`flex-1 p-3 rounded-lg border-2 text-center font-bold text-sm transition-all ${config.animationSpeed === s.value ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text' : 'border-ds-border text-ds-text hover:border-ds-accent '}`}>
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center gap-3">
                        <Bug className="w-5 h-5 text-ds-accent-text" />
                        <div>
                            <p className="font-bold text-ds-text">Modo Debug</p>
                            <p className="text-xs text-ds-soft">Muestra informacion de depuracion en el overlay</p>
                        </div>
                    </div>
                    <button onClick={() => setConfig({ ...config, enableDebug: !config.enableDebug })} className={`px-4 py-2 rounded-lg font-bold transition-all ${config.enableDebug ? 'bg-ds-warn text-ds-on-accent' : 'bg-ds-raised text-ds-soft '}`}>
                        {config.enableDebug ? 'Activado' : 'Desactivado'}
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div className="flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-ds-accent-text" />
                        <div>
                            <p className="font-bold text-ds-text">Efectos de Sonido</p>
                            <p className="text-xs text-ds-soft">Reproduce sonidos al tirar del gacha</p>
                        </div>
                    </div>
                    <button onClick={() => setConfig({ ...config, enableSounds: !config.enableSounds })} className={`px-4 py-2 rounded-lg font-bold transition-all ${config.enableSounds ? 'bg-ds-accent text-ds-on-accent' : 'bg-ds-raised text-ds-soft '}`}>
                        {config.enableSounds ? 'Activado' : 'Desactivado'}
                    </button>
                </div>
            </div>

            {/* OBS Info */}
            <div className="p-4 bg-ds-bg border border-ds-border rounded-lg">
                <p className="text-sm font-bold text-ds-text mb-2">Configuracion recomendada para OBS:</p>
                <ul className="text-sm text-ds-soft space-y-1">
                    <li>Tipo de fuente: <strong className="text-ds-text">Navegador (Browser)</strong></li>
                    <li>Tamano: <strong className="text-ds-text">400x600 a 640x960 px</strong> (el overlay se adapta)</li>
                    <li>FPS: <strong className="text-ds-text">60</strong></li>
                    <li>CSS personalizado: <code className="px-1.5 py-0.5 bg-ds-raised rounded text-xs">body {'{'} background: transparent; {'}'}</code></li>
                </ul>
            </div>

            {/* Save */}
            <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-ds-accent hover:bg-ds-accent-hover disabled:bg-ds-faint text-ds-on-accent rounded-lg font-bold transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Configuracion'}
            </button>
        </div>
    );
};
