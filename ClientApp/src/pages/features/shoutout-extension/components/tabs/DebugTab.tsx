import { Play } from 'lucide-react';

interface DebugTabProps {
    showDebugTimer: boolean;
    setShowDebugTimer: (v: boolean) => void;
    testing: boolean;
    handleTestShoutout: () => void;
}

export function DebugTab({
    showDebugTimer, setShowDebugTimer,
    testing, handleTestShoutout
}: DebugTabProps) {
    return (
        <div className="space-y-6">
            {/* Test Shoutout */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Play className="w-5 h-5 text-green-600" />
                    Probar Shoutout
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Envía un shoutout de prueba al overlay para ver cómo se ve con tu configuración actual.
                    Asegúrate de tener el overlay abierto en OBS o en el navegador.
                </p>
                <button
                    onClick={handleTestShoutout}
                    disabled={testing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg text-lg"
                >
                    <Play className="w-6 h-6" />
                    {testing ? 'Enviando...' : 'Enviar Shoutout de Prueba'}
                </button>
            </div>

            {/* Debug Options */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    Opciones de Debugging
                </h3>

                <div className="space-y-4">
                    {/* Show Debug Timer */}
                    <div className="flex items-center justify-between p-4 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                Mostrar Timer de Countdown
                            </p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                Muestra el tiempo restante en la esquina del overlay (útil para ajustar la duración)
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                            <input
                                type="checkbox"
                                checked={showDebugTimer}
                                onChange={(e) => setShowDebugTimer(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-8 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>

                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        ⚠️ <strong>Nota:</strong> Recuerda guardar la configuración después de cambiar las opciones de debug.
                    </p>
                </div>
            </div>
        </div>
    );
}
