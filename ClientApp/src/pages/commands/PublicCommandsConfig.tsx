import { useState, useEffect, useMemo } from 'react';
import { Globe, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Alert, Button } from '../../components/ds';
import { LoadingText } from '../../components/dashboard/Notices';
import { ConfigHeader, labelCls } from '../../components/dashboard/config';
import CategoryCard from './public/CategoryCard';
import { CATEGORY_META, type Category, type PublicCommandItem } from './public/meta';

export default function PublicCommandsConfig() {
    const navigate = useNavigate();
    const [items, setItems] = useState<PublicCommandItem[]>([]);
    const [channelLogin, setChannelLogin] = useState('');
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [pages, setPages] = useState<Record<Category, number>>({ default: 1, custom: 1, microcommands: 1, scripting: 1, songrequest: 1 });

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
            default: [], custom: [], microcommands: [], scripting: [], songrequest: [],
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

    const publicUrl = `${window.location.host}/commands/${channelLogin || '...'}`;

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
        return <div className="flex items-center justify-center h-64"><LoadingText>Cargando comandos...</LoadingText></div>;
    }

    return (
        <div className="panel-scale space-y-6">
            {notice && <Alert tone={notice.type === 'success' ? 'ok' : 'danger'}>{notice.message}</Alert>}

            <ConfigHeader
                onBack={() => navigate('/commands')}
                icon={<Globe />}
                title="Vista Pública de Comandos"
                subtitle="Elige qué comandos ve la gente en tu página pública"
                actions={<Button onClick={handleSave} loading={saving} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>}
            />

            {/* Link público */}
            <div className="bg-ds-surface rounded-lg p-4 border border-ds-border flex items-center justify-between flex-wrap gap-3">
                <div>
                    <p className={labelCls}>Tu link público</p>
                    <p className="text-sm font-mono text-ds-accent-text">{publicUrl}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleCopy}
                    icon={copied ? <Check style={{ color: 'var(--ds-ok)' }} /> : <Copy />}>
                    {copied ? 'Copiado' : 'Copiar link'}
                </Button>
            </div>

            {/* Categorías */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {(Object.keys(CATEGORY_META) as Category[]).map(category => {
                    const list = grouped[category];
                    if (list.length === 0) return null;
                    return (
                        <CategoryCard
                            key={category}
                            category={category}
                            list={list}
                            page={pages[category]}
                            onPage={page => setPage(category, page)}
                            editingKey={editingKey}
                            onEditingKey={setEditingKey}
                            onToggleHidden={toggleHidden}
                            onDescription={setPublicDescription}
                        />
                    );
                })}
            </div>

            {items.length === 0 && (
                <div className="text-center py-12 text-ds-soft">
                    No tienes comandos activos todavía.
                </div>
            )}
        </div>
    );
}
