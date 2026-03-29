// SourcesTab - Configure point sources for combined goals

import React from 'react';
import { Tv, Gift, Users, Rocket, Sparkles, Info } from 'lucide-react';
import type { CombinedSourcesConfig, SourceConfig } from '../../types';

interface SourcesTabProps {
    defaultSources: CombinedSourcesConfig;
    onUpdateDefaultSources: (updates: Partial<CombinedSourcesConfig>) => void;
}

interface SourceItemProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    source: SourceConfig;
    sourceKey: keyof CombinedSourcesConfig;
    unitLabel: string;
    onUpdate: (key: keyof CombinedSourcesConfig, updates: Partial<SourceConfig>) => void;
}

const SourceItem: React.FC<SourceItemProps> = ({
    icon,
    label,
    description,
    source,
    sourceKey,
    unitLabel,
    onUpdate
}) => {
    return (
        <div className={`bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 transition-all p-4 ${
            source.enabled
                ? 'border-[#667eea] shadow-lg'
                : 'border-[#e2e8f0] dark:border-[#374151]'
        }`}>
            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                    source.enabled
                        ? 'bg-[#667eea]/10 text-[#667eea]'
                        : 'bg-[#f8fafc] dark:bg-[#262626] text-[#94a3b8]'
                }`}>
                    {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            {label}
                        </h4>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={source.enabled}
                                onChange={(e) => onUpdate(sourceKey, { enabled: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#667eea]"></div>
                        </label>
                    </div>

                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-3">
                        {description}
                    </p>

                    {source.enabled && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#64748b]">{unitLabel} =</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={source.pointsPerUnit}
                                    onChange={(e) => onUpdate(sourceKey, { pointsPerUnit: parseInt(e.target.value) || 1 })}
                                    className="w-20 px-3 py-1.5 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-center focus:outline-none focus:ring-2 focus:ring-[#667eea]"
                                />
                                <span className="text-sm text-[#64748b]">puntos</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SourcesTab: React.FC<SourcesTabProps> = ({
    defaultSources,
    onUpdateDefaultSources
}) => {
    const handleUpdateSource = (key: keyof CombinedSourcesConfig, updates: Partial<SourceConfig>) => {
        onUpdateDefaultSources({
            [key]: { ...defaultSources[key], ...updates }
        });
    };

    const sources: Array<{
        key: keyof CombinedSourcesConfig;
        icon: React.ReactNode;
        label: string;
        description: string;
        unitLabel: string;
    }> = [
        {
            key: 'subs',
            icon: <Tv className="w-6 h-6" />,
            label: 'Suscripciones',
            description: 'Nuevas suscripciones y resubs al canal.',
            unitLabel: '1 sub'
        },
        {
            key: 'giftedSubs',
            icon: <Gift className="w-6 h-6" />,
            label: 'Subs Regalados',
            description: 'Suscripciones regaladas a otros viewers.',
            unitLabel: '1 gift sub'
        },
        {
            key: 'bits',
            icon: <Sparkles className="w-6 h-6" />,
            label: 'Bits',
            description: 'Bits cheereados en el chat. Se cuenta cada 100 bits.',
            unitLabel: '100 bits'
        },
        {
            key: 'follows',
            icon: <Users className="w-6 h-6" />,
            label: 'Seguidores',
            description: 'Nuevos seguidores del canal.',
            unitLabel: '1 follow'
        },
        {
            key: 'raids',
            icon: <Rocket className="w-6 h-6" />,
            label: 'Raids',
            description: 'Raids de otros streamers.',
            unitLabel: '1 raid'
        }
    ];

    // Calculate example
    const exampleScenario = {
        subs: 5,
        giftedSubs: 2,
        bits: 500,
        follows: 10,
        raids: 1
    };

    const calculatePoints = () => {
        let total = 0;
        if (defaultSources.subs.enabled) {
            total += exampleScenario.subs * defaultSources.subs.pointsPerUnit;
        }
        if (defaultSources.giftedSubs.enabled) {
            total += exampleScenario.giftedSubs * defaultSources.giftedSubs.pointsPerUnit;
        }
        if (defaultSources.bits.enabled) {
            total += Math.floor(exampleScenario.bits / 100) * defaultSources.bits.pointsPerUnit;
        }
        if (defaultSources.follows.enabled) {
            total += exampleScenario.follows * defaultSources.follows.pointsPerUnit;
        }
        if (defaultSources.raids.enabled) {
            total += exampleScenario.raids * defaultSources.raids.pointsPerUnit;
        }
        return total;
    };

    return (
        <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-[#667eea] flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Configura cuántos puntos aporta cada tipo de evento para las <strong>metas combinadas</strong>.
                            Estos valores se usarán como predeterminados para nuevas metas, pero puedes personalizarlos
                            individualmente en cada meta.
                        </p>
                    </div>
                </div>
            </div>

            {/* Sources Grid */}
            <div className="space-y-4">
                {sources.map((source) => (
                    <SourceItem
                        key={source.key}
                        icon={source.icon}
                        label={source.label}
                        description={source.description}
                        source={defaultSources[source.key]}
                        sourceKey={source.key}
                        unitLabel={source.unitLabel}
                        onUpdate={handleUpdateSource}
                    />
                ))}
            </div>

            {/* Example Calculator */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    🧮 Calculadora de Ejemplo
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Si recibieras en un stream:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                    <div className="text-center p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl">
                        <div className="text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {exampleScenario.subs}
                        </div>
                        <div className="text-xs text-[#64748b]">subs</div>
                    </div>
                    <div className="text-center p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl">
                        <div className="text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {exampleScenario.giftedSubs}
                        </div>
                        <div className="text-xs text-[#64748b]">gift subs</div>
                    </div>
                    <div className="text-center p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl">
                        <div className="text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {exampleScenario.bits}
                        </div>
                        <div className="text-xs text-[#64748b]">bits</div>
                    </div>
                    <div className="text-center p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl">
                        <div className="text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {exampleScenario.follows}
                        </div>
                        <div className="text-xs text-[#64748b]">follows</div>
                    </div>
                    <div className="text-center p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-xl">
                        <div className="text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            {exampleScenario.raids}
                        </div>
                        <div className="text-xs text-[#64748b]">raid</div>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-4 p-4 bg-gradient-to-r from-[#667eea]/10 to-[#764ba2]/10 rounded-xl">
                    <span className="text-[#64748b]">Total de puntos:</span>
                    <span className="text-3xl font-bold text-[#667eea]">{calculatePoints()}</span>
                </div>

                {/* Breakdown */}
                <div className="mt-4 text-sm text-[#64748b] dark:text-[#94a3b8]">
                    <p className="font-medium mb-2">Desglose:</p>
                    <ul className="space-y-1">
                        {defaultSources.subs.enabled && (
                            <li>• {exampleScenario.subs} subs × {defaultSources.subs.pointsPerUnit} = {exampleScenario.subs * defaultSources.subs.pointsPerUnit} puntos</li>
                        )}
                        {defaultSources.giftedSubs.enabled && (
                            <li>• {exampleScenario.giftedSubs} gift subs × {defaultSources.giftedSubs.pointsPerUnit} = {exampleScenario.giftedSubs * defaultSources.giftedSubs.pointsPerUnit} puntos</li>
                        )}
                        {defaultSources.bits.enabled && (
                            <li>• {exampleScenario.bits} bits ÷ 100 × {defaultSources.bits.pointsPerUnit} = {Math.floor(exampleScenario.bits / 100) * defaultSources.bits.pointsPerUnit} puntos</li>
                        )}
                        {defaultSources.follows.enabled && (
                            <li>• {exampleScenario.follows} follows × {defaultSources.follows.pointsPerUnit} = {exampleScenario.follows * defaultSources.follows.pointsPerUnit} puntos</li>
                        )}
                        {defaultSources.raids.enabled && (
                            <li>• {exampleScenario.raids} raid × {defaultSources.raids.pointsPerUnit} = {exampleScenario.raids * defaultSources.raids.pointsPerUnit} puntos</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">💡 Tips</h4>
                <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-300">
                    <li>• Los subs tier 2 y tier 3 se pueden configurar con multiplicadores en cada meta individual</li>
                    <li>• Desactiva las fuentes que no quieras que cuenten para metas combinadas</li>
                    <li>• Para metas de un solo tipo (ej: solo subs), estas configuraciones no aplican</li>
                </ul>
            </div>
        </div>
    );
};

export default SourcesTab;
