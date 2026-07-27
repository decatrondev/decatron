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

    if (loading) return <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando...</p>;
    if (!config) return <p className="text-center text-red-500 py-8">Error al cargar configuracion</p>;

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                <div className="p-3 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl">
                    <Monitor className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Overlay</h2>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Configura el overlay del gacha para OBS</p>
                </div>
            </div>

            {/* Help Banner */}
            <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] overflow-hidden">
                <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                    <HelpCircle className="w-5 h-5 text-[#94a3b8] flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">
                        Como agregar el overlay a OBS
                    </span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-[#94a3b8]" /> : <ChevronDown className="w-4 h-4 text-[#94a3b8]" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-[#64748b] dark:text-[#94a3b8]">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Copia la <strong className="text-[#1e293b] dark:text-[#f8fafc]">URL</strong> de abajo</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span>En OBS, agrega una fuente <strong className="text-[#1e293b] dark:text-[#f8fafc]">Navegador (Browser)</strong></span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span>Pega la URL y usa las dimensiones recomendadas abajo</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-[#64748b] dark:bg-[#94a3b8] text-white dark:text-[#1B1C1D] text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span>Agrega el CSS: <code className="px-1.5 py-0.5 bg-[#e2e8f0] dark:bg-[#374151] rounded text-xs">body {'{'} background: transparent; {'}'}</code></span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-[#e2e8f0] dark:bg-[#374151] text-xs">
                            <strong className="text-[#1e293b] dark:text-[#f8fafc]">Tip:</strong> Usa el boton "Test Overlay" para verificar que funciona antes de ir en vivo. Los sonidos se configuran en el tab <strong className="text-[#1e293b] dark:text-[#f8fafc]">Sonidos</strong>.
                        </div>
                    </div>
                )}
            </div>

            {/* OBS URL */}
            <div className="space-y-2">
                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">URL para OBS</label>
                <div className="flex gap-2">
                    <input type="text" readOnly value={overlayUrl} className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] select-all" />
                    <button onClick={handleCopy} className="px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all" title="Copiar">
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-[#64748b]" />}
                    </button>
                    <button onClick={handleTest} className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" /> Test Overlay
                    </button>
                </div>
            </div>

            {/* Size Info */}
            <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Tamano del Overlay</p>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                    El overlay se adapta automaticamente al tamano que configures en OBS. Recomendamos entre <strong className="text-[#1e293b] dark:text-[#f8fafc]">400x600</strong> y <strong className="text-[#1e293b] dark:text-[#f8fafc]">640x960</strong> px. La carta, particulas y texto escalan proporcionalmente.
                </p>
            </div>

            {/* Animation Speed */}
            <div className="space-y-3">
                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Velocidad de Animacion</label>
                <p className="text-xs text-[#94a3b8] dark:text-[#64748b] -mt-1">Cuanto dura la animacion completa desde el flash hasta el fadeout</p>
                <div className="flex gap-2">
                    {SPEED_PRESETS.map((s) => (
                        <button key={s.value} onClick={() => setConfig({ ...config, animationSpeed: s.value })} className={`flex-1 p-3 rounded-xl border-2 text-center font-bold text-sm transition-all ${config.animationSpeed === s.value ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:border-blue-300 dark:hover:border-blue-700'}`}>
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center gap-3">
                        <Bug className="w-5 h-5 text-orange-500" />
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Modo Debug</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Muestra informacion de depuracion en el overlay</p>
                        </div>
                    </div>
                    <button onClick={() => setConfig({ ...config, enableDebug: !config.enableDebug })} className={`px-4 py-2 rounded-lg font-bold transition-all ${config.enableDebug ? 'bg-orange-500 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {config.enableDebug ? 'Activado' : 'Desactivado'}
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-blue-500" />
                        <div>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Efectos de Sonido</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Reproduce sonidos al tirar del gacha</p>
                        </div>
                    </div>
                    <button onClick={() => setConfig({ ...config, enableSounds: !config.enableSounds })} className={`px-4 py-2 rounded-lg font-bold transition-all ${config.enableSounds ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {config.enableSounds ? 'Activado' : 'Desactivado'}
                    </button>
                </div>
            </div>

            {/* OBS Info */}
            <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl">
                <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Configuracion recomendada para OBS:</p>
                <ul className="text-sm text-[#64748b] dark:text-[#94a3b8] space-y-1">
                    <li>Tipo de fuente: <strong className="text-[#1e293b] dark:text-[#f8fafc]">Navegador (Browser)</strong></li>
                    <li>Tamano: <strong className="text-[#1e293b] dark:text-[#f8fafc]">400x600 a 640x960 px</strong> (el overlay se adapta)</li>
                    <li>FPS: <strong className="text-[#1e293b] dark:text-[#f8fafc]">60</strong></li>
                    <li>CSS personalizado: <code className="px-1.5 py-0.5 bg-[#e2e8f0] dark:bg-[#374151] rounded text-xs">body {'{'} background: transparent; {'}'}</code></li>
                </ul>
            </div>

            {/* Save */}
            <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Configuracion'}
            </button>
        </div>
    );
};
