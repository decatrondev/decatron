import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input } from '../../../components/ds';
import { hintCls, labelCls } from '../../../components/dashboard/config';

/** Lista de usuarios (protegidos / bloqueados): se agregan con Enter o el botón y se quitan con la X. */
export default function UserListEditor({ title, hint, values, placeholder, onAdd, onRemove }: {
    title: string;
    hint: string;
    values: string[];
    placeholder: string;
    onAdd: (username: string) => void;
    onRemove: (username: string) => void;
}) {
    const [draft, setDraft] = useState('');
    const submit = () => {
        const clean = draft.trim().replace(/^@/, '');
        if (clean) onAdd(clean);
        setDraft('');
    };
    return (
        <div>
            <label className={labelCls}>{title}</label>
            <p className={`${hintCls} mb-2`}>{hint}</p>
            <div className="flex gap-2">
                <Input
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                    placeholder={placeholder}
                    className="flex-1"
                />
                <Button variant="secondary" aria-label="Agregar usuario" onClick={submit} icon={<Plus />} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
                {values.map(u => (
                    <span key={u} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-ds-bg border border-ds-border rounded-full text-xs font-mono text-ds-text">
                        @{u}
                        <button onClick={() => onRemove(u)} aria-label={`Quitar @${u}`} className="p-0.5 text-ds-faint hover:text-ds-danger">
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                {values.length === 0 && <p className={hintCls}>Sin usuarios en la lista</p>}
            </div>
        </div>
    );
}
