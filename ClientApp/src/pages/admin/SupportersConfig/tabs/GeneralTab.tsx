import React, { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { PageConfig } from '../types';
import { CARD, INPUT, LABEL } from '../constants';
import { Toggle } from '../shared';

export function GeneralTab({ config, onChange }: { config: PageConfig; onChange: (c: Partial<PageConfig>) => void }) {
    const publicUrl = `${window.location.origin}/supporters`;
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Estado */}
            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-5">Estado de la página</h3>
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className={LABEL}>Página pública activa</p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                            Si está desactivada, nadie puede ver la página de apoyos
                        </p>
                    </div>
                    <Toggle value={config.enabled} onChange={() => onChange({ enabled: !config.enabled })} />
                </div>
                <div>
                    <p className={`${LABEL} mb-1.5`}>URL pública</p>
                    <div className="flex gap-2">
                        <input type="text" value={publicUrl} readOnly className={`${INPUT} font-mono text-xs`} />
                        <button
                            onClick={handleCopy}
                            className="px-3 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white rounded-xl text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copiado' : 'Copiar'}
                        </button>
                        <a
                            href="/supporters"
                            target="_blank"
                            rel="noopener"
                            className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] rounded-xl text-sm font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-[#f8fafc] dark:hover:bg-[#374151] transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Ver
                        </a>
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-5">Contenido de la página</h3>
                <div className="space-y-4">
                    <div>
                        <label className={`${LABEL} block mb-1.5`}>Título principal</label>
                        <input
                            type="text"
                            value={config.title}
                            onChange={e => onChange({ title: e.target.value })}
                            className={INPUT}
                            placeholder="Apoya a Decatron"
                        />
                    </div>
                    <div>
                        <label className={`${LABEL} block mb-1.5`}>Tagline</label>
                        <input
                            type="text"
                            value={config.tagline}
                            onChange={e => onChange({ tagline: e.target.value })}
                            className={INPUT}
                            placeholder="Ayuda a mantener el bot gratuito para todos"
                        />
                    </div>
                    <div>
                        <label className={`${LABEL} block mb-1.5`}>Descripción</label>
                        <textarea
                            value={config.description}
                            onChange={e => onChange({ description: e.target.value })}
                            rows={4}
                            className={`${INPUT} resize-none`}
                            placeholder="Descripción de por qué apoyar..."
                        />
                    </div>
                </div>
            </div>

            {/* Objetivo mensual */}
            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-5">Objetivo mensual</h3>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className={LABEL}>Mostrar barra de progreso</p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                            Muestra cuánto del objetivo mensual se ha alcanzado
                        </p>
                    </div>
                    <Toggle value={config.showProgressBar} onChange={() => onChange({ showProgressBar: !config.showProgressBar })} />
                </div>
                {config.showProgressBar && (
                    <div>
                        <label className={`${LABEL} block mb-1.5`}>Objetivo mensual (USD)</label>
                        <div className="flex items-center gap-2">
                            <span className="text-[#64748b] dark:text-[#94a3b8] font-bold text-lg">$</span>
                            <input
                                type="number"
                                min={0}
                                value={config.monthlyGoal}
                                onChange={e => onChange({ monthlyGoal: Number(e.target.value) })}
                                className={`${INPUT} w-32`}
                            />
                            <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">/ mes</span>
                        </div>
                        {config.monthlyGoal > 0 && (
                            <div className="mt-4">
                                <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mb-1.5">
                                    <span>Recaudado: ${config.monthlyRaised}</span>
                                    <span>Objetivo: ${config.monthlyGoal}</span>
                                </div>
                                <div className="h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#2563eb] to-[#7c3aed] rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (config.monthlyRaised / config.monthlyGoal) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Secciones visibles */}
            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-5">Secciones visibles</h3>
                <div className="space-y-4">
                    {[
                        { key: 'showSupportersWall', label: 'Muro de supporters', desc: 'Muestra la grilla de todos los supporters activos' },
                        { key: 'showFoundersSection', label: 'Sección de Fundadores', desc: 'Sección destacada con los Fundadores permanentes' },
                    ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between">
                            <div>
                                <p className={LABEL}>{label}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">{desc}</p>
                            </div>
                            <Toggle
                                value={config[key as keyof PageConfig] as boolean}
                                onChange={() => onChange({ [key]: !config[key as keyof PageConfig] })}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
