import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Copy, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import EmailEditor from './EmailEditor';

interface Template {
    id: number;
    name: string;
    subject: string;
    createdAt: string;
    updatedAt: string;
}

export default function TemplatesTab() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const loadTemplates = async () => {
        try {
            const res = await api.get<Template[]>('/admin/email/templates');
            setTemplates(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTemplates(); }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este template?')) return;
        try {
            await api.delete(`/admin/email/templates/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (e: any) {
            alert(e.response?.data?.error || 'Error al eliminar');
        }
    };

    const handleDuplicate = async (id: number) => {
        try {
            const res = await api.get(`/admin/email/templates/${id}`);
            const t = res.data;
            await api.post('/admin/email/templates', {
                name: `${t.name} (copia)`,
                subject: t.subject,
                htmlContent: t.htmlContent,
                designJson: t.designJson,
            });
            loadTemplates();
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

    if (editorOpen) {
        return (
            <EmailEditor
                templateId={editingId}
                onClose={() => { setEditorOpen(false); setEditingId(null); }}
                onSaved={() => { setEditorOpen(false); setEditingId(null); loadTemplates(); }}
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* Actions */}
            <div className="flex justify-end">
                <button
                    onClick={() => { setEditingId(null); setEditorOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Template
                </button>
            </div>

            {/* List */}
            {templates.length === 0 ? (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-12 text-center">
                    <p className="text-[#64748b] dark:text-[#94a3b8]">No hay templates. Crea uno para empezar.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Nombre</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Subject</th>
                                    <th className="text-left px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Actualizado</th>
                                    <th className="text-right px-4 py-3 text-[#64748b] font-bold text-xs uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templates.map(t => (
                                    <tr key={t.id} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-0 hover:bg-[#f8fafc] dark:hover:bg-[#374151]/30">
                                        <td className="px-4 py-3 font-semibold text-[#1e293b] dark:text-[#f8fafc]">{t.name}</td>
                                        <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">{t.subject}</td>
                                        <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8]">
                                            {new Date(t.updatedAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => { setEditingId(t.id); setEditorOpen(true); }} className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors" title="Editar">
                                                    <Edit3 className="w-4 h-4 text-[#2563eb]" />
                                                </button>
                                                <button onClick={() => handleDuplicate(t.id)} className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors" title="Duplicar">
                                                    <Copy className="w-4 h-4 text-[#64748b]" />
                                                </button>
                                                <button onClick={() => handleDelete(t.id)} className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors" title="Eliminar">
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
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
