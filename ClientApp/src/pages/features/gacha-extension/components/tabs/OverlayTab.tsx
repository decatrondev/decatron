import React, { useState, useEffect } from 'react';
import { Monitor, Copy, ExternalLink, Save, Check, Bug, Volume2 } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaOverlayConfig } from '../../types';

const SIZE_PRESETS: { label: string; value: string; width: number; height: number }[] = [
    { label: 'Compacto', value: 'compact', width: 400, height: 600 },
    { label: 'Estandar', value: 'standard', width: 480, height: 720 },
    { label: 'Grande', value: 'large', width: 640, height: 960 },
    { label: 'Personalizado', value: 'custom', width: 0, height: 0 },
];

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

    const getActivePreset = () => SIZE_PRESETS.find((p) => p.value === config?.overlaySize) || SIZE_PRESETS[1];
    const getRecommendedSize = () => {
        const preset = getActivePreset();
        if (preset.value === 'custom') return { width: config?.customWidth || 480, height: config?.customHeight || 720 };
        return { width: preset.width, height: preset.height };
    };

    if (loading) return <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando...</p>;
    if (!config) return <p className="text-center text-red-500 py-8">Error al cargar configuracion</p>;

    const recommended = getRecommendedSize();

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

            {/* Size Presets */}
            <div className="space-y-3">
                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Tamano del Overlay</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SIZE_PRESETS.map((p) => (
                        <button key={p.value} onClick={() => setConfig({ ...config, overlaySize: p.value })} className={`p-3 rounded-xl border-2 text-center font-bold text-sm transition-all ${config.overlaySize === p.value ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:border-blue-300 dark:hover:border-blue-700'}`}>
                            <span>{p.label}</span>
                            {p.value !== 'custom' && <p className="text-xs text-[#64748b] dark:text-[#94a3b8] font-normal mt-1">{p.width}x{p.height}</p>}
                        </button>
                    ))}
                </div>
                {config.overlaySize === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Ancho (px)</label>
                            <input type="number" min={200} max={1920} value={config.customWidth || 480} onChange={(e) => setConfig({ ...config, customWidth: parseInt(e.target.value) || 480 })} className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">Alto (px)</label>
                            <input type="number" min={200} max={1920} value={config.customHeight || 720} onChange={(e) => setConfig({ ...config, customHeight: parseInt(e.target.value) || 720 })} className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-[#1e293b] dark:text-[#f8fafc]" />
                        </div>
                    </div>
                )}
            </div>

            {/* Animation Speed */}
            <div className="space-y-3">
                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Velocidad de Animacion</label>
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
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">Configuracion recomendada para OBS:</p>
                <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                    <li>Tipo de fuente: <strong>Navegador (Browser)</strong></li>
                    <li>Ancho: <strong>{recommended.width}px</strong></li>
                    <li>Alto: <strong>{recommended.height}px</strong></li>
                    <li>FPS: <strong>60</strong></li>
                    <li>CSS personalizado: <strong>body {'{'} background: transparent; {'}'}</strong></li>
                </ul>
            </div>

            {/* Save */}
            <button onClick={handleSave} disabled={saving} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Configuracion'}
            </button>
        </div>
    );
};
