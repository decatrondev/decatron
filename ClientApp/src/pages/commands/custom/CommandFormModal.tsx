import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Field, Input, Select, Textarea } from '../../../components/ds';
import ModalShell from '../../../components/dashboard/ModalShell';
import type { NewCommand, Restriction } from './types';

/** Ventana de «crear» y «editar» comando: el mismo formulario, con los textos de cada modo. En edición el nombre no se puede cambiar. */
export default function CommandFormModal({ mode, values, onChange, onSave, onClose }: {
    mode: 'create' | 'edit'; values: NewCommand; onChange: (v: NewCommand) => void; onSave: () => void; onClose: () => void;
}) {
    const { t } = useTranslation('commands');
    const k = mode === 'create' ? 'customCommands.createModal' : 'customCommands.editModal';
    const set = (p: Partial<NewCommand>) => onChange({ ...values, ...p });

    return (
        <ModalShell
            title={t(`${k}.title`)}
            size="lg"
            onClose={onClose}
            actions={<>
                <Button variant="secondary" onClick={onClose}>{t(`${k}.cancelButton`)}</Button>
                <Button icon={<Save />} onClick={onSave}>{t(mode === 'create' ? `${k}.createButton` : `${k}.saveButton`)}</Button>
            </>}
        >
            <div className="space-y-4 mt-4">
                <Field label={t(`${k}.commandLabel`)} hint={t(`${k}.commandHelper`)}>
                    {mode === 'create' ? (
                        <Input type="text" value={values.commandName} onChange={(e) => set({ commandName: e.target.value })}
                            placeholder={t('customCommands.createModal.commandPlaceholder')} />
                    ) : (
                        <Input type="text" value={values.commandName} disabled className="font-mono" />
                    )}
                </Field>
                <Field label={t(`${k}.responseLabel`)}>
                    <Textarea value={values.response} onChange={(e) => set({ response: e.target.value })}
                        placeholder={t('customCommands.createModal.responsePlaceholder')} rows={4} />
                </Field>
                <Field label={t(`${k}.restrictionLabel`)}>
                    <Select value={values.restriction} onChange={(e) => set({ restriction: e.target.value as Restriction })}>
                        <option value="all">{t('customCommands.restrictions.all')}</option>
                        <option value="sub">{t('customCommands.restrictions.sub')}</option>
                        <option value="vip">{t('customCommands.restrictions.vip')}</option>
                        <option value="mod">{t('customCommands.restrictions.mod')}</option>
                    </Select>
                </Field>
                <Checkbox label={t(mode === 'create' ? `${k}.statusActive` : `${k}.statusLabel`)} checked={values.isActive}
                    onChange={(e) => set({ isActive: e.target.checked })} />
            </div>
        </ModalShell>
    );
}
