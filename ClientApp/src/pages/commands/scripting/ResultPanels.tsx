import { AlertCircle, Eye, Play, Terminal } from 'lucide-react';
import { Alert, Button } from '../../../components/ds';
import { panelCls } from './CommandFields';
import type { ScriptEditor } from './types';

/** Resultado de validar: verde si el script es válido, rojo con el mensaje y la línea si no. */
export function ValidationPanel({ ed }: { ed: ScriptEditor }) {
    const { t, validationResult: v } = ed;
    if (!v) return null;
    return (
        <Alert tone={v.isValid ? 'ok' : 'danger'} title={v.isValid ? t('scripting.editor.validationValid') : t('scripting.editor.validationError')}>
            {!v.isValid && (
                <>
                    {v.errorMessage}
                    {v.errorLine ? <span className="block text-xs mt-1 font-mono">{t('scripting.editor.errorLine', { line: v.errorLine })}</span> : null}
                </>
            )}
        </Alert>
    );
}

/** Consola de pruebas: ejecuta el script con datos de prueba y muestra la salida. */
export function TestConsole({ ed }: { ed: ScriptEditor }) {
    const { t, previewResult: p, testing, scriptContent, testScript } = ed;
    return (
        <div className={panelCls}>
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-black text-ds-text flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-ds-accent-text" />
                    {t('scripting.editor.testResultTitle')}
                </h3>
                <Button onClick={testScript} loading={testing} disabled={testing || !scriptContent.trim()} icon={<Play />}>
                    {testing ? t('scripting.editor.saving') : t('scripting.editor.testButton')}
                </Button>
            </div>

            {p ? (
                <div className={`p-4 rounded-lg font-mono text-sm bg-ds-input border border-ds-border ${p.success ? 'text-ds-text' : 'text-ds-danger'}`}>
                    <div className="flex items-start gap-2">
                        {p.success ? <Eye className="w-4 h-4 mt-0.5 flex-shrink-0 text-ds-ok" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1 whitespace-pre-wrap break-words">{p.output}</div>
                    </div>
                    {p.errorLine ? <p className="text-xs mt-2 opacity-80">{t('scripting.editor.errorOnLine', { line: p.errorLine })}</p> : null}
                </div>
            ) : (
                <div className="p-4 rounded-lg bg-ds-input border border-ds-border text-ds-soft text-sm">
                    <p>{t('scripting.editor.testIdle', { button: t('scripting.editor.testButton') })}</p>
                    <p className="text-xs mt-2">{t('scripting.editor.testIdleNote')}</p>
                </div>
            )}
        </div>
    );
}
