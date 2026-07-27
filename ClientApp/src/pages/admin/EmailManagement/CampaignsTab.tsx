import { useState, useEffect } from 'react';
import { Send, Eye, Loader2, Search, CheckSquare, Square, Users } from 'lucide-react';
import api from '../../../services/api';

interface Template {
    id: number;
    name: string;
    subject: string;
}

interface Recipient {
    id: number;
    login: string;
    email: string;
    profileImageUrl: string;
}

interface Campaign {
    id: number;
    name: string;
    templateName: string;
    status: string;
    totalSent: number;
    totalFailed: number;
    sentAt: string | null;
    createdAt: string;
}

const STATUS_BADGES: Record<string, string> = {
    draft: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    sending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    sent: 'bg-green-500/10 text-green-400 border-green-500/30',
    failed: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function CampaignsTab() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [sending, setSending] = useState(false);

    // New campaign form
    const [name, setName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
    const [selectedRecipients, setSelectedRecipients] = useState<number[]>([]);
    const [search, setSearch] = useState('');
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [campaignsRes, templatesRes, recipientsRes] = await Promise.all([
                api.get<Campaign[]>('/admin/email/campaigns'),
                api.get<Template[]>('/admin/email/templates'),
                api.get<Recipient[]>('/admin/email/recipients'),
            ]);
            setCampaigns(campaignsRes.data);
            setTemplates(templatesRes.data);
            setRecipients(recipientsRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async () => {
        if (!selectedTemplate) return;
        try {
            const res = await api.get(`/admin/email/templates/${selectedTemplate}`);
            setPreviewHtml(res.data.htmlContent);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSend = async () => {
        if (!name || !selectedTemplate || selectedRecipients.length === 0) {
            alert('Completa nombre, template y selecciona al menos un destinatario');
            return;
        }
        if (!confirm(`¿Enviar email a ${selectedRecipients.length} destinatario(s)?`)) return;

        setSending(true);
        try {
            const res = await api.post('/admin/email/campaigns', {
                name,
                templateId: selectedTemplate,
                recipientIds: selectedRecipients,
            });
            alert(`Campaña enviada: ${res.data.sent} exitosos, ${res.data.failed} fallidos`);
            setCreating(false);
            setName('');
            setSelectedTemplate(null);
            setSelectedRecipients([]);
            loadData();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Error al enviar');
        } finally {
            setSending(false);
        }
    };

    const toggleRecipient = (id: number) => {
        setSelectedRecipients(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        const filtered = filteredRecipients;
        if (filtered.every(r => selectedRecipients.includes(r.id))) {
            setSelectedRecipients(prev => prev.filter(id => !filtered.some(r => r.id === id)));
        } else {
            setSelectedRecipients(prev => [...new Set([...prev, ...filtered.map(r => r.id)])]);
        }
    };

    const filteredRecipients = recipients.filter(r =>
        r.login.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    // Preview modal
    if (previewHtml) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Preview</h3>
                    <button onClick={() => setPreviewHtml(null)} className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                        Cerrar Preview
                    </button>
                </div>
                <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                    <iframe srcDoc={previewHtml} className="w-full" style={{ height: '70vh', border: 'none' }} />
                </div>
            </div>
        );
    }

    // Create campaign form
    if (creating) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Nueva Campaña</h3>
                    <button onClick={() => setCreating(false)} className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                        Cancelar
                    </button>
                </div>

                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1 uppercase">Nombre de la campaña</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Newsletter Mayo 2026"
                            className="w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/50 placeholder-[#94a3b8]"
                        />
                    </div>

                    {/* Template selector */}
                    <div>
                        <label className="block text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1 uppercase">Template</label>
                        <div className="flex gap-2">
                            <select
                                value={selectedTemplate || ''}
                                onChange={e => setSelectedTemplate(Number(e.target.value) || null)}
                                className="flex-1 px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]"
                            >
                                <option value="">Seleccionar template...</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>
                                ))}
                            </select>
                            {selectedTemplate && (
                                <button onClick={handlePreview} className="px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm font-semibold hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors">
                                    <Eye className="w-4 h-4 text-[#2563eb]" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recipients */}
                    <div>
                        <label className="block text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1 uppercase">
                            Destinatarios ({selectedRecipients.length} seleccionados)
                        </label>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar por login o email..."
                                    className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/50 placeholder-[#94a3b8]"
                                />
                            </div>
                            <button onClick={toggleAll} className="px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-xs font-bold text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors">
                                {filteredRecipients.every(r => selectedRecipients.includes(r.id)) ? 'Deseleccionar' : 'Seleccionar'} todos
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto border border-[#e2e8f0] dark:border-[#374151] rounded-xl">
                            {filteredRecipients.map(r => (
                                <label
                                    key={r.id}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-[#f8fafc] dark:hover:bg-[#374151]/30 cursor-pointer border-b border-[#e2e8f0] dark:border-[#374151] last:border-0"
                                >
                                    <button onClick={() => toggleRecipient(r.id)} className="text-[#2563eb]">
                                        {selectedRecipients.includes(r.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-[#94a3b8]" />}
                                    </button>
                                    {r.profileImageUrl && (
                                        <img src={r.profileImageUrl} alt="" className="w-6 h-6 rounded-full" />
                                    )}
                                    <span className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">{r.login}</span>
                                    <span className="text-xs text-[#94a3b8]">{r.email}</span>
                                </label>
                            ))}
                            {filteredRecipients.length === 0 && (
                                <p className="px-3 py-4 text-center text-sm text-[#94a3b8]">No hay destinatarios con email</p>
                            )}
                        </div>
                    </div>

                    {/* Send */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <button
                            onClick={handleSend}
                            disabled={sending || !name || !selectedTemplate || selectedRecipients.length === 0}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm disabled:opacity-50"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Enviar Campaña
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Campaigns list
    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm"
                >
                    <Send className="w-4 h-4" />
                    Nueva Campaña
                </button>
            </div>

            {campaigns.length === 0 ? (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-12 text-center">
                    <p className="text-[#64748b] dark:text-[#94a3b8]">No hay campañas enviadas aún.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Nombre</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Template</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Estado</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Enviados</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map(c => (
                                    <tr key={c.id} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0 hover:bg-[#f8fafc] dark:hover:bg-[#374151]/30">
                                        <td className="px-4 py-3 font-semibold text-[#1e293b] dark:text-[#f8fafc]">{c.name}</td>
                                        <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">{c.templateName}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_BADGES[c.status] || STATUS_BADGES.draft}`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-green-400 font-bold">{c.totalSent}</span>
                                            {c.totalFailed > 0 && <span className="text-red-400 ml-1">/ {c.totalFailed} fail</span>}
                                        </td>
                                        <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">
                                            {c.sentAt ? new Date(c.sentAt).toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
