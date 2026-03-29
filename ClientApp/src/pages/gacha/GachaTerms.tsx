import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Link as LinkIcon, Loader2, Shield, Dices } from 'lucide-react';
import api from '../../services/api';

export default function GachaTerms() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [gachaUser, setGachaUser] = useState<any>(null);
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
                // Limpiar el code de la URL
                navigate('/gacha/terms', { replace: true });
            }

            // Cargar datos de Gacha desde sessionStorage
            const stored = sessionStorage.getItem('gachaUser');
            if (!stored) {
                navigate('/gacha/login');
                return;
            }
            setGachaUser(JSON.parse(stored));

            // Cargar configuración de Gacha
            loadConfig();
        };
        init();
    }, [navigate, searchParams]);
    const loadConfig = async () => {
        try {
            const response = await api.get('/gacha-auth/config');
            if (response.data.success) {
                setConfig(response.data);
            }
        } catch (err) {
            console.error('Error loading Gacha config:', err);
        }
    };

    const handleAccept = async () => {
        setError('');
        setLoading(true);

        try {
            // Vincular cuentas automáticamente
            const response = await api.post('/gacha-auth/link', {
                gachaUserId: gachaUser.id
            });

            if (response.data.success) {
                // Limpiar sessionStorage
                sessionStorage.removeItem('gachaUser');

                // Redirigir a página de éxito
                navigate('/gacha/success');
            }
        } catch (err: any) {
            console.error('Error vinculando cuentas:', err);
            setError(err.response?.data?.message || 'Error al vincular las cuentas');
        } finally {
            setLoading(false);
        }
    };

    if (!gachaUser || !config) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#1B1C1D]">
                <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D] p-4">
            <div className="max-w-3xl mx-auto py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#2563eb] to-[#1e40af] rounded-2xl mb-4 shadow-lg">
                        <Dices className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                        Términos y Condiciones
                    </h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        Vinculación de GachaVerse con Twitch
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl shadow-lg border border-[#e2e8f0] dark:border-[#374151] p-8 mb-6">
                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Welcome Box */}
                    <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                            <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            <h2 className="text-xl font-black text-blue-700 dark:text-blue-300">
                                ¡Bienvenido, {gachaUser.username}!
                            </h2>
                        </div>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                            Estás a un paso de vincular tu cuenta de GachaVerse con Twitch.
                        </p>
                    </div>

                    {/* Terms Content */}
                    <div className="space-y-6 mb-8">
                        <div>
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-[#2563eb]" />
                                Autorización del Bot
                            </h3>
                            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg p-4">
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-3">
                                    Al continuar, autorizas que el bot <strong className="text-[#1e293b] dark:text-[#f8fafc]">@{config.botUsername}</strong> se una a tu canal de Twitch.
                                </p>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                    <p className="text-sm font-bold text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        IMPORTANTE
                                    </p>
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                        Debes darle <strong>MOD</strong> al bot para que funcione correctamente:
                                    </p>
                                    <code className="block mt-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 px-3 py-2 rounded font-mono text-yellow-800 dark:text-yellow-200">
                                        /mod {config.botUsername}
                                    </code>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                                <LinkIcon className="w-5 h-5 text-[#2563eb]" />
                                Vinculación de Cuentas
                            </h3>
                            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg p-4">
                                <ul className="space-y-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] font-bold">•</span>
                                        Tu cuenta de GachaVerse se vinculará con tu cuenta de Twitch
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] font-bold">•</span>
                                        Podrás usar el sistema de gacha en tus streams
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] font-bold">•</span>
                                        Los datos de tu cuenta permanecen seguros y privados
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] font-bold">•</span>
                                        Puedes desvincular tu cuenta en cualquier momento desde la configuración
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] font-bold rounded-lg hover:bg-[#e2e8f0] dark:hover:bg-[#374151] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAccept}
                            disabled={loading}
                            className="flex-2 flex items-center justify-center gap-2 px-8 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Vinculando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    Aceptar y Continuar
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Footer Note */}
                <p className="text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                    Al hacer clic en "Aceptar y Continuar", aceptas los términos y condiciones de uso del servicio.
                </p>
            </div>
        </div>
    );
}
