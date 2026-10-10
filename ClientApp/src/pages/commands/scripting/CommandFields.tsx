import { Gem, Shield, Star, Users, type LucideIcon } from 'lucide-react';
import { Field, Input, Switch } from '../../../components/ds';
import { hintCls, labelCls } from '../../../components/dashboard/config';
import type { ScriptEditor } from './types';

export const panelCls = 'bg-ds-surface rounded-lg p-6 border border-ds-border';

const RESTRICTIONS: { id: string; icon: LucideIcon; label: string; plus: boolean }[] = [
    { id: 'all', icon: Users, label: 'all', plus: false },
    { id: 'sub', icon: Star, label: 'sub', plus: true },
    { id: 'vip', icon: Gem, label: 'vip', plus: true },
    { id: 'mod', icon: Shield, label: 'mod', plus: false },
];

/** Nombre del comando, quién puede usarlo y si está activo. */
export default function CommandFields({ ed }: { ed: ScriptEditor }) {
    const { t, isEditMode, commandName, setCommandName, restriction, setRestriction, isActive, setIsActive } = ed;
    const r = (k: string) => t(`customCommands.restrictions.${k}`);
    const sub = (id: string) => id === 'sub' ? `${r('sub')}, VIPs, ${r('mod')}` : id === 'vip' ? `${r('vip')} / ${r('mod')}` : r(id);

    return (
        <>
            <div className={panelCls}>
                <Field label={t('scripting.editor.commandNameLabel')} hint={isEditMode ? t('customCommands.editModal.commandHelper') : t('scripting.editor.commandNameHelper')}>
                    <Input
                        value={commandName}
                        onChange={e => setCommandName(e.target.value)}
                        disabled={isEditMode}
                        placeholder={t('scripting.editor.commandNamePlaceholder')}
                        className="font-mono"
                    />
                </Field>
            </div>

            <div className={panelCls}>
                <p className={`${labelCls} mb-3`}>{t('customCommands.createModal.restrictionLabel')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {RESTRICTIONS.map(({ id, icon: Icon, plus }) => (
                        <button
                            key={id}
                            type="button"
                            aria-pressed={restriction === id}
                            onClick={() => setRestriction(id)}
                            className={`p-4 rounded-lg border text-left transition-all ${
                                restriction === id ? 'border-ds-accent bg-ds-accent/10' : 'border-ds-border bg-ds-bg hover:border-ds-accent'
                            }`}
                        >
                            <Icon className="w-5 h-5 mb-2 text-ds-accent-text" />
                            <div className="text-sm font-bold text-ds-text">{r(id)}{plus ? '+' : ''}</div>
                            <div className="text-xs text-ds-soft mt-1">{sub(id)}</div>
                        </button>
                    ))}
                </div>
                <p className={`${hintCls} mt-3`}>{t('scripting.editor.restrictionNote')}</p>
            </div>

            <div className={panelCls}>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-bold text-ds-text">{t('scripting.editor.statusActive')}</p>
                        <p className={hintCls}>{t('scripting.editor.statusInactive')}</p>
                    </div>
                    <Switch checked={isActive} onChange={setIsActive} label={t('scripting.editor.statusActive')} />
                </div>
            </div>
        </>
    );
}
