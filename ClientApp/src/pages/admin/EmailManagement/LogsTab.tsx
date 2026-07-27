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
    sent: 'bg-green-500/10 text-green-400 border-green-500/30',
    failed: 'bg-red-500/10 text-red-400 border-red-500/30',
    bounced: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
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
                <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    if (campaigns.length === 0) {
        return (
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-12 text-center">
                <p className="text-[#64748b] dark:text-[#94a3b8]">No hay campañas enviadas. Los logs aparecerán aquí cuando envíes tu primera campaña.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-[#64748b]" />
                <select
                    value={selectedCampaign || ''}
                    onChange={e => setSelectedCampaign(Number(e.target.value) || null)}
                    className="px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]"
                >
                    {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {/* Logs table */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                                <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Email</th>
                                <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Estado</th>
                                <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Fecha</th>
                                <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Resend ID</th>
                                <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-[#94a3b8]">Sin logs para esta campaña</td>
                                </tr>
                            ) : logs.map(l => (
                                <tr key={l.id} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0 hover:bg-[#f8fafc] dark:hover:bg-[#374151]/30">
                                    <td className="px-4 py-3 font-semibold text-[#1e293b] dark:text-[#f8fafc]">{l.recipientEmail}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_BADGES[l.status] || STATUS_BADGES.sent}`}>
                                            {l.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">
                                        {new Date(l.sentAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-[#94a3b8] font-mono">{l.resendId || '-'}</td>
                                    <td className="px-4 py-3 text-xs text-red-400 max-w-[200px] truncate">{l.errorMessage || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
