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
    draft: 'bg-ds-faint/10 text-ds-soft border-ds-border/30',
    sending: 'bg-ds-warn/10 text-ds-warn border-ds-warn/40',
    sent: 'bg-ds-accent/10 text-ds-ok border-ds-ok/40',
    failed: 'bg-ds-danger-solid/10 text-ds-danger border-ds-danger/40',
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
                <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
            </div>
        );
    }

    // Preview modal
    if (previewHtml) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-ds-text">Preview</h3>
                    <button onClick={() => setPreviewHtml(null)} className="ds-btn ds-btn--secondary">
                        Cerrar Preview
                    </button>
                </div>
                <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
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
                    <h3 className="text-lg font-black text-ds-text">Nueva Campaña</h3>
                    <button onClick={() => setCreating(false)} className="ds-btn ds-btn--secondary">
                        Cancelar
                    </button>
                </div>

                <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">Nombre de la campaña</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Newsletter Mayo 2026"
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Template selector */}
                    <div>
                        <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">Template</label>
                        <div className="flex gap-2">
                            <select
                                value={selectedTemplate || ''}
                                onChange={e => setSelectedTemplate(Number(e.target.value) || null)}
                                className="ds-input flex-1"
                            >
                                <option value="">Seleccionar template...</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>
                                ))}
                            </select>
                            {selectedTemplate && (
                                <button onClick={handlePreview} className="px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-sm font-semibold hover:bg-ds-raised transition-colors">
                                    <Eye className="w-4 h-4 text-ds-accent-text" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recipients */}
                    <div>
                        <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">
                            Destinatarios ({selectedRecipients.length} seleccionados)
                        </label>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-soft" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar por login o email..."
                                    className="ds-input w-full pl-9 pr-3"
                                />
                            </div>
                            <button onClick={toggleAll} className="ds-btn ds-btn--secondary">
                                {filteredRecipients.every(r => selectedRecipients.includes(r.id)) ? 'Deseleccionar' : 'Seleccionar'} todos
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto border border-ds-border rounded-lg">
                            {filteredRecipients.map(r => (
                                <label
                                    key={r.id}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-ds-bg cursor-pointer border-b border-ds-border last:border-0"
                                >
                                    <button onClick={() => toggleRecipient(r.id)} className="text-ds-accent-text">
                                        {selectedRecipients.includes(r.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-ds-soft" />}
                                    </button>
                                    {r.profileImageUrl && (
                                        <img src={r.profileImageUrl} alt="" className="w-6 h-6 rounded-full" />
                                    )}
                                    <span className="text-sm font-semibold text-ds-text">{r.login}</span>
                                    <span className="text-xs text-ds-soft">{r.email}</span>
                                </label>
                            ))}
                            {filteredRecipients.length === 0 && (
                                <p className="px-3 py-4 text-center text-sm text-ds-soft">No hay destinatarios con email</p>
                            )}
                        </div>
                    </div>

                    {/* Send */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-ds-border">
                        <button
                            onClick={handleSend}
                            disabled={sending || !name || !selectedTemplate || selectedRecipients.length === 0}
                            className="ds-btn ds-btn--primary"
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
                    className="ds-btn ds-btn--primary"
                >
                    <Send className="w-4 h-4" />
                    Nueva Campaña
                </button>
            </div>

            {campaigns.length === 0 ? (
                <div className="bg-ds-surface rounded-lg border border-ds-border p-12 text-center">
                    <p className="text-ds-soft">No hay campañas enviadas aún.</p>
                </div>
            ) : (
                <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ds-border">
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Nombre</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Template</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Estado</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Enviados</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map(c => (
                                    <tr key={c.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                        <td className="px-4 py-3 font-semibold text-ds-text">{c.name}</td>
                                        <td className="px-4 py-3 text-ds-soft">{c.templateName}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_BADGES[c.status] || STATUS_BADGES.draft}`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-ds-ok font-bold">{c.totalSent}</span>
                                            {c.totalFailed > 0 && <span className="text-ds-danger ml-1">/ {c.totalFailed} fail</span>}
                                        </td>
                                        <td className="px-4 py-3 text-ds-soft">
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
