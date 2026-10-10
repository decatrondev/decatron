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
            <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Nombre del template..."
                            className="w-full px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:outline-none focus:ring-2 focus:ring-ds-accent/50 placeholder-ds-soft"
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Subject del email..."
                            className="w-full px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:outline-none focus:ring-2 focus:ring-ds-accent/50 placeholder-ds-soft"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTestEmail}
                            disabled={sending}
                            className="flex items-center gap-2 px-4 py-2 bg-ds-bg border border-ds-border text-ds-text rounded-lg text-sm font-semibold hover:bg-ds-raised transition-all disabled:opacity-50"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Test
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg transition-all font-semibold text-sm disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-ds-raised rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-ds-soft" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Editor */}
            <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden" style={{ height: '75vh' }}>
                {loading && (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
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
