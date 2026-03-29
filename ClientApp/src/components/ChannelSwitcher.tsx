import { useState, useEffect } from 'react';
import { ChevronDown, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

interface Channel {
    channelId: number;
    displayName: string;
    profileImageUrl: string;
    isOwner: boolean;
    accessLevel: string;
}

export default function ChannelSwitcher() {
    const { t } = useTranslation(['layout']);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [current, setCurrent] = useState<Channel | null>(null);
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { hasMinimumLevel } = usePermissions();

    useEffect(() => {
        loadChannels();
        loadContext();
    }, []);

    const loadChannels = async () => {
        try {
            const res = await api.get('/channel/available');
            if (res.data.success) {
                setChannels(res.data.channels);
            }
        } catch (err) {
            console.error('Error loading channels:', err);
        }
    };

    const loadContext = async () => {
        try {
            const res = await api.get('/channel/context');
            if (res.data.success) {
                setCurrent(res.data.context.activeChannel);
            }
        } catch (err) {
            console.error('Error loading context:', err);
        }
    };

    const switchChannel = async (channelId: number) => {
        try {
            const res = await api.post('/channel/switch', { channelId });
            if (res.data.success) {
                setCurrent(res.data.activeChannel);
                setOpen(false);
                window.location.reload();
            }
        } catch (err) {
            console.error('Error switching channel:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = '/';
    };

    const handleSettings = () => {
        setOpen(false);
        navigate('/settings');
    };

    if (!current) return null;

    return (
        <div className="relative">
            <button onClick={() => setOpen(!open)} className="flex items-center gap-3 px-4 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg hover:border-[#2563eb] transition-colors">
                <img src={current.profileImageUrl} alt={current.displayName} className="w-8 h-8 rounded-full" />
                <div className="text-left">
                    <div className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">{current.displayName}</div>
                    <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{current.isOwner ? t('layout:channelSwitcher.owner') : current.accessLevel}</div>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg shadow-xl z-50 overflow-hidden">
                    {/* Lista de canales */}
                    <div className="max-h-64 overflow-y-auto">
                        {channels.map(ch => (
                            <button key={ch.channelId} onClick={() => switchChannel(ch.channelId)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f8fafc] dark:hover:bg-[#1B1C1D] transition-colors border-b border-[#e2e8f0] dark:border-[#374151] last:border-b-0">
                                <img src={ch.profileImageUrl} alt={ch.displayName} className="w-10 h-10 rounded-full" />
                                <div className="text-left flex-1">
                                    <div className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">{ch.displayName}</div>
                                    <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{ch.isOwner ? t('layout:channelSwitcher.owner') : ch.accessLevel}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Separador */}
                    <div className="border-t-2 border-[#e2e8f0] dark:border-[#374151]"></div>

                    {/* Botones de acción */}
                    <div className="py-1">
                        {/* Botón de Configuración - solo visible con control_total */}
                        {hasMinimumLevel('control_total') && (
                            <button onClick={handleSettings} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f8fafc] dark:hover:bg-[#1B1C1D] transition-colors text-[#1e293b] dark:text-[#f8fafc]">
                                <Settings className="w-5 h-5" />
                                <span className="font-semibold">{t('layout:channelSwitcher.settings')}</span>
                            </button>
                        )}

                        {/* Botón de Cerrar Sesión */}
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400">
                            <LogOut className="w-5 h-5" />
                            <span className="font-semibold">{t('layout:channelSwitcher.logout')}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}