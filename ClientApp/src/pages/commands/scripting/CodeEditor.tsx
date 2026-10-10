import { FileCode, Trash2, Wand2 } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import { Button } from '../../../components/ds';
import { hintCls } from '../../../components/dashboard/config';
import { highlightCode } from './grammar';
import { panelCls } from './CommandFields';
import type { ScriptEditor } from './types';

const SUGGESTION_COLOR: Record<string, string> = {
    keyword: 'text-ds-syntax-keyword',
    function: 'text-ds-syntax-keyword',
    variable: 'text-ds-syntax-string',
    snippet: 'text-ds-syntax-string',
};

/** Editor de código: números de línea, resaltado de sintaxis y menú de autocompletado. */
export default function CodeEditor({ ed }: { ed: ScriptEditor }) {
    const {
        t, scriptContent, currentLine, handleScriptChange, handleCursorChange, formatCode, clearEditor,
        showAutocomplete, autocompleteOptions, selectedSuggestionIndex, autocompletePosition, insertSuggestion,
    } = ed;
    const lines = scriptContent.split('\n');

    return (
        <div className={panelCls}>
            <div className="flex items-center justify-between mb-4 gap-3">
                <p className="text-sm font-bold text-ds-text flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-ds-accent-text" />
                    {t('scripting.editor.scriptCodeLabel')}
                </p>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-ds-soft">{t('scripting.editor.linesCount', { count: lines.length })}</span>
                    <Button variant="ghost" size="sm" aria-label={t('scripting.editor.formatTitle')} title={t('scripting.editor.formatTitle')} onClick={formatCode} icon={<Wand2 />} />
                    <Button variant="ghost" size="sm" aria-label={t('scripting.editor.clearTitle')} title={t('scripting.editor.clearTitle')} onClick={clearEditor} icon={<Trash2 />} />
                </div>
            </div>

            <div className="relative">
                <div className="ds-code flex border border-ds-border rounded-lg overflow-hidden bg-ds-input">
                    {/* Números de línea */}
                    <div className="select-none bg-ds-raised px-3 py-3 text-right text-xs text-ds-faint font-mono leading-relaxed border-r border-ds-border">
                        {lines.map((_, i) => (
                            <div
                                key={i}
                                className={`leading-[1.5rem] transition-colors ${
                                    currentLine === i + 1 ? 'bg-ds-accent/20 text-ds-accent-text font-bold -mx-3 px-3' : ''
                                }`}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                    {/* Código con resaltado */}
                    <div className="flex-1 min-w-0">
                        <Editor
                            value={scriptContent}
                            onValueChange={handleScriptChange}
                            highlight={highlightCode}
                            padding={12}
                            placeholder={t('scripting.editor.placeholder')}
                            style={{
                                fontFamily: 'var(--ds-font-mono)',
                                fontSize: 14,
                                minHeight: '480px',
                                backgroundColor: 'transparent',
                                outline: 'none',
                            }}
                            className="text-ds-text focus:outline-none"
                            textareaClassName="focus:outline-none"
                            onKeyUp={handleCursorChange}
                            onClick={handleCursorChange}
                            textareaId="code-editor"
                        />
                    </div>
                </div>

                {/* Autocompletado */}
                {showAutocomplete && autocompleteOptions.length > 0 && (
                    <div
                        className="absolute z-50 bg-ds-raised border border-ds-border rounded-lg shadow-xl overflow-hidden max-w-md"
                        style={{
                            top: `${autocompletePosition.top}px`,
                            left: `${autocompletePosition.left}px`,
                            minWidth: '300px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                        }}
                    >
                        {autocompleteOptions.map((suggestion, idx) => (
                            <button
                                key={idx}
                                onClick={() => insertSuggestion(suggestion)}
                                className={`w-full text-left px-3 py-2 hover:bg-ds-accent/10 transition-colors ${idx === selectedSuggestionIndex ? 'bg-ds-accent/15' : ''}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <code className={`font-mono text-sm font-bold ${SUGGESTION_COLOR[suggestion.type]}`}>{suggestion.displayText}</code>
                                    <span className="text-xs text-ds-soft">{suggestion.description}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <p className={`${hintCls} mt-2`}>{t('scripting.editor.editorHint')}</p>
        </div>
    );
}
