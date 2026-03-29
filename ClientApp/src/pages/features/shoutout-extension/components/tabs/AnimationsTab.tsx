import { Zap, Type, Layout as LayoutIcon, Play } from 'lucide-react';

interface AnimationsTabProps {
    animationType: string;
    setAnimationType: (v: string) => void;
    animationSpeed: string;
    setAnimationSpeed: (v: string) => void;
    textOutlineEnabled: boolean;
    setTextOutlineEnabled: (v: boolean) => void;
    textOutlineColor: string;
    setTextOutlineColor: (v: string) => void;
    textOutlineWidth: number;
    setTextOutlineWidth: (v: number) => void;
    containerBorderEnabled: boolean;
    setContainerBorderEnabled: (v: boolean) => void;
    containerBorderColor: string;
    setContainerBorderColor: (v: string) => void;
    containerBorderWidth: number;
    setContainerBorderWidth: (v: number) => void;
    testing: boolean;
    handleTestShoutout: () => void;
}

export function AnimationsTab({
    animationType, setAnimationType,
    animationSpeed, setAnimationSpeed,
    textOutlineEnabled, setTextOutlineEnabled,
    textOutlineColor, setTextOutlineColor,
    textOutlineWidth, setTextOutlineWidth,
    containerBorderEnabled, setContainerBorderEnabled,
    containerBorderColor, setContainerBorderColor,
    containerBorderWidth, setContainerBorderWidth,
    testing, handleTestShoutout
}: AnimationsTabProps) {
    return (
        <div className="space-y-6">
            {/* Animación de Entrada/Salida */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    Animación
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold">
                            Tipo de Animación
                        </label>
                        <select
                            value={animationType}
                            onChange={(e) => setAnimationType(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="none">Sin animación</option>
                            <option value="slide">Deslizar</option>
                            <option value="bounce">Rebote</option>
                            <option value="fade">Fade In/Out</option>
                            <option value="zoom">Zoom</option>
                            <option value="rotate">Rotar</option>
                        </select>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Selecciona cómo aparece y desaparece el overlay
                        </p>
                    </div>

                    <div>
                        <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold">
                            Velocidad de Animación
                        </label>
                        <select
                            value={animationSpeed}
                            onChange={(e) => setAnimationSpeed(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="slow">Lenta (1s)</option>
                            <option value="normal">Normal (0.5s)</option>
                            <option value="fast">Rápida (0.3s)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Efectos Visuales */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Type className="w-5 h-5 text-purple-600" />
                    Contorno del Texto
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                Habilitar Contorno
                            </label>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Agrega un borde alrededor del texto para mayor contraste
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
                                <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    <span>Fino (1px)</span>
                                    <span>Grueso (10px)</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Borde del Contenedor */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <LayoutIcon className="w-5 h-5 text-blue-600" />
                    Borde del Contenedor
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                Habilitar Borde
                            </label>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Agrega un borde rectangular alrededor del overlay completo
                            </p>
                        </div>
                        <button
                            onClick={() => setContainerBorderEnabled(!containerBorderEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                containerBorderEnabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    containerBorderEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    {containerBorderEnabled && (
                        <>
                            <div>
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold">
                                    Color del Borde
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={containerBorderColor}
                                        onChange={(e) => setContainerBorderColor(e.target.value)}
                                        className="w-16 h-10 rounded cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                    />
                                    <input
                                        type="text"
                                        value={containerBorderColor}
                                        onChange={(e) => setContainerBorderColor(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]"
                                        placeholder="#ffffff"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold flex items-center justify-between">
                                    <span>Grosor del Borde</span>
                                    <span className="text-[#2563eb] font-bold">{containerBorderWidth}px</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={containerBorderWidth}
                                    onChange={(e) => setContainerBorderWidth(parseInt(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                                <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    <span>Fino (1px)</span>
                                    <span>Grueso (10px)</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Vista Previa de Animaciones */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Play className="w-5 h-5 text-green-600" />
                    Vista Previa
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Envía un shoutout de prueba al overlay para ver las animaciones y efectos en acción.
                    Asegúrate de tener el overlay abierto en OBS o en el navegador.
                </p>
                <button
                    onClick={handleTestShoutout}
                    disabled={testing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg text-lg"
                >
                    <Play className="w-5 h-5" />
                    {testing ? 'Enviando...' : 'Probar Animaciones'}
                </button>
            </div>
        </div>
    );
}
