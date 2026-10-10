import { ArrowLeft, Code, Redo2, Save, Undo2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Button } from '../../components/ds';
import ModalShell from '../../components/dashboard/ModalShell';
import PageHeader from '../../components/dashboard/PageHeader';
import { LoadingText } from '../../components/dashboard/Notices';
import { ToastHost } from '../../components/dashboard/toast';
import CodeEditor from './scripting/CodeEditor';
import CommandFields from './scripting/CommandFields';
import ExamplesList from './scripting/ExamplesList';
import { TestConsole, ValidationPanel } from './scripting/ResultPanels';
import SideColumn from './scripting/SideColumn';
import { useScriptEditor } from './scripting/useScriptEditor';

/** Crear o editar un script de comando. Las piezas viven en ./scripting; la lógica, en useScriptEditor. */
export default function ScriptingEditor() {
    const ed = useScriptEditor();
    const {
        t, navigate, isEditMode, toast, permissionsLoading, loading, hasMinimumLevel,
        saving, validating, scriptContent, history, historyIndex,
        undo, redo, validateScript, handleSave, confirmClear, setConfirmClear, confirmClearEditor,
    } = ed;

    if (permissionsLoading || loading) {
        return <LoadingText>{t('scripting.editor.loadingTitle')}</LoadingText>;
    }

    if (!hasMinimumLevel('commands')) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="panel-scale max-w-[1800px] mx-auto space-y-6">
            <ToastHost toast={toast} />

            <PageHeader
                title={
                    <span className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" aria-label={t('scripting.editor.backButton')} title={t('scripting.editor.backButton')} onClick={() => navigate('/commands/scripting')} icon={<ArrowLeft />} />
                        {isEditMode ? t('scripting.editor.titleEdit') : t('scripting.editor.titleCreate')}
                    </span>
                }
                subtitle={t('scripting.header.subtitle')}
                actions={
                    <>
                        <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} aria-label={t('scripting.editor.undoButton')} title={`${t('scripting.editor.undoButton')} (Ctrl+Z)`} icon={<Undo2 />} />
                        <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} aria-label={t('scripting.editor.redoButton')} title={`${t('scripting.editor.redoButton')} (Ctrl+Y)`} icon={<Redo2 />} />
                        <Button variant="secondary" onClick={validateScript} loading={validating} disabled={validating || !scriptContent.trim()} icon={<Code />}>
                            {validating ? t('scripting.editor.saving') : t('scripting.editor.validateButton')}
                        </Button>
                        <Button onClick={handleSave} loading={saving} disabled={saving} icon={<Save />}>
                            {saving ? t('scripting.editor.saving') : isEditMode ? t('scripting.editor.saveButton') : t('scripting.editor.createButton')}
                        </Button>
                    </>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6 min-w-0">
                    <CommandFields ed={ed} />
                    <CodeEditor ed={ed} />
                    <ValidationPanel ed={ed} />
                    <TestConsole ed={ed} />
                    <ExamplesList ed={ed} />
                </div>
                <div className="lg:col-span-1 space-y-6 min-w-0">
                    <SideColumn ed={ed} />
                </div>
            </div>

            {confirmClear && (
                <ModalShell
                    title={t('scripting.editor.clearTitle')}
                    onClose={() => setConfirmClear(false)}
                    actions={
                        <>
                            <Button variant="secondary" onClick={() => setConfirmClear(false)}>{t('scripting.editor.cancelButton')}</Button>
                            <Button variant="danger" onClick={confirmClearEditor}>{t('scripting.editor.clearButton')}</Button>
                        </>
                    }
                >
                    {t('scripting.editor.clearConfirm')}
                </ModalShell>
            )}
        </div>
    );
}
