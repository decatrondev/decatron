import { Bot, Shield, Clock } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Login() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const error = searchParams.get('error');
    const exchangeCode = searchParams.get('code');
    const redirect = searchParams.get('redirect');
    const [exchangeError, setExchangeError] = useState<string | null>(null);

    useEffect(() => {
        if (exchangeCode) {
            // Intercambiar code por JWT
            api.post('/auth/exchange', { code: exchangeCode })
                .then((response) => {
                    localStorage.setItem('token', response.data.token);

                    // Redirigir según el parámetro redirect
                    if (redirect === 'gacha/terms') {
                        navigate('/gacha/terms');
                    } else {
                        navigate('/dashboard');
                    }
                })
                .catch(() => {
                    setExchangeError('Authentication failed. Please try again.');
                });
        }
    }, [exchangeCode, navigate, redirect]);

    const handleTwitchLogin = () => {
        // Si hay redirect, pasarlo al backend para que lo preserve
        const redirectParam = redirect ? `?redirect=${redirect}` : '';
        window.location.href = `/api/auth/login${redirectParam}`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1B1C1D] px-4">
            <div className="max-w-6xl w-full grid md:grid-cols-2 bg-white dark:bg-[#1B1C1D] rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">

                {/* Login Box */}
                <div className="p-12 flex flex-col justify-center">
                    <div className="mb-8">
                        <h1 className="text-4xl font-black mb-3 text-[#1e293b] dark:text-[#f8fafc]">
                            Bienvenido
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Inicia sesión para gestionar tu bot de Twitch
                        </p>
                    </div>

                    {(error || exchangeError) && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                                {error || exchangeError}
                            </p>
                        </div>
                    )}

                    <div className="mb-8">
                        <p className="text-[#1e293b] dark:text-[#f8fafc] font-semibold mb-4">
                            Conecta con Twitch
                        </p>

                        <button
                            onClick={handleTwitchLogin}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#9146ff] to-[#772ce8] hover:from-[#772ce8] hover:to-[#5c16c5] text-white font-bold rounded-lg transition-all hover:-translate-y-0.5 shadow-lg relative overflow-hidden group"
                        >
                            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                            </svg>
                            <span>Continuar con Twitch</span>
                        </button>
                    </div>

                    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-[#e2e8f0] dark:border-[#374151] rounded-lg mb-6">
                        <h3 className="text-[#2563eb] font-bold mb-2">¿Por qué Twitch OAuth?</h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Autenticación segura mediante Twitch. Nunca almacenamos tu contraseña.
                        </p>
                    </div>

                    <p className="text-center text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Al continuar, aceptas los{' '}
                        <a href="#" className="text-[#2563eb] font-semibold hover:underline">
                            Términos de Servicio
                        </a>
                    </p>
                </div>

                {/* Info Panel */}
                <div className="hidden md:flex bg-gradient-to-br from-blue-900 to-blue-800 dark:from-[#1B1C1D] dark:to-[#1e293b] p-12 flex-col justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
                    </div>

                    <div className="relative z-10 text-white">
                        <h2 className="text-3xl font-black mb-8">
                            Potencia tu Canal
                        </h2>

                        <div className="space-y-6">
                            {features.map((feature, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 bg-white/10 rounded-lg backdrop-blur">
                                    <feature.icon className="w-6 h-6 flex-shrink-0 mt-1" />
                                    <div>
                                        <h3 className="font-bold mb-1">{feature.title}</h3>
                                        <p className="text-sm opacity-90">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const features = [
    {
        icon: Bot,
        title: 'Comandos Personalizados',
        description: 'Crea comandos únicos para tu comunidad'
    },
    {
        icon: Shield,
        title: 'Moderación Automática',
        description: 'Protección 24/7 para tu chat'
    },
    {
        icon: Clock,
        title: 'Gestión en Tiempo Real',
        description: 'Control total desde tu dashboard'
    }
];