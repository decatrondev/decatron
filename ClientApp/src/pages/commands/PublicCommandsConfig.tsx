import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Globe, Copy, Check, Zap, MessageSquare, Code, Terminal, EyeOff, Eye, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

type Category = 'default' | 'custom' | 'microcommands' | 'scripting';

interface PublicCommandItem {
    key: string; // categoria:identificador único
    category: Category;
    commandKey: string;
    name: string; // tal cual viene guardado, sin agregar ni quitar "!"
    description: string; // solo Default trae descripción real
    restriction?: string; // solo Custom trae restriction
    hidden: boolean;
    publicDescription: string;
}

const ITEMS_PER_PAGE = 8;

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode }> = {
    default: { label: 'Comandos por Defecto', icon: <Zap className="w-4 h-4" /> },
    custom: { label: 'Comandos Custom', icon: <Code className="w-4 h-4" /> },
    microcommands: { label: 'Microcommands', icon: <MessageSquare className="w-4 h-4" /> },
    scripting: { label: 'Scripting', icon: <Terminal className="w-4 h-4" /> },
};

export default function PublicCommandsConfig() {
    const navigate = useNavigate();
    const [items, setItems] = useState<PublicCommandItem[]>([]);
    const [channelLogin, setChannelLogin] = useState('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [pages, setPages] = useState<Record<Category, number>>({ default: 1, custom: 1, microcommands: 1, scripting: 1 });

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/publiccommands/config');
                if (res.data?.success) {
                    setChannelLogin(res.data.channel || '');
                    const merged: PublicCommandItem[] = (res.data.items || []).map((item: any) => ({
                        key: `${item.category}:${item.commandKey}`,
                        category: item.category,
                        commandKey: item.commandKey,
                        name: item.name,
                        description: item.description || '',
                        restriction: item.restriction || undefined,
                        hidden: item.hidden,
                        publicDescription: item.publicDescription || '',
                    }));
                    setItems(merged);
                }
            } catch (err) {
                console.error('Error cargando comandos para vista pública', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const grouped = useMemo(() => {
        const groups: Record<Category, PublicCommandItem[]> = {
            default: [], custom: [], microcommands: [], scripting: [],
        };
        for (const item of items) groups[item.category].push(item);
        return groups;
    }, [items]);

    const toggleHidden = (key: string) => {
        setItems(prev => prev.map(i => i.key === key ? { ...i, hidden: !i.hidden } : i));
    };

    const setPublicDescription = (key: string, value: string) => {
        setItems(prev => prev.map(i => i.key === key ? { ...i, publicDescription: value } : i));
    };

    const setPage = (category: Category, page: number) => {
        setPages(prev => ({ ...prev, [category]: page }));
    };

    const publicUrl = `twitch.decatron.net/commands/${channelLogin || '...'}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(`https://${publicUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = async () => {
        setSaving(true);
        setNotice(null);
        try {
            const payload = items.map(item => ({
                category: item.category,
                commandKey: item.commandKey,
                hidden: item.hidden,
                publicDescription: item.publicDescription || null,
            }));
            const res = await api.post('/publiccommands/config', payload);
            if (res.data?.success) {
                setNotice({ message: 'Guardado correctamente.', type: 'success' });
            } else {
                setNotice({ message: res.data?.message || 'Error guardando la configuración', type: 'error' });
            }
        } catch (err: any) {
            console.error('Error guardando config de vista pública', err);
            setNotice({ message: err?.response?.data?.message || 'Error guardando la configuración', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-[#64748b] dark:text-[#94a3b8]">Cargando comandos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {notice && (
                <div className={`p-3 rounded-lg text-sm border ${notice.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                    }`}>
                    {notice.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/commands')}
                        className="p-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#374151] transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Globe className="w-6 h-6 text-[#2563eb]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Vista Pública de Comandos</h1>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Elige qué comandos ve la gente en tu página pública
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                >
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>

            {/* Link público */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-4 border border-[#e2e8f0] dark:border-[#374151] shadow-lg flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">Tu link público</p>
                    <p className="text-sm font-mono text-[#2563eb]">{publicUrl}</p>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-2 bg-[#f1f5f9] dark:bg-[#262626] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] transition-colors"
                >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado' : 'Copiar link'}
                </button>
            </div>

            {/* Categorías */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {(Object.keys(CATEGORY_META) as Category[]).map(category => {
                    const meta = CATEGORY_META[category];
                    const list = grouped[category];
                    if (list.length === 0) return null;

                    const currentPage = pages[category];
                    const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
                    const start = (currentPage - 1) * ITEMS_PER_PAGE;
                    const pageItems = list.slice(start, start + ITEMS_PER_PAGE);

                    return (
                        <div key={category} className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151] shadow-lg flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[#2563eb]">{meta.icon}</span>
                                <h2 className="font-black text-sm text-[#1e293b] dark:text-[#f8fafc]">{meta.label}</h2>
                                <span className="text-xs text-[#94a3b8] font-semibold ml-1">({list.length})</span>
                            </div>

                            <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {pageItems.map(item => (
                                    <div key={item.key} className="py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`font-mono text-sm truncate ${item.hidden ? 'text-[#94a3b8]' : 'text-[#1e293b] dark:text-[#f8fafc] font-semibold'}`}>
                                                    {item.name}
                                                </span>
                                                {item.restriction && item.restriction !== 'all' && (
                                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-[#2563eb] rounded-full font-semibold">
                                                        {item.restriction}
                                                    </span>
                                                )}
                                                {!item.hidden && (
                                                    <button
                                                        onClick={() => setEditingKey(editingKey === item.key ? null : item.key)}
                                                        className="shrink-0 p-1 rounded hover:bg-[#f1f5f9] dark:hover:bg-[#374151] text-[#94a3b8] hover:text-[#2563eb] transition-colors"
                                                        title="Descripción pública"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => toggleHidden(item.key)}
                                                className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${item.hidden
                                                    ? 'bg-[#e2e8f0] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8]'
                                                    : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                                    }`}
                                            >
                                                {item.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                {item.hidden ? 'Oculto' : 'Visible'}
                                            </button>
                                        </div>

                                        {editingKey === item.key && !item.hidden && (
                                            <input
                                                type="text"
                                                autoFocus
                                                value={item.publicDescription}
                                                onChange={e => setPublicDescription(item.key, e.target.value)}
                                                onBlur={() => setEditingKey(null)}
                                                placeholder={item.description || 'Descripción pública (opcional)'}
                                                className="mt-1.5 w-full px-2 py-1.5 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-xs text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#e2e8f0] dark:border-[#374151]">
                                    <span className="text-xs text-[#94a3b8]">
                                        {start + 1}-{Math.min(start + ITEMS_PER_PAGE, list.length)} de {list.length}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setPage(category, Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1.5 rounded-md border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setPage(category, page)}
                                                className={`w-7 h-7 rounded-md text-xs font-bold transition-colors ${currentPage === page
                                                    ? 'bg-[#2563eb] text-white'
                                                    : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setPage(category, Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-1.5 rounded-md border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {items.length === 0 && (
                <div className="text-center py-12 text-[#64748b] dark:text-[#94a3b8]">
                    No tienes comandos activos todavía.
                </div>
            )}
        </div>
    );
}
