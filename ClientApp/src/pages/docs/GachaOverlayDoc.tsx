import { Dice6, AlertCircle } from 'lucide-react';

export default function GachaOverlayDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl flex items-center justify-center border border-[#e2e8f0] dark:border-[#374151]">
                        <Dice6 className="w-8 h-8 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white">Overlay de Gacha</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Sistema de sorteos y recompensas aleatorias
                        </p>
                    </div>
                </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-12">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-orange-600 dark:text-orange-400 mx-auto mb-4" />
                    <h2 className="text-3xl font-black text-orange-900 dark:text-orange-100 mb-3">
                        Próximamente
                    </h2>
                    <p className="text-orange-700 dark:text-orange-300 text-lg mb-6">
                        El sistema de Gacha está en desarrollo activo
                    </p>
                    <div className="bg-white dark:bg-orange-900/30 rounded-xl p-6 max-w-2xl mx-auto">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            Características planeadas:
                        </h3>
                        <ul className="space-y-2 text-left text-[#64748b] dark:text-[#94a3b8]">
                            <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold">•</span>
                                <span>Sistema de rareza (Común, Raro, Épico, Legendario)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold">•</span>
                                <span>Animaciones de apertura de "cajas"</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold">•</span>
                                <span>Recompensas personalizables</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold">•</span>
                                <span>Sistema de inventario</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-orange-600 font-bold">•</span>
                                <span>Integración con puntos de canal</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
