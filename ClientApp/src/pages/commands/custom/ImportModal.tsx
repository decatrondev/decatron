import { useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { Badge, Button } from '../../../components/ds';
import ModalShell from '../../../components/dashboard/ModalShell';
import { commandCode } from './badges';
import type { CustomCommand, ShowToast } from './types';

/** Importar comandos desde un archivo JSON: arrastrar o elegir, vista previa con válidos / duplicados / inválidos, e importar. */
export default function ImportModal({ commands, onClose, onImported, showToast }: {
    commands: CustomCommand[]; onClose: () => void; onImported: () => Promise<void> | void; showToast: ShowToast;
}) {
    const { t } = useTranslation('commands');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[] | null>(null);

    const exists = (name?: string) => !!name && commands.some(c => c.commandName.toLowerCase() === name.toLowerCase());

    const loadPreview = async (f: File) => {
        try {
            const parsed = JSON.parse(await f.text());
            if (!Array.isArray(parsed)) {
                showToast(t('customCommands.messages.importInvalidFile'), 'error');
                setPreview(null);
                return;
            }
            setPreview(parsed);
        } catch {
            showToast(t('customCommands.messages.importInvalidFile'), 'error');
            setPreview(null);
        }
    };

    const accept = async (f: File | undefined) => {
        if (!f) return;
        if (!f.name.endsWith('.json')) {
            showToast(t('customCommands.messages.importInvalidFile'), 'error');
            return;
        }
        setFile(f);
        await loadPreview(f);
    };

    const doImport = async () => {
        if (!file) {
            showToast(t('customCommands.messages.importInvalidFile'), 'error');
            return;
        }
        try {
            const imported = JSON.parse(await file.text());
            if (!Array.isArray(imported)) {
                showToast(t('customCommands.messages.importInvalidFile'), 'error');
                return;
            }

            let successCount = 0;
            let errorCount = 0;
            const errors: string[] = [];

            for (const cmd of imported) {
                if (!cmd.commandName || !cmd.response) {
                    errorCount++;
                    errors.push(`Comando sin nombre o respuesta`);
                    continue;
                }
                // Validar si el comando ya existe
                if (exists(cmd.commandName)) {
                    errorCount++;
                    errors.push(`"${cmd.commandName}" ya existe en el sistema`);
                    continue;
                }
                try {
                    await api.post('/customcommands', {
                        commandName: cmd.commandName,
                        response: cmd.response,
                        restriction: cmd.restriction || 'all',
                        isActive: cmd.isActive !== undefined ? cmd.isActive : true,
                    });
                    successCount++;
                } catch (err: any) {
                    errorCount++;
                    errors.push(`${cmd.commandName}: ${err.response?.data?.message || 'Error desconocido'}`);
                }
            }

            if (successCount > 0) await onImported();

            if (errorCount === 0) {
                showToast(t('customCommands.messages.importSuccess', { count: successCount }), 'success');
            } else {
                showToast(t('customCommands.messages.importError'), 'error');
                console.error('Errores de importación:', errors);
            }
            onClose();
        } catch (err) {
            showToast(t('customCommands.messages.importInvalidFile'), 'error');
            console.error('Import error:', err);
        }
    };

    const invalidCount = preview?.filter(c => !c.commandName || !c.response).length ?? 0;
    const duplicateCount = preview?.filter(c => c.commandName && exists(c.commandName)).length ?? 0;
    const readyCount = preview?.filter(c => c.commandName && c.response && !exists(c.commandName)).length ?? 0;

    return (
        <ModalShell
            title={t('customCommands.importModal.title')}
            size="lg"
            onClose={onClose}
            actions={<>
                <Button variant="secondary" onClick={onClose}>{t('customCommands.importModal.cancelButton')}</Button>
                <Button icon={<Upload />} onClick={doImport} disabled={!file}>
                    {t('customCommands.importModal.importButton', { count: preview?.length || 0 })}
                </Button>
            </>}
        >
            <div className="space-y-4 mt-4">
                <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={async (e) => { e.preventDefault(); e.stopPropagation(); await accept(e.dataTransfer.files[0]); }}
                    className="border-2 border-dashed border-ds-border hover:border-ds-accent rounded-lg p-8 text-center transition-colors"
                >
                    <Upload className="w-12 h-12 text-ds-soft mx-auto mb-4" />
                    <input type="file" accept=".json" onChange={(e) => accept(e.target.files?.[0])} className="hidden" id="import-file" />
                    <label htmlFor="import-file" className="ds-btn ds-btn--primary ds-btn--lg cursor-pointer">
                        {t('customCommands.importModal.dropzoneText')}
                    </label>
                    {file && (
                        <p className="mt-4 text-sm text-ds-text font-semibold">
                            {t('customCommands.importModal.fileSelected')} {file.name}
                        </p>
                    )}
                </div>

                <div className="bg-ds-raised border border-ds-border rounded-lg p-4">
                    <h4 className="text-sm font-bold text-ds-text mb-2">📋 Formato del archivo JSON:</h4>
                    <pre className="text-xs bg-ds-bg p-3 rounded border border-ds-border overflow-x-auto text-ds-text font-mono">
{`[
  {
    "commandName": "nombre",
    "response": "Respuesta del comando",
    "restriction": "all",
    "isActive": true
  }
]`}
                    </pre>
                    <p className="text-xs text-ds-soft mt-2">
                        <strong>restriction:</strong> "all", "sub", "vip", "mod" | <strong>isActive:</strong> true/false
                    </p>
                </div>

                {preview && preview.length > 0 && (
                    <div className="bg-ds-raised border border-ds-border rounded-lg p-4">
                        <h4 className="text-sm font-bold text-ds-text mb-3">
                            {t('customCommands.importModal.previewTitle')} ({preview.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {preview.map((cmd, idx) => {
                                const isDuplicate = exists(cmd.commandName);
                                const isInvalid = !cmd.commandName || !cmd.response;
                                return (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg border ${
                                            isInvalid ? 'border-ds-danger/40 bg-ds-danger/5'
                                                : isDuplicate ? 'border-ds-warn/40 bg-ds-warn/5'
                                                    : 'border-ds-border bg-ds-surface'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <code className="px-2 py-0.5 bg-ds-bg border border-ds-border rounded font-mono text-xs font-bold text-ds-accent-text truncate">
                                                        {cmd.commandName || '(sin nombre)'}
                                                    </code>
                                                    <Badge tone={cmd.restriction && cmd.restriction !== 'all' ? 'accent' : undefined}>{cmd.restriction || 'all'}</Badge>
                                                </div>
                                                <p className="text-xs text-ds-soft truncate">{cmd.response || '(sin respuesta)'}</p>
                                            </div>
                                            {isInvalid && <span className="text-xs font-bold text-ds-danger whitespace-nowrap">{t('customCommands.importModal.commandStatus.invalid')}</span>}
                                            {!isInvalid && isDuplicate && <span className="text-xs font-bold text-ds-warn whitespace-nowrap">{t('customCommands.importModal.commandStatus.duplicate')}</span>}
                                            {!isInvalid && !isDuplicate && <span className="text-xs font-bold text-ds-ok whitespace-nowrap">{t('customCommands.importModal.commandStatus.valid')}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-xs text-ds-soft mt-3">
                            {invalidCount > 0 && (
                                <span className="block mb-1">❌ <strong>{invalidCount}</strong> comando(s) inválido(s)</span>
                            )}
                            {duplicateCount > 0 && (
                                <span className="block mb-1">⚠️ <strong>{duplicateCount}</strong> comando(s) duplicado(s) (se omitirán)</span>
                            )}
                            ✓ <strong>{readyCount}</strong> comando(s) listo(s) para importar
                        </p>
                    </div>
                )}
            </div>
        </ModalShell>
    );
}
