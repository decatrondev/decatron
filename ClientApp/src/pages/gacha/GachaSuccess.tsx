import { useState, useEffect } from 'react';
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Sparkles, ExternalLink } from 'lucide-react';
import api from '../../services/api';

export default function GachaSuccess() {
    const [searchParams] = useSearchParams();
    const [countdown, setCountdown] = useState(5);
    const [progress, setProgress] = useState(100);
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            // Intercambiar code por JWT si está presente en URL
            const exchangeCode = searchParams.get('code');
            if (exchangeCode) {
                try {
                    const response = await api.post('/auth/exchange', { code: exchangeCode });
                    localStorage.setItem('token', response.data.token);
                } catch (err) {
                    console.error('Error exchanging code for token:', err);
                }
            }

            // Cargar configuración de Gacha
            loadConfig();
        };
        init();
    }, []);

    useEffect(() => {
        if (!config) return;

        // Countdown timer
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Redirigir a GachaVerse web
                    window.location.href = config.webUrl;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Progress bar
        const progressTimer = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev - (100 / 5);
                return newProgress < 0 ? 0 : newProgress;
            });
        }, 1000);

        return () => {
            clearInterval(timer);
            clearInterval(progressTimer);
        };
    }, [config]);

    const loadConfig = async () => {
        try {
            const response = await api.get('/gacha-auth/config');
            if (response.data.success) {
                setConfig(response.data);
            }
        } catch (err) {
            console.error('Error loading Gacha config:', err);
            // Fallback a localhost:3000
            setConfig({ webUrl: 'http://localhost:3000' });
        }
    };

    const handleManualRedirect = () => {
        if (config) {
            window.location.href = config.webUrl;
        }
    };

    if (!config) {
        return null;
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl shadow-lg border border-[#e2e8f0] dark:border-[#374151] p-12 text-center">
                    {/* Success Icon */}
                    <div className="relative inline-flex items-center justify-center mb-8">
                        <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                            <CheckCircle className="w-16 h-16 text-white" />
                        </div>
                        <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-yellow-500" />
                        <Sparkles className="absolute -bottom-4 -left-4 w-6 h-6 text-yellow-500" />
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                        ¡Cuenta Vinculada!
                    </h1>

                    {/* Description */}
                    <p className="text-xl text-[#64748b] dark:text-[#94a3b8] mb-8">
                        Tu cuenta de GachaVerse ha sido conectada correctamente con Twitch
                    </p>

                    {/* Success Details */}
                    <div className="bg-[#f8fafc] dark:bg-[#262626] rounded-xl p-6 mb-8 border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-green-600 dark:text-green-400 font-semibold">Sincronizado</span>
                            </div>
                            <span className="text-[#64748b]">•</span>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">Listo para usar</span>
                            </div>
                        </div>
                    </div>

                    {/* Countdown */}
                    <div className="mb-8">
                        <div className="text-[#64748b] dark:text-[#94a3b8] mb-3">
                            Redirigiendo a GachaVerse en
                        </div>
                        <div className="text-6xl font-black text-[#2563eb] mb-4">
                            {countdown}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#2563eb] to-blue-600 transition-all duration-1000 ease-linear"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Manual Redirect Button */}
                    <button
                        onClick={handleManualRedirect}
                        className="inline-flex items-center gap-2 px-8 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all duration-200"
                    >
                        Ir a GachaVerse Ahora
                        <ExternalLink className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
