import type { Styles } from '../../types';

interface BackgroundTabProps {
    styles: Styles;
    setStyles: (s: Styles) => void;
}

export function BackgroundTab({
    styles,
    setStyles,
}: BackgroundTabProps) {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    Tipo de Fondo
                </h3>

                <div className="grid grid-cols-3 gap-3 mb-6">
                    {(['transparent', 'solid', 'gradient'] as const).map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setStyles({ ...styles, backgroundType: type })}
                            className={`px-4 py-3 rounded-lg font-bold transition-all ${
                                styles.backgroundType === type
                                    ? 'bg-[#2563eb] text-white shadow-md'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                            }`}
                        >
                            {type === 'transparent' ? 'Transparente' : type === 'solid' ? 'Sólido' : 'Degradado'}
                        </button>
                    ))}
                </div>

                {/* Solid Color */}
                {styles.backgroundType === 'solid' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                                Color Sólido
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
                                    className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Gradient */}
                {styles.backgroundType === 'gradient' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                                Color 1
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="color"
                                    value={styles.gradientColor1}
                                    onChange={(e) => setStyles({ ...styles, gradientColor1: e.target.value })}
                                    className="w-20 h-12 rounded-lg cursor-pointer border-2 border-[#e2e8f0] dark:border-[#374151]"
                                />
                                <input
                                    type="text"
                                    value={styles.gradientColor1}
                                    onChange={(e) => setStyles({ ...styles, gradientColor1: e.target.value })}
                                    className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                                Color 2
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="color"
                                    value={styles.gradientColor2}
                                    onChange={(e) => setStyles({ ...styles, gradientColor2: e.target.value })}
                                    className="w-20 h-12 rounded-lg cursor-pointer border-2 border-[#e2e8f0] dark:border-[#374151]"
                                />
                                <input
                                    type="text"
                                    value={styles.gradientColor2}
                                    onChange={(e) => setStyles({ ...styles, gradientColor2: e.target.value })}
                                    className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block flex items-center justify-between">
                                <span>Ángulo</span>
                                <span className="text-[#2563eb]">{styles.gradientAngle}°</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="360"
                                value={styles.gradientAngle}
                                onChange={(e) => setStyles({ ...styles, gradientAngle: parseInt(e.target.value) })}
                                className="w-full accent-[#2563eb]"
                            />
                        </div>
                    </div>
                )}

                {/* Opacity */}
                {styles.backgroundType !== 'transparent' && (
                    <div className="mt-6">
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block flex items-center justify-between">
                            <span>Opacidad del Fondo</span>
                            <span className="text-[#2563eb]">{styles.backgroundOpacity}%</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={styles.backgroundOpacity}
                            onChange={(e) => setStyles({ ...styles, backgroundOpacity: parseInt(e.target.value) })}
                            className="w-full accent-[#2563eb]"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
