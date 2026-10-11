import { Gauge, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, Input, Switch } from '../../../components/ds';
import { ConfigCard, ConfigDivider, SliderField, ToggleRow } from '../../../components/dashboard/config';
import type { ClipCfg } from './useClipConfig';

export default function CooldownsTab({ cfg }: { cfg: ClipCfg }) {
    const { t } = useTranslation('clipcommand');
    const c = cfg.config;
    const limited = c.maxPerUserPerStream !== null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfigCard icon={<Timer />} title={t('cooldowns.title')}>
                <div className="space-y-5">
                    <SliderField label={t('cooldowns.global')} display={t('cooldowns.seconds', { n: c.globalCooldownSeconds })}
                        value={c.globalCooldownSeconds} min={0} max={300} onChange={v => cfg.update('globalCooldownSeconds', v)} hint={t('cooldowns.globalHint')} />
                    <SliderField label={t('cooldowns.user')} display={t('cooldowns.seconds', { n: c.userCooldownSeconds })}
                        value={c.userCooldownSeconds} min={0} max={900} onChange={v => cfg.update('userCooldownSeconds', v)} hint={t('cooldowns.userHint')} />
                    <ConfigDivider />
                    <ToggleRow title={t('cooldowns.staffSkip')} checked={c.staffSkipUserCooldown} onChange={v => cfg.update('staffSkipUserCooldown', v)} />
                </div>
            </ConfigCard>

            <ConfigCard icon={<Gauge />} title={t('cooldowns.limitTitle')}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-semibold text-ds-text">{t('cooldowns.limitNone')}</span>
                        <Switch checked={!limited} label={t('cooldowns.limitNone')} onChange={v => cfg.update('maxPerUserPerStream', v ? null : 3)} />
                    </div>
                    {limited && (
                        <Field label={t('cooldowns.limitValue')}>
                            <Input type="number" inputMode="numeric" min={1} max={1000} value={c.maxPerUserPerStream ?? 3}
                                onChange={e => cfg.update('maxPerUserPerStream', Math.max(1, Number(e.target.value) || 1))} />
                        </Field>
                    )}
                </div>
            </ConfigCard>
        </div>
    );
}
