import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { Toggle } from '../SupportersConfig/shared';

type Platform = 'twitch' | 'kick';

interface AdminChannel {
    id: number;
    login: string;
    displayName: string;
    avatarUrl: string;
    isHidden: boolean;
}

const TABS: { id: Platform; label: string; badgeClass: string }[] = [
    { id: 'twitch', label: 'Twitch', badgeClass: 'bg-twitch text-white' },
    { id: 'kick', label: 'Kick', badgeClass: 'bg-kick text-black' },
];

export default function ChannelsVisibility() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Platform>('twitch');
    const [channels, setChannels] = useState<Record<Platform, AdminChannel[]>>({ twitch: [], kick: [] });
    const [loading, setLoading] = useState(true);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [twitchRes, kickRes] = await Promise.all([
                    api.get<AdminChannel[]>('/channels/admin/twitch'),
                    api.get<AdminChannel[]>('/channels/admin/kick'),
                ]);
                setChannels({ twitch: twitchRes.data, kick: kickRes.data });
            } catch {
                setSaveMessage({ type: 'error', text: '❌ Error al cargar los canales' });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleToggle = async (channel: AdminChannel) => {
        const next = !channel.isHidden;
        setChannels(cs => ({
            ...cs,
            [activeTab]: cs[activeTab].map(c => c.id === channel.id ? { ...c, isHidden: next } : c),
        }));
        try {
            await api.patch(`/channels/admin/${channel.id}/visibility`, { isHidden: next });
            setSaveMessage({ type: 'success', text: '✅ Guardado' });
        } catch {
            setChannels(cs => ({
                ...cs,
                [activeTab]: cs[activeTab].map(c => c.id === channel.id ? { ...c, isHidden: !next } : c),
            }));
            setSaveMessage({ type: 'error', text: '❌ Error al guardar' });
        } finally {
            setTimeout(() => setSaveMessage(null), 3000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center">
                    <div className="text-5xl mb-4">📺</div>
                    <p className="text-[#64748b] dark:text-[#94a3b8] font-bold">Cargando canales...</p>
                </div>
            </div>
        );
    }

    const list = channels[activeTab];

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                    <button
                        onClick={() => navigate('/admin')}
                        className="flex items-center gap-2 text-sm text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver a Admin
                    </button>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Canales del Carrusel</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        Controla qué canales aparecen en el carrusel público de la landing
                    </p>
                </div>
                {saveMessage && (
                    <div className={`px-4 py-2 rounded-lg font-bold text-sm ${saveMessage.type === 'success' ? 'bg-success-bg text-success-dark' : 'bg-danger-bg text-danger-dark'}`}>
                        {saveMessage.text}
                    </div>
                )}
            </div>

            <div className="flex gap-2 mb-6 border-b border-[#e2e8f0] dark:border-[#374151]">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-all ${
                            activeTab === tab.id
                                ? tab.badgeClass
                                : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
                        }`}
                    >
                        {tab.label}
                        <span className="ml-2 opacity-75">({channels[tab.id].length})</span>
                    </button>
                ))}
            </div>

            <div className="space-y-2">
                {list.length === 0 && (
                    <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-12">
                        No hay canales de {TABS.find(t => t.id === activeTab)?.label} todavía
                    </p>
                )}
                {list.map(channel => (
                    <div
                        key={channel.id}
                        className="flex items-center justify-between gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <img src={channel.avatarUrl} alt={channel.displayName} className="w-10 h-10 rounded-full shrink-0" />
                            <div className="min-w-0">
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{channel.displayName}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate">@{channel.login}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                {channel.isHidden ? 'Oculto' : 'Visible'}
                            </span>
                            <Toggle value={!channel.isHidden} onChange={() => handleToggle(channel)} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
