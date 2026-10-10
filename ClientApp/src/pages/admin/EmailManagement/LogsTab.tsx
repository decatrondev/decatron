import { useState, useEffect } from 'react';
import { Loader2, Filter } from 'lucide-react';
import api from '../../../services/api';

interface Campaign {
    id: number;
    name: string;
}

interface Log {
    id: number;
    recipientEmail: string;
    recipientUserId: number | null;
    status: string;
    sentAt: string;
    resendId: string | null;
    errorMessage: string | null;
}

const STATUS_BADGES: Record<string, string> = {
    sent: 'bg-ds-accent/10 text-ds-ok border-ds-ok/40',
    failed: 'bg-ds-danger-solid/10 text-ds-danger border-ds-danger/40',
    bounced: 'bg-ds-warn/10 text-ds-warn border-ds-warn/40',
};

export default function LogsTab() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCampaigns();
    }, []);

    useEffect(() => {
        if (selectedCampaign) loadLogs(selectedCampaign);
    }, [selectedCampaign]);

    const loadCampaigns = async () => {
        try {
            const res = await api.get<Campaign[]>('/admin/email/campaigns');
            setCampaigns(res.data);
            if (res.data.length > 0) {
                setSelectedCampaign(res.data[0].id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadLogs = async (campaignId: number) => {
        try {
            const res = await api.get<Log[]>(`/admin/email/campaigns/${campaignId}/logs`);
            setLogs(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
            </div>
        );
    }

    if (campaigns.length === 0) {
        return (
            <div className="bg-ds-surface rounded-lg border border-ds-border p-12 text-center">
                <p className="text-ds-soft">No hay campañas enviadas. Los logs aparecerán aquí cuando envíes tu primera campaña.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-ds-soft" />
                <select
                    value={selectedCampaign || ''}
                    onChange={e => setSelectedCampaign(Number(e.target.value) || null)}
                    className="ds-input"
                >
                    {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {/* Logs table */}
            <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-ds-border">
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Email</th>
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Estado</th>
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Fecha</th>
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Resend ID</th>
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-ds-soft">Sin logs para esta campaña</td>
                                </tr>
                            ) : logs.map(l => (
                                <tr key={l.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                    <td className="px-4 py-3 font-semibold text-ds-text">{l.recipientEmail}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_BADGES[l.status] || STATUS_BADGES.sent}`}>
                                            {l.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-ds-soft">
                                        {new Date(l.sentAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-ds-soft font-mono">{l.resendId || '-'}</td>
                                    <td className="px-4 py-3 text-xs text-ds-danger max-w-[200px] truncate">{l.errorMessage || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
