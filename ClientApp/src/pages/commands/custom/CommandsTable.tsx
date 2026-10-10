import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Table } from '../../../components/ds';
import { ActiveBadge, RestrictionBadge, commandCode } from './badges';
import type { CustomCommand } from './types';

export default function CommandsTable({ commands, canDelete, onEdit, onDelete }: {
    commands: CustomCommand[]; canDelete: boolean; onEdit: (cmd: CustomCommand) => void; onDelete: (id: number, name: string) => void;
}) {
    const { t } = useTranslation('commands');
    return (
        <Table
            align={['left', 'left', 'left', 'left', 'left', 'right']}
            head={[
                t('customCommands.table.headers.command'),
                t('customCommands.table.headers.response'),
                t('customCommands.table.headers.restriction'),
                t('customCommands.table.headers.status'),
                t('customCommands.table.headers.createdBy'),
                t('customCommands.table.headers.actions'),
            ]}
            rows={commands.map((cmd) => [
                <code key="c" className={commandCode}>{cmd.commandName}</code>,
                <p key="r" className="text-ds-text truncate max-w-xs">{cmd.response}</p>,
                <RestrictionBadge key="s" restriction={cmd.restriction} />,
                <ActiveBadge key="a" isActive={cmd.isActive} />,
                <span key="u" className="text-ds-soft">{cmd.createdBy}</span>,
                <div key="x" className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" aria-label={t('customCommands.table.actions.edit')} title={t('customCommands.table.actions.edit')}
                        onClick={() => onEdit(cmd)}><Pencil /></Button>
                    {canDelete && (
                        <Button variant="ghost" size="sm" aria-label={t('customCommands.table.actions.delete')} title={t('customCommands.table.actions.delete')}
                            onClick={() => onDelete(cmd.id, cmd.commandName)}><Trash2 style={{ color: 'var(--ds-danger)' }} /></Button>
                    )}
                </div>,
            ])}
        />
    );
}
