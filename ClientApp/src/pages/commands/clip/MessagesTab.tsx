import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Field, Textarea } from '../../../components/ds';
import { ConfigCard, VariableChips, hintCls } from '../../../components/dashboard/config';
import type { ClipCfg } from './useClipConfig';

export default function MessagesTab({ cfg }: { cfg: ClipCfg }) {
    const { t } = useTranslation('clipcommand');
    const keys = Object.keys(cfg.placeholders);

    return (
        <ConfigCard icon={<MessageSquare />} title={t('messages.title')} hint={t('messages.hint')}>
            <div className="space-y-8">
                {keys.map(key => {
                    const vars = (cfg.placeholders[key] ?? []).map(v => `{${v}}`);
                    const own = cfg.messages[key] ?? { es: '', en: '' };
                    const hasOwn = own.es.trim() !== '' || own.en.trim() !== '';
                    return (
                        <div key={key} className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-black text-ds-text">{t(`messages.keys.${key}`)}</h3>
                                {hasOwn && (
                                    <Button variant="secondary" size="sm"
                                        onClick={() => { cfg.setMessage(key, 'es', ''); cfg.setMessage(key, 'en', ''); }}>
                                        {t('messages.restore')}
                                    </Button>
                                )}
                            </div>
                            <div>
                                <span className={hintCls}>{t('messages.variables')}</span>
                                <VariableChips vars={vars} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {(['es', 'en'] as const).map(lang => (
                                    <Field key={lang} label={t(lang === 'es' ? 'messages.spanish' : 'messages.english')}>
                                        <Textarea rows={3} maxLength={400} value={own[lang]} placeholder={cfg.defaults[key]?.[lang] ?? ''}
                                            className="font-mono resize-none" onChange={e => cfg.setMessage(key, lang, e.target.value)} />
                                    </Field>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </ConfigCard>
    );
}
