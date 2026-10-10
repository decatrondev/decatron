import { ChevronDown, ChevronRight, Copy, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Segmented } from '../../../components/ds';
import { highlightCode } from './grammar';
import { EXAMPLES } from './data';
import type { ExampleCategory, ScriptEditor } from './types';

/** Lista plegable de ejemplos con filtro por categoría; «Insertar» carga el código en el editor. */
export default function ExamplesList({ ed }: { ed: ScriptEditor }) {
    const { t, selectedCategory, setSelectedCategory, loadExample } = ed;
    const [open, setOpen] = useState(true);
    const shown = EXAMPLES.filter(ex => selectedCategory === 'all' || ex.category === selectedCategory);
    const catLabel = (c: ExampleCategory) => c === 'basic' ? t('scripting.editor.exampleBasic') : c === 'intermediate' ? t('scripting.editor.exampleConditionals') : t('scripting.editor.exampleComplete');
    const Chevron = open ? ChevronDown : ChevronRight;

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
            <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between p-4 hover:bg-ds-raised transition-colors">
                <span className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-ds-accent-text" />
                    <span className="text-lg font-black text-ds-text">{t('scripting.editor.examplesTitle')}</span>
                </span>
                <Chevron className="w-5 h-5 text-ds-soft" />
            </button>
            {open && (
                <div className="border-t border-ds-border">
                    <div className="p-4 border-b border-ds-border overflow-x-auto">
                        <Segmented
                            value={selectedCategory}
                            onChange={id => setSelectedCategory(id as ExampleCategory | 'all')}
                            items={[
                                { id: 'all', label: t('customCommands.restrictions.all') },
                                { id: 'basic', label: catLabel('basic') },
                                { id: 'intermediate', label: catLabel('intermediate') },
                                { id: 'advanced', label: catLabel('advanced') },
                            ]}
                        />
                    </div>
                    <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                        {shown.map(example => (
                            <div key={example.id} className="p-4 bg-ds-bg border border-ds-border rounded-lg">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <example.icon className="w-4 h-4 text-ds-accent-text" />
                                        <p className="font-bold text-sm text-ds-text">{t(`scripting.editor.examples.${example.id}.title`)}</p>
                                    </div>
                                    <Badge>{catLabel(example.category)}</Badge>
                                </div>
                                <p className="text-xs text-ds-soft mb-3">{t(`scripting.editor.examples.${example.id}.description`)}</p>
                                <pre
                                    className="ds-code block bg-ds-input p-3 rounded font-mono text-xs whitespace-pre-wrap border border-ds-border mb-3 text-ds-text"
                                    dangerouslySetInnerHTML={{ __html: highlightCode(example.code) }}
                                />
                                <Button size="sm" block icon={<Copy />} onClick={() => loadExample(example)}>{t('scripting.editor.insertButton')}</Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
