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
                <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
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
                    className="flex items-center gap-2 px-4 py-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg transition-all font-semibold text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Template
                </button>
            </div>

            {/* List */}
            {templates.length === 0 ? (
                <div className="bg-ds-surface rounded-lg border border-ds-border p-12 text-center">
                    <p className="text-ds-soft">No hay templates. Crea uno para empezar.</p>
                </div>
            ) : (
                <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ds-border">
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Nombre</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Subject</th>
                                    <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Actualizado</th>
                                    <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templates.map(t => (
                                    <tr key={t.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                        <td className="px-4 py-3 font-semibold text-ds-text">{t.name}</td>
                                        <td className="px-4 py-3 text-ds-soft">{t.subject}</td>
                                        <td className="px-4 py-3 text-ds-soft">
                                            {new Date(t.updatedAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => { setEditingId(t.id); setEditorOpen(true); }} className="p-2 hover:bg-ds-raised rounded-lg transition-colors" title="Editar">
                                                    <Edit3 className="w-4 h-4 text-ds-accent-text" />
                                                </button>
                                                <button onClick={() => handleDuplicate(t.id)} className="p-2 hover:bg-ds-raised rounded-lg transition-colors" title="Duplicar">
                                                    <Copy className="w-4 h-4 text-ds-soft" />
                                                </button>
                                                <button onClick={() => handleDelete(t.id)} className="p-2 hover:bg-ds-raised rounded-lg transition-colors" title="Eliminar">
                                                    <Trash2 className="w-4 h-4 text-ds-danger" />
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
