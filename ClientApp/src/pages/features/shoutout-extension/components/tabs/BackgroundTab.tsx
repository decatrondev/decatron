import type { StyleConfig } from '../../types';

interface BackgroundTabProps {
    styles: StyleConfig;
    setStyles: (styles: StyleConfig) => void;
}

export function BackgroundTab({ styles, setStyles }: BackgroundTabProps) {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    Configuración de Fondo
                </h3>

                <div className="space-y-4">
                    {/* Background Type */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            Tipo de Fondo
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['gradient', 'solid', 'transparent'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setStyles({ ...styles, backgroundType: type })}
                                    className={`p-4 rounded-lg border-2 transition-all ${
                                        styles.backgroundType === type
                                            ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'
                                    }`}
                                >
                                    <div className="text-2xl mb-2">
                                        {type === 'gradient' && '🌈'}
                                        {type === 'solid' && '🎨'}
                                        {type === 'transparent' && '⬜'}
                                    </div>
                                    <div className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                        {type === 'gradient' && 'Degradado'}
                                        {type === 'solid' && 'Sólido'}
                                        {type === 'transparent' && 'Transparente'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Gradient Colors */}
                    {styles.backgroundType === 'gradient' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                                        Color 1
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={styles.gradientColor1}
                                            onChange={(e) => setStyles({ ...styles, gradientColor1: e.target.value })}
                                            className="w-16 h-12 rounded-lg cursor-pointer border-2 border-[#e2e8f0] dark:border-[#374151]"
                                        />
                                        <input
                                            type="text"
                                            value={styles.gradientColor1}
                                            onChange={(e) => setStyles({ ...styles, gradientColor1: e.target.value })}
                                            className="flex-1 px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] font-mono text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                                        Color 2
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={styles.gradientColor2}
                                            onChange={(e) => setStyles({ ...styles, gradientColor2: e.target.value })}
                                            className="w-16 h-12 rounded-lg cursor-pointer border-2 border-[#e2e8f0] dark:border-[#374151]"
                                        />
                                        <input
                                            type="text"
                                            value={styles.gradientColor2}
                                            onChange={(e) => setStyles({ ...styles, gradientColor2: e.target.value })}
                                            className="flex-1 px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                        Ángulo del Degradado
                                    </label>
                                    <span className="text-lg font-black text-[#2563eb]">{styles.gradientAngle}°</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="360"
                                    value={styles.gradientAngle}
                                    onChange={(e) => setStyles({ ...styles, gradientAngle: parseInt(e.target.value) })}
                                    className="w-full h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                                />
                                <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    <span>0°</span>
                                    <span>360°</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Solid Color */}
                    {styles.backgroundType === 'solid' && (
                        <div>
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                                Color de Fondo
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="color"
                                    value={styles.solidColor}
                                    onChange={(e) => setStyles({ ...styles, solidColor: e.target.value })}
                                    className="w-20 h-12 rounded-lg cursor-pointer border-2 border-[#e2e8f0] dark:border-[#374151]"
                                />
                                <input
                                    type="text"
                                    value={styles.solidColor}
                                    onChange={(e) => setStyles({ ...styles, solidColor: e.target.value })}
                                    className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] font-mono"
                                />
                            </div>
                        </div>
                    )}

                    {/* Background Opacity */}
                    {styles.backgroundType !== 'transparent' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    Opacidad
                                </label>
                                <span className="text-lg font-black text-[#2563eb]">{styles.backgroundOpacity}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={styles.backgroundOpacity}
                                onChange={(e) => setStyles({ ...styles, backgroundOpacity: parseInt(e.target.value) })}
                                className="w-full h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                            />
                            <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                <span>0%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
