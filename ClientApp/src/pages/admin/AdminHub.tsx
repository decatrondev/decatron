import { Cpu, MessageSquare, Heart, Star, TrendingUp, Settings, Coins, FileText, Mail, Gamepad2, Mic, Activity, Palette, Sparkles, Users, Languages, CircleDollarSign, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminCard {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    route: string;
    ready: boolean;
}

export default function AdminHub() {
    const navigate = useNavigate();

    const cards: AdminCard[] = [
        {
            id: 'decatron-ai',
            name: 'Decatron AI Admin',
            description: 'Administracion global del sistema de inteligencia artificial',
            icon: <Cpu className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/decatron-ai',
            ready: true
        },
        {
            id: 'decatron-chat',
            name: 'Decatron Chat Admin',
            description: 'Administracion global del sistema de chat',
            icon: <MessageSquare className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/decatron-chat',
            ready: true
        },
        {
            id: 'donations',
            name: 'Donaciones',
            description: 'Gestiona las donaciones recibidas en la plataforma',
            icon: <Heart className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/donations',
            ready: true
        },
        {
            id: 'supporters',
            name: 'Supporters',
            description: 'Gestiona los supporters y benefactores de la plataforma',
            icon: <Star className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/supporters',
            ready: true
        },
        {
            id: 'economy',
            name: 'Economia',
            description: 'Gestiona DecaCoins, paquetes, cupones, referidos y usuarios',
            icon: <Coins className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/economy',
            ready: true
        },
        {
            id: 'tcg',
            name: 'TCG — Upgrades en curso',
            description: 'Monitorea las cartas en gradeo y las que esperan pago de upgrade',
            icon: <Sparkles className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/tcg',
            ready: true
        },
        {
            id: 'tcg-art-queue',
            name: 'TCG — Cola de arte',
            description: 'Cartas que llegaron a nivel 3/6/9 y esperan la ilustración nueva',
            icon: <Palette className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/tcg-art-queue',
            ready: true
        },
        {
            id: 'ranking',
            name: 'Ranking Global',
            description: 'Configura el leaderboard global de la plataforma Decatron',
            icon: <TrendingUp className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/ranking',
            ready: false
        },
        {
            id: 'channels-visibility',
            name: 'Canales del Carrusel',
            description: 'Gestiona qué canales de Twitch y Kick aparecen en la página pública',
            icon: <Users className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/channels',
            ready: true
        },
        {
            id: 'email',
            name: 'Email Campaigns',
            description: 'Crea templates visuales y envia emails a streamers via Resend',
            icon: <Mail className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/email',
            ready: true
        },
        {
            id: 'fortnite',
            name: 'Fortnite Spirit Tracker',
            description: 'Gestiona el catalogo de sprites de Fortnite y visualiza estadisticas de coleccion',
            icon: <Gamepad2 className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/fortnite',
            ready: true
        },
        {
            id: 'game-overlay-promos',
            name: 'Anuncios de Game Overlays',
            description: 'Catálogo de anuncios de Decatron que tapan la tarjeta de rango de los streamers: mensajes, imagen, peso, frecuencia y duración',
            icon: <Megaphone className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/game-overlay-promos',
            ready: true
        },
        {
            id: 'dev-docs',
            name: 'Dev Docs',
            description: 'Documentacion interna del proyecto, auditorias y planes',
            icon: <FileText className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/dev-docs',
            ready: true
        },
        {
            id: 'tts-lab',
            name: 'Laboratorio de voces',
            description: 'Compara las voces de Piper (gratis, en el servidor) con Polly: calidad, tiempo y coste',
            icon: <Mic className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/tts-lab',
            ready: true
        },
        {
            id: 'ai-costs',
            name: 'Costos de IA',
            description: 'Gasto en modelos de lenguaje por módulo, modelo y streamer; saldo de OpenRouter y modelos por módulo',
            icon: <CircleDollarSign className="w-6 h-6 text-[#9146FF]" />,
            route: '/admin/ai-costs',
            ready: true
        },
        {
            id: 'live-translation',
            name: 'Traducción en vivo',
            description: 'Uso, costo estimado por proveedor, sesiones activas y límites',
            icon: <Languages className="w-6 h-6 text-[#9146FF]" />,
            route: '/admin/live-translation',
            ready: true
        },
        {
            id: 'tts-credits',
            name: 'Créditos TTS',
            description: 'Saldo, historial y ajustes manuales de créditos por canal',
            icon: <Coins className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/tts-credits',
            ready: true
        },
        {
            id: 'logo',
            name: 'Logo de Decatron',
            description: 'Guía paso a paso para elegir la mascota y generar los 7 prompts derivados (favicon, avatar, hero, etc.)',
            icon: <Palette className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/logo',
            ready: true
        },
        {
            id: 'project-analysis',
            name: 'Radiografía del proyecto',
            description: 'Tamaño, composición, crecimiento y en qué archivos se concentra el riesgo',
            icon: <Activity className="w-6 h-6 text-[#2563eb]" />,
            route: '/admin/project-analysis',
            ready: true
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Admin</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        Panel de administracion
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cards.map((card) => (
                    <div
                        key={card.id}
                        className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] hover:shadow-lg transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    {card.icon}
                                    <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                        {card.name}
                                    </h3>
                                </div>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    {card.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                            {card.ready ? (
                                <button
                                    onClick={() => navigate(card.route)}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm"
                                >
                                    <Settings className="w-4 h-4" />
                                    Configurar
                                </button>
                            ) : (
                                <span className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] text-sm font-bold rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                                    Proximamente
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
