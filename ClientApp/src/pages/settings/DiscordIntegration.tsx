import { useState, useEffect } from 'react';
import { X, MessageSquare, ExternalLink, Unlink } from 'lucide-react';
import api from '../../services/api';
import { Linked } from './parts';

interface LinkedGuild {
    id: number;
    guildId: string;
    guildName: string;
    guildIcon: string | null;
}

interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
}

export default function DiscordIntegration() {
    const [linkedGuilds, setLinkedGuilds] = useState<LinkedGuild[]>([]);
    const [availableGuilds, setAvailableGuilds] = useState<DiscordGuild[]>([]);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState(false);
    const [showGuildPicker, setShowGuildPicker] = useState(false);

    useEffect(() => {
        loadLinkedGuilds();
        // Check if returning from Discord OAuth
        const params = new URLSearchParams(window.location.search);
        if (params.get('discord') === 'select') {
            loadAvailableGuilds();
            // Clean URL
            window.history.replaceState({}, '', '/settings');
        }
    }, []);

    const loadLinkedGuilds = async () => {
        try {
            const res = await api.get('/discord/linked');
            if (res.data.success) {
                setLinkedGuilds(res.data.guilds);
            }
        } catch (err) {
            console.error('Error loading linked guilds:', err);
        } finally {
            setLoading(false);
        }
    };

    const startDiscordAuth = async () => {
        try {
            const res = await api.get('/discord/auth');
            if (res.data.success) {
                window.location.href = res.data.url;
            }
        } catch (err) {
            console.error('Error starting Discord auth:', err);
        }
    };

    const loadAvailableGuilds = async () => {
        try {
            const res = await api.get('/discord/guilds');
            if (res.data.success) {
                setAvailableGuilds(res.data.guilds);
                setShowGuildPicker(true);
            }
        } catch (err) {
            console.error('Error loading guilds:', err);
        }
    };

    const linkGuild = async (guild: DiscordGuild) => {
        try {
            setLinking(true);
            const res = await api.post('/discord/link', {
                guildId: guild.id,
                guildName: guild.name,
                guildIcon: guild.icon
            });
            if (res.data.success) {
                setShowGuildPicker(false);
                loadLinkedGuilds();
            }
        } catch (err) {
            console.error('Error linking guild:', err);
        } finally {
            setLinking(false);
        }
    };

    const unlinkGuild = async (guildId: string) => {
        try {
            await api.delete(`/discord/unlink/${guildId}`);
            loadLinkedGuilds();
        } catch (err) {
            console.error('Error unlinking guild:', err);
        }
    };

    return (
        <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
            <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-ds-accent rounded-lg text-ds-on-accent">
                    <MessageSquare className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <div className="font-bold text-ds-text">Discord</div>
                    <div className="text-sm text-ds-soft">
                        {loading ? 'Cargando...' : linkedGuilds.length > 0 ? `${linkedGuilds.length} servidor${linkedGuilds.length > 1 ? 'es' : ''} vinculado${linkedGuilds.length > 1 ? 's' : ''}` : 'No vinculado'}
                    </div>
                </div>
                <button
                    onClick={startDiscordAuth}
                    className="ds-btn ds-btn--primary ds-btn--sm"
                >
                    <ExternalLink className="w-4 h-4" />
                    Conectar servidor
                </button>
            </div>

            {/* Linked guilds */}
            {linkedGuilds.length > 0 && (
                <div className="space-y-2 mt-3 pt-3 border-t border-ds-border">
                    {linkedGuilds.map(guild => (
                        <div key={guild.guildId} className="flex items-center gap-3 p-2 bg-ds-surface rounded-lg border border-ds-border">
                            {guild.guildIcon ? (
                                <img src={guild.guildIcon} alt="" className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 bg-ds-raised rounded-full flex items-center justify-center text-ds-accent-text text-xs font-bold">
                                    {guild.guildName.charAt(0)}
                                </div>
                            )}
                            <span className="flex-1 text-sm font-medium text-ds-text">{guild.guildName}</span>
                            <button
                                onClick={() => unlinkGuild(guild.guildId)}
                                className="p-1.5 hover:bg-ds-danger/10 rounded-lg text-ds-danger transition-colors"
                                title="Desvincular"
                            >
                                <Unlink className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Guild picker modal */}
            {showGuildPicker && (
                <div className="fixed inset-0 bg-ds-input/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg p-6 max-w-md w-full border border-ds-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black text-ds-text">Selecciona un servidor</h3>
                            <button onClick={() => setShowGuildPicker(false)} className="text-ds-soft hover:text-ds-text">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-ds-soft mb-4">
                            Servidores donde eres administrador:
                        </p>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {availableGuilds.length === 0 ? (
                                <p className="text-center text-ds-soft py-4">No se encontraron servidores</p>
                            ) : (
                                availableGuilds.map(guild => (
                                    <button
                                        key={guild.id}
                                        onClick={() => linkGuild(guild)}
                                        disabled={linking}
                                        className="ds-btn ds-btn--secondary ds-icon-btn w-full"
                                    >
                                        {guild.icon ? (
                                            <img src={guild.icon} alt="" className="w-10 h-10 rounded-full" />
                                        ) : (
                                            <div className="w-10 h-10 bg-ds-raised rounded-full flex items-center justify-center text-ds-accent-text font-bold">
                                                {guild.name.charAt(0)}
                                            </div>
                                        )}
                                        <span className="font-medium text-ds-text">{guild.name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
