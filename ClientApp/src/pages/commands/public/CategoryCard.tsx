import { ChevronLeft, ChevronRight, EyeOff, Eye, Pencil } from 'lucide-react';
import { Badge, Button, Input } from '../../../components/ds';
import { CATEGORY_META, ITEMS_PER_PAGE, type Category, type PublicCommandItem } from './meta';

/** Tarjeta de una categoría de comandos: lista paginada con visible/oculto y descripción pública editable. */
export default function CategoryCard({ category, list, page, onPage, editingKey, onEditingKey, onToggleHidden, onDescription }: {
    category: Category;
    list: PublicCommandItem[];
    page: number;
    onPage: (page: number) => void;
    editingKey: string | null;
    onEditingKey: (key: string | null) => void;
    onToggleHidden: (key: string) => void;
    onDescription: (key: string, value: string) => void;
}) {
    const meta = CATEGORY_META[category];
    const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
    const start = (page - 1) * ITEMS_PER_PAGE;
    const pageItems = list.slice(start, start + ITEMS_PER_PAGE);

    return (
        <div className="bg-ds-surface rounded-lg p-5 border border-ds-border flex flex-col">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-ds-accent-text">{meta.icon}</span>
                <h2 className="font-black text-sm text-ds-text">{meta.label}</h2>
                <span className="text-xs text-ds-faint font-semibold ml-1">({list.length})</span>
            </div>

            <div className="divide-y divide-ds-border">
                {pageItems.map(item => (
                    <div key={item.key} className="py-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className={`font-mono text-sm truncate ${item.hidden ? 'text-ds-faint' : 'text-ds-text font-semibold'}`}>{item.name}</span>
                                {item.restriction && item.restriction !== 'all' && <Badge tone="accent">{item.restriction}</Badge>}
                                {!item.hidden && (
                                    <button
                                        onClick={() => onEditingKey(editingKey === item.key ? null : item.key)}
                                        className="shrink-0 p-1 rounded hover:bg-ds-raised text-ds-faint hover:text-ds-accent-text transition-colors"
                                        title="Descripción pública"
                                        aria-label="Descripción pública"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => onToggleHidden(item.key)}
                                className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all border ${
                                    item.hidden ? 'bg-ds-bg border-ds-border text-ds-soft' : 'bg-ds-ok/10 border-ds-ok/30 text-ds-ok'
                                }`}
                            >
                                {item.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {item.hidden ? 'Oculto' : 'Visible'}
                            </button>
                        </div>

                        {editingKey === item.key && !item.hidden && (
                            <Input
                                type="text"
                                autoFocus
                                value={item.publicDescription}
                                onChange={e => onDescription(item.key, e.target.value)}
                                onBlur={() => onEditingKey(null)}
                                placeholder={item.description || 'Descripción pública (opcional)'}
                                className="mt-1.5"
                            />
                        )}
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-ds-border">
                    <span className="text-xs text-ds-faint">{start + 1}-{Math.min(start + ITEMS_PER_PAGE, list.length)} de {list.length}</span>
                    <div className="flex items-center gap-1">
                        <Button variant="secondary" size="sm" aria-label="Anterior" icon={<ChevronLeft />} onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} />
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <Button key={p} size="sm" variant={page === p ? 'primary' : 'ghost'} onClick={() => onPage(p)}
                                aria-current={page === p ? 'page' : undefined} style={{ minWidth: 32, paddingLeft: 0, paddingRight: 0 }}>{p}</Button>
                        ))}
                        <Button variant="secondary" size="sm" aria-label="Siguiente" icon={<ChevronRight />} onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
                    </div>
                </div>
            )}
        </div>
    );
}
