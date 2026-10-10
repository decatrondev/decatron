import { Plus, X } from 'lucide-react';
import { Button } from '../../../components/ds';
import { MessageTextarea, PreviewBox, hintCls, labelCls } from '../../../components/dashboard/config';
import { buildPreview, type RuletaSettings } from './config';

/** Lista de variantes de un mensaje (el bot elige una al azar): editar, agregar, quitar y vista previa de la primera. */
export default function VariantList({ title, hint, values, disabled, onChange, onAdd, onRemove, config }: {
    title: string;
    hint?: string;
    values: string[];
    disabled?: boolean;
    onChange: (index: number, value: string) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
    config: RuletaSettings;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>{title}</label>
                <Button variant="ghost" size="sm" onClick={onAdd} disabled={disabled} icon={<Plus />}>Variante</Button>
            </div>
            {hint && <p className={`${hintCls} mb-2`}>{hint}</p>}
            <div className="space-y-2">
                {values.map((v, i) => (
                    <div key={i} className="flex gap-2 items-start">
                        <MessageTextarea rows={2} value={v} onChange={e => onChange(i, e.target.value)} disabled={disabled} className="flex-1" />
                        <Button variant="ghost" size="sm" aria-label="Quitar variante" onClick={() => onRemove(i)} disabled={disabled || values.length <= 1} icon={<X />} />
                    </div>
                ))}
            </div>
            {values[0] && (
                <PreviewBox label={`Vista previa ${values.length > 1 ? '(1ra variante)' : ''}:`}>{buildPreview(values[0], config)}</PreviewBox>
            )}
        </div>
    );
}
