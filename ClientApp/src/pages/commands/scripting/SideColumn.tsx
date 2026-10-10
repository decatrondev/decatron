import { BarChart3, BookOpen, ChevronDown, ChevronRight, Copy, Dices, GitBranch, Lightbulb, Target, Zap, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { highlightCode } from './grammar';
import { FUNCTIONS, SYNTAX_DOCS, VARIABLES } from './data';
import { panelCls } from './CommandFields';
import type { ScriptEditor } from './types';

const TEMPLATE_BUTTONS: { id: string; icon: LucideIcon }[] = [
    { id: 'dice', icon: Dices },
    { id: 'pick', icon: Target },
    { id: 'counter', icon: BarChart3 },
    { id: 'conditional', icon: GitBranch },
];

const SHORTCUTS: { key: string; label: (t: ScriptEditor['t']) => string; combo: string }[] = [
    { key: 'undo', label: t => t('scripting.editor.undoButton'), combo: 'Ctrl+Z' },
    { key: 'redo', label: t => t('scripting.editor.redoButton'), combo: 'Ctrl+Y' },
    { key: 'indent', label: t => t('scripting.editor.shortcutIndent'), combo: 'Tab' },
    { key: 'save', label: t => t('scripting.editor.saveButton'), combo: 'Ctrl+S' },
];

const itemCls = 'w-full p-3 bg-ds-bg hover:bg-ds-raised border border-ds-border hover:border-ds-accent rounded-lg transition-all text-left group';

/** Columna de ayuda: plantillas, variables, funciones, documentación, atajos y consejos. */
export default function SideColumn({ ed }: { ed: ScriptEditor }) {
    const { t, insertTemplate, insertText } = ed;
    const [showDocs, setShowDocs] = useState(true);
    const DocsChevron = showDocs ? ChevronDown : ChevronRight;

    return (
        <>
            <div className={panelCls}>
                <h3 className="text-lg font-black text-ds-text mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-ds-accent-text" />{t('scripting.editor.templatesTitle')}</h3>
                <div className="grid grid-cols-2 gap-3">
                    {TEMPLATE_BUTTONS.map(({ id, icon: Icon }) => (
                        <button key={id} onClick={() => insertTemplate(id)} className={`${itemCls} flex items-center gap-2`}>
                            <Icon className="w-5 h-5 text-ds-accent-text flex-shrink-0" />
                            <span className="font-bold text-sm text-ds-text">{t(`scripting.editor.templates.${id}`)}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className={panelCls}>
                <h3 className="text-lg font-black text-ds-text mb-4">{t('scripting.editor.exampleVariables')}</h3>
                <div className="space-y-2">
                    {VARIABLES.map(name => (
                        <button key={name} onClick={() => insertText(`$(${name})`)} className={`${itemCls} flex items-center justify-between`}>
                            <div>
                                <code className="text-sm font-bold text-ds-syntax-string">{`$(${name})`}</code>
                                <p className="text-xs text-ds-soft mt-1">{t(`scripting.editor.variables.${name}`)}</p>
                            </div>
                            <Copy className="w-4 h-4 text-ds-soft opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}
                </div>
            </div>

            <div className={panelCls}>
                <h3 className="text-lg font-black text-ds-text mb-4">{t('scripting.editor.functionsTitle')}</h3>
                <div className="space-y-3">
                    {FUNCTIONS.map(fn => (
                        <button key={fn.id} onClick={() => insertText(fn.example)} className={itemCls}>
                            <div className="flex items-start justify-between">
                                <code className="text-sm font-bold text-ds-syntax-keyword">{fn.name}</code>
                                <Copy className="w-4 h-4 text-ds-soft opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-xs text-ds-soft mt-1">{t(`scripting.editor.functions.${fn.id}`)}</p>
                            <code className="ds-code block text-xs mt-2 bg-ds-input px-2 py-1 rounded" dangerouslySetInnerHTML={{ __html: highlightCode(fn.example) }} />
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                <button onClick={() => setShowDocs(!showDocs)} aria-expanded={showDocs} className="w-full flex items-center justify-between p-4 hover:bg-ds-raised transition-colors">
                    <span className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-ds-accent-text" />
                        <span className="text-lg font-black text-ds-text">{t('scripting.editor.docsTitle')}</span>
                    </span>
                    <DocsChevron className="w-5 h-5 text-ds-soft" />
                </button>
                {showDocs && (
                    <div className="p-4 space-y-4 border-t border-ds-border">
                        {SYNTAX_DOCS.map(doc => (
                            <div key={doc.id}>
                                <p className="font-bold text-sm mb-2 text-ds-accent-text">{t(`scripting.editor.syntaxDocs.${doc.id}.title`)}:</p>
                                <pre className="ds-code block bg-ds-input p-3 rounded font-mono text-xs whitespace-pre border border-ds-border text-ds-text overflow-x-auto" dangerouslySetInnerHTML={{ __html: highlightCode(doc.code) }} />
                                <p className="text-xs text-ds-soft mt-1">{t(`scripting.editor.syntaxDocs.${doc.id}.description`)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className={panelCls}>
                <h3 className="text-lg font-black text-ds-text mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-ds-accent-text" />{t('scripting.editor.shortcutsTitle')}</h3>
                <div className="space-y-2">
                    {SHORTCUTS.map(s => (
                        <div key={s.key} className="flex items-center justify-between p-2 bg-ds-bg rounded-lg">
                            <span className="text-sm text-ds-soft">{s.label(t)}</span>
                            <kbd className="px-2 py-1 text-xs font-mono bg-ds-input border border-ds-border rounded text-ds-text">{s.combo}</kbd>
                        </div>
                    ))}
                </div>
            </div>

            <div className={panelCls}>
                <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-ds-accent-text flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-ds-text font-bold text-sm mb-3">{t('scripting.editor.tipsTitle')}</p>
                        <ul className="text-ds-soft text-xs space-y-2">
                            {[1, 2, 3, 4, 5].map(n => (
                                <li key={n} className="flex items-start gap-2">
                                    <span className="text-ds-accent-text mt-0.5">•</span>
                                    <span>{t(`scripting.editor.tips.${n}`)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );
}
