import { useState } from 'react';
import { Download, CheckSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ds';
import ModalShell from '../../../components/dashboard/ModalShell';
import { ActiveBadge, RestrictionBadge, commandCode } from './badges';
import type { CustomCommand, ShowToast } from './types';

/** Exportar comandos a un archivo JSON: se eligen cuáles y se descarga. Arranca con todos marcados. */
export default function ExportModal({ commands, onClose, showToast }: { commands: CustomCommand[]; onClose: () => void; showToast: ShowToast }) {
    const { t } = useTranslation('commands');
    const [selected, setSelected] = useState<number[]>(commands.map(c => c.id));

    const toggle = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleAll = () => setSelected(selected.length === commands.length ? [] : commands.map(c => c.id));

    const download = () => {
        const toExport = commands.filter(c => selected.includes(c.id));
        if (toExport.length === 0) {
            showToast(t('customCommands.messages.exportError'), 'error');
            return;
        }
        const data = toExport.map(c => ({ commandName: c.commandName, response: c.response, restriction: c.restriction, isActive: c.isActive }));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `custom-commands-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(t('customCommands.messages.exportSuccess'), 'success');
        onClose();
    };

    return (
        <ModalShell
            title={t('customCommands.exportModal.title')}
            size="xl"
            onClose={onClose}
            actions={<>
                <Button variant="secondary" onClick={onClose}>{t('customCommands.exportModal.cancelButton')}</Button>
                <Button icon={<Download />} onClick={download} disabled={selected.length === 0}>
                    {t('customCommands.exportModal.exportButton')} ({selected.length})
                </Button>
            </>}
        >
            <p className="text-sm text-ds-soft mt-1">{t('customCommands.exportModal.message')}</p>

            <div className="my-4 flex items-center justify-between p-3 bg-ds-bg border border-ds-border rounded-lg">
                <button onClick={toggleAll} className="flex items-center gap-2 text-sm font-bold text-ds-accent-text hover:underline">
                    {selected.length === commands.length
                        ? <><CheckSquare className="w-4 h-4" />{t('customCommands.table.deselectAll')}</>
                        : <><Square className="w-4 h-4" />{t('customCommands.table.selectAll')}</>}
                </button>
                <span className="text-sm text-ds-soft">
                    {t('customCommands.exportModal.selectedCount', { count: selected.length })} {commands.length}
                </span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
                {commands.map((cmd) => {
                    const on = selected.includes(cmd.id);
                    return (
                        <div
                            key={cmd.id}
                            onClick={() => toggle(cmd.id)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${on ? 'border-ds-accent bg-ds-raised' : 'border-ds-border hover:border-ds-accent'}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="pt-1">
                                    {on ? <CheckSquare className="w-5 h-5 text-ds-accent-text" /> : <Square className="w-5 h-5 text-ds-soft" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <code className={commandCode}>{cmd.commandName}</code>
                                        <RestrictionBadge restriction={cmd.restriction} />
                                        <ActiveBadge isActive={cmd.isActive} />
                                    </div>
                                    <p className="text-sm text-ds-soft truncate">{cmd.response}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ModalShell>
    );
}
