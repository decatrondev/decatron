import React, { useState, useEffect } from 'react';
import { Link2, DollarSign, Coins, Save, Info, Zap } from 'lucide-react';
import api from '../../../../../services/api';

interface IntegrationConfig {
    tipsEnabled: boolean;
    pullsPerDollar: number;
    coinsEnabled: boolean;
    coinsPerPull: number;
}

const defaultConfig: IntegrationConfig = {
    tipsEnabled: false, pullsPerDollar: 1,
    coinsEnabled: false, coinsPerPull: 100,
};

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
            } catch (err) {
                console.error('Error loading integration config', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.post('/gacha/integration-config', config);
            setConfig(res.data.config || config);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Error saving integration config', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando...</p>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center gap-3 pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <div className="p-3 bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-xl">
                        <Link2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Integraciones</h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Conecta el gacha con otros sistemas de Decatron</p>
                    </div>
                </div>
            </div>

            {/* Tips Integration */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Tips / Donaciones</h3>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Convierte donaciones de PayPal en tiros automaticamente</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setConfig({ ...config, tipsEnabled: !config.tipsEnabled })}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                            config.tipsEnabled
                                ? 'bg-green-600 text-white shadow-lg shadow-green-600/25'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {config.tipsEnabled ? 'Activado' : 'Desactivado'}
                    </button>
                </div>

                {config.tipsEnabled && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">Tiros por dolar</label>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-2">Cuantos tiros recibe el viewer por cada $1 donado</p>
                                <div className="flex items-center gap-3">
                                    {[1, 2, 3, 5, 10].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setConfig({ ...config, pullsPerDollar: n })}
                                            className={`w-12 h-12 rounded-xl font-bold text-sm transition-all ${
                                                config.pullsPerDollar === n
                                                    ? 'bg-green-600 text-white shadow-lg'
                                                    : 'bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:border-green-400'
                                            }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={config.pullsPerDollar}
                                        onChange={e => setConfig({ ...config, pullsPerDollar: Math.max(1, parseInt(e.target.value) || 1) })}
                                        className="w-20 px-3 py-2.5 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-center text-[#1e293b] dark:text-[#f8fafc]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Example */}
                        <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl">
                            <Zap className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-green-700 dark:text-green-300">
                                <p className="font-bold mb-1">Ejemplo:</p>
                                <p>Si alguien dona <strong>$5</strong> con <strong>{config.pullsPerDollar} tiro(s) por dolar</strong> → recibe <strong>{5 * config.pullsPerDollar} tiros</strong> automaticamente</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl">
                            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                                <p>Requiere que tengas <strong>Tips configurados</strong> en <a href="/features/tips" className="underline font-bold">Funciones → Tips</a>. Las donaciones via PayPal se convertiran automaticamente en tiros de gacha.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* DecaCoins Integration (future) */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-5 opacity-60">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                            <Coins className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">DecaCoins</h3>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Permite comprar tiros con DecaCoins (proximamente)</p>
                        </div>
                    </div>
                    <span className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold">Proximamente</span>
                </div>
            </div>

            {/* Save */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : saved ? 'Guardado!' : 'Guardar Configuracion'}
            </button>
        </div>
    );
};
