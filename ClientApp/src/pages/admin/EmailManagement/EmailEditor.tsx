import { useRef, useState, useEffect } from 'react';
import EmailEditorComponent from 'react-email-editor';
import { Save, X, Send, Loader2 } from 'lucide-react';
import api from '../../../services/api';

interface Props {
    templateId: number | null;
    onClose: () => void;
    onSaved: () => void;
}

export default function EmailEditor({ templateId, onClose, onSaved }: Props) {
    const emailEditorRef = useRef<any>(null);
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(!!templateId);

    useEffect(() => {
        if (templateId && ready) {
            loadTemplate();
        }
    }, [templateId, ready]);

    const loadTemplate = async () => {
        try {
            const res = await api.get(`/admin/email/templates/${templateId}`);
            const t = res.data;
            setName(t.name);
            setSubject(t.subject);
            if (emailEditorRef.current?.editor) {
                if (t.designJson) {
                    // Load saved Unlayer design
                    emailEditorRef.current.editor.loadDesign(JSON.parse(t.designJson));
                } else if (t.htmlContent) {
                    // No designJson - load HTML as a custom HTML block
                    const fallbackDesign = {
                        body: {
                            rows: [{
                                cells: [1],
                                columns: [{
                                    contents: [{
                                        type: 'html',
                                        values: {
                                            html: t.htmlContent,
                                        }
                                    }]
                                }]
                            }],
                            values: {
                                backgroundColor: '#111827',
                                contentWidth: '600px',
                                fontFamily: { label: 'Arial', value: 'arial,helvetica,sans-serif' },
                            }
                        }
                    };
                    emailEditorRef.current.editor.loadDesign(fallbackDesign);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        if (!name || !subject) {
            alert('Nombre y Subject son obligatorios');
            return;
        }
        setSaving(true);

        emailEditorRef.current.editor.exportHtml(async (data: any) => {
            const { html, design } = data;
            try {
                const payload = {
                    name,
                    subject,
                    htmlContent: html,
                    designJson: JSON.stringify(design),
                };

                if (templateId) {
                    await api.put(`/admin/email/templates/${templateId}`, payload);
                } else {
                    await api.post('/admin/email/templates', payload);
                }
                onSaved();
            } catch (e) {
                console.error(e);
                alert('Error al guardar');
            } finally {
                setSaving(false);
            }
        });
    };

    const handleTestEmail = () => {
        if (!subject) {
            alert('Subject es obligatorio para enviar test');
            return;
        }
        setSending(true);

        emailEditorRef.current.editor.exportHtml(async (data: any) => {
            try {
                const res = await api.post('/admin/email/preview', {
                    subject: `[TEST] ${subject}`,
                    htmlContent: data.html,
                });
                if (res.data.success) {
                    alert('Email test enviado a support@decatron.net');
                } else {
                    alert(`Error: ${res.data.error}`);
                }
            } catch (e) {
                alert('Error al enviar test');
            } finally {
                setSending(false);
            }
        });
    };

    const onReady = () => {
        setReady(true);
    };

    return (
        <div className="space-y-4">
            {/* Top bar */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Nombre del template..."
                            className="w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/50 placeholder-[#94a3b8]"
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Subject del email..."
                            className="w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/50 placeholder-[#94a3b8]"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTestEmail}
                            disabled={sending}
                            className="flex items-center gap-2 px-4 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] rounded-lg text-sm font-semibold hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-all disabled:opacity-50"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Test
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-[#64748b]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Editor */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden" style={{ height: '75vh' }}>
                {loading && (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
                    </div>
                )}
                <EmailEditorComponent
                    ref={emailEditorRef}
                    onReady={onReady}
                    minHeight="75vh"
                    options={{
                        appearance: {
                            theme: 'modern_dark',
                        },
                        features: {
                            stockImages: {
                                enabled: true,
                            },
                        },
                        tools: {
                            image: { enabled: true },
                            button: { enabled: true },
                            text: { enabled: true },
                            heading: { enabled: true },
                            divider: { enabled: true },
                            html: { enabled: true },
                            social: { enabled: true },
                            video: { enabled: true },
                            menu: { enabled: true },
                            timer: { enabled: true },
                        },
                    }}
                />
            </div>
        </div>
    );
}
