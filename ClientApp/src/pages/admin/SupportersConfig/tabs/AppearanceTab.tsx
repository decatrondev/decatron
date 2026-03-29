import React from 'react';
import type { PageConfig } from '../types';
import { CARD, INPUT, LABEL } from '../constants';

export function AppearanceTab({ config, onChange }: { config: PageConfig; onChange: (c: Partial<PageConfig>) => void }) {
    return (
        <div className="space-y-6">
            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-5">Gradiente del Hero</h3>
                <div
                    className="w-full h-24 rounded-xl mb-5"
                    style={{ background: `linear-gradient(135deg, ${config.heroFrom}, ${config.heroTo})` }}
                />
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={`${LABEL} block mb-1.5`}>Color de inicio</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={config.heroFrom}
                                onChange={e => onChange({ heroFrom: e.target.value })}
                                className="w-10 h-9 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                            />
                            <input
                                type="text"
                                value={config.heroFrom}
                                onChange={e => onChange({ heroFrom: e.target.value })}
                                className={`${INPUT} font-mono`}
                                maxLength={7}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`${LABEL} block mb-1.5`}>Color de fin</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={config.heroTo}
                                onChange={e => onChange({ heroTo: e.target.value })}
                                className="w-10 h-9 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                            />
                            <input
                                type="text"
                                value={config.heroTo}
                                onChange={e => onChange({ heroTo: e.target.value })}
                                className={`${INPUT} font-mono`}
                                maxLength={7}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-2">Presets de gradiente</h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">Haz clic para aplicar</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {[
                        { from: '#2563eb', to: '#7c3aed', label: 'Blue-Purple' },
                        { from: '#0f172a', to: '#1e3a5f', label: 'Dark Blue' },
                        { from: '#7c3aed', to: '#db2777', label: 'Purple-Pink' },
                        { from: '#059669', to: '#2563eb', label: 'Teal-Blue' },
                        { from: '#d97706', to: '#dc2626', label: 'Amber-Red' },
                    ].map(preset => (
                        <button
                            key={preset.label}
                            onClick={() => onChange({ heroFrom: preset.from, heroTo: preset.to })}
                            className="group relative rounded-xl overflow-hidden aspect-video hover:scale-105 transition-transform"
                            style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                            title={preset.label}
                        >
                            <div className="absolute inset-0 flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-[10px] font-bold bg-black/40 px-1.5 py-0.5 rounded">{preset.label}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
