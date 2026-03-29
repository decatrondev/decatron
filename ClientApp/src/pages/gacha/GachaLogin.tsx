import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, Dices } from 'lucide-react';
import api from '../../services/api';

export default function GachaLogin() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pre-llenar username desde URL (?user=anthonydeca)
    useEffect(() => {
        const userParam = searchParams.get('user');
        if (userParam) {
            setUsername(userParam);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/gacha-auth/validate', {
                username,
                password
            });

            if (response.data.success) {
                // Guardar datos de Gacha en sessionStorage para vincular después
                sessionStorage.setItem('gachaUser', JSON.stringify({
                    id: response.data.gachaUserId,
                    username: response.data.gachaUsername
                }));

                // Redirigir a login de Twitch con parámetro redirect
                navigate('/login?redirect=gacha/terms');
            }
        } catch (err: any) {
            console.error('Error validando credenciales:', err);
            setError(err.response?.data?.message || 'Usuario o contraseña incorrectos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo and Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#2563eb] to-[#1e40af] rounded-2xl mb-4 shadow-lg">
                        <Dices className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">GachaVerse</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">Conecta con tu cuenta de Twitch</p>
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl shadow-lg border border-[#e2e8f0] dark:border-[#374151] p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Alert */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Username Field */}
                        <div>
                            <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                Usuario de GachaVerse
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-[#64748b]" />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition-all"
                                    placeholder="Ingresa tu usuario"
                                    required
                                    autoFocus
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-[#64748b]" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-12 pr-12 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition-all"
                                    placeholder="Ingresa tu contraseña"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc] transition-colors"
                                    disabled={loading}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !username || !password}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Validando...
                                </>
                            ) : (
                                'Continuar'
                            )}
                        </button>
                    </form>

                    {/* Info Box */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">ℹ️ Información</h3>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                            Ingresa tus credenciales de GachaVerse. Luego conectarás tu cuenta de Twitch para completar la vinculación.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
