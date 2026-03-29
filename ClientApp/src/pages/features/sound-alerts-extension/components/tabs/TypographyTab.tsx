import type { Styles } from '../../types';

interface TypographyTabProps {
    styles: Styles;
    setStyles: (s: Styles) => void;
    textOutlineEnabled: boolean;
    setTextOutlineEnabled: (v: boolean) => void;
    textOutlineColor: string;
    setTextOutlineColor: (v: string) => void;
    textOutlineWidth: number;
    setTextOutlineWidth: (v: number) => void;
}

export function TypographyTab({
    styles,
    setStyles,
    textOutlineEnabled,
    setTextOutlineEnabled,
    textOutlineColor,
    setTextOutlineColor,
    textOutlineWidth,
    setTextOutlineWidth,
}: TypographyTabProps) {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    Configuración de Fuente
                </h3>

                <div className="space-y-4">
                    {/* Font Family */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            Familia de Fuente
                        </label>
                        <select
                            value={styles.fontFamily}
                            onChange={(e) => setStyles({ ...styles, fontFamily: e.target.value })}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="Inter">Inter</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Montserrat">Montserrat</option>
                            <option value="Poppins">Poppins</option>
                            <option value="Arial">Arial</option>
                        </select>
                    </div>

                    {/* Text Color */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            Color de Texto
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="color"
                                value={styles.textColor}
                                onChange={(e) => setStyles({ ...styles, textColor: e.target.value })}
                                className="w-20 h-12 rounded-lg cursor-pointer border-2 border-[#e2e8f0] dark:border-[#374151]"
                            />
                            <input
                                type="text"
                                value={styles.textColor}
                                onChange={(e) => setStyles({ ...styles, textColor: e.target.value })}
                                className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                            />
                        </div>
                    </div>

                    {/* Text Shadow */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            Sombra de Texto
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                            {(['none', 'normal', 'strong', 'glow'] as const).map((shadow) => (
                                <button
                                    key={shadow}
                                    type="button"
                                    onClick={() => setStyles({ ...styles, textShadow: shadow })}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                        styles.textShadow === shadow
                                            ? 'bg-[#2563eb] text-white'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                    }`}
                                >
                                    {shadow === 'none' ? 'Sin' : shadow === 'normal' ? 'Normal' : shadow === 'strong' ? 'Fuerte' : 'Brillo'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Text Outline */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                    Contorno de Texto
                                </label>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    Agrega un borde alrededor del texto para mejorar legibilidad
                                </p>
                            </div>
                            <button
                                onClick={() => setTextOutlineEnabled(!textOutlineEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    textOutlineEnabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        textOutlineEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {textOutlineEnabled && (
                            <>
                                <div>
                                    <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold">
                                        Color del Contorno
                                    </label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={textOutlineColor}
                                            onChange={(e) => setTextOutlineColor(e.target.value)}
                                            className="w-16 h-10 rounded cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                        />
                                        <input
                                            type="text"
                                            value={textOutlineColor}
                                            onChange={(e) => setTextOutlineColor(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]"
                                            placeholder="#000000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold flex items-center justify-between">
                                        <span>Grosor del Contorno</span>
                                        <span className="text-[#2563eb] font-bold">{textOutlineWidth}px</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={textOutlineWidth}
                                        onChange={(e) => setTextOutlineWidth(parseInt(e.target.value))}
                                        className="w-full accent-[#2563eb]"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
