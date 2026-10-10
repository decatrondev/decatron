import { useTranslation } from 'react-i18next';
import type { AnimationConfig, AnimationDirection, EffectsConfig, VisualEffect } from '../types/index';

// Animación y efectos de una alerta (rediseño, fase 4). Antes se fijaban al crear el nivel y no se podían cambiar;
// el overlay los usa: la animación es "la del evento" del Diseño y los efectos van sobre la tarjeta.

type AnimType = AnimationConfig['type'] | 'slide-bounce' | 'flip' | 'glitch';

const TYPES: AnimType[] = ['fade', 'slide', 'slide-bounce', 'bounce', 'zoom', 'rotate', 'flip', 'glitch'];
const WITH_DIRECTION: AnimType[] = ['slide', 'slide-bounce', 'flip'];
const DIRECTIONS: AnimationDirection[] = ['center', 'left', 'right', 'top', 'bottom'];
const MOTION: VisualEffect[] = ['shake', 'float', 'pulse'];
const EFFECTS: VisualEffect[] = ['glow', 'shake', 'float', 'pulse', 'confetti', 'fireworks'];

const DEFAULT_ANIMATION: AnimationConfig = { type: 'fade', direction: 'center', duration: 500, easing: 'ease-in-out' };

interface Props {
    animation?: AnimationConfig;
    effects?: EffectsConfig;
    onChange: (patch: { animation?: AnimationConfig; effects?: EffectsConfig }) => void;
}

export function AnimationEffectsSection({ animation, effects, onChange }: Props) {
    const { t } = useTranslation('overlays');
    const anim = { ...DEFAULT_ANIMATION, ...(animation ?? {}) };
    const fx = effects ?? { enabled: false, effects: [] };
    const chip = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold border transition-colors ${active ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text ' : 'border-ds-border text-ds-soft hover:border-ds-accent'}`;
    const label = 'text-xs 3xl:text-sm font-bold text-ds-soft block mb-2';

    const toggleEffect = (id: VisualEffect) => {
        let list = fx.effects.includes(id) ? fx.effects.filter(e => e !== id) : [...fx.effects, id];
        // Un solo movimiento a la vez (sacudida, flotar o pulso se pisarían)
        if (!fx.effects.includes(id) && MOTION.includes(id)) list = list.filter(e => e === id || !MOTION.includes(e));
        onChange({ effects: { enabled: list.length > 0, effects: list } });
    };

    return (
        <div className="space-y-4">
            <div>
                <span className={label}>{t('eventAlertsView.animFx.animation')}</span>
                <div className="flex flex-wrap gap-1.5">
                    {TYPES.map(ty => (
                        <button key={ty} type="button" className={chip(anim.type === ty)} onClick={() => onChange({ animation: { ...anim, type: ty as AnimationConfig['type'] } })}>{t(`eventAlertsView.animFx.types.${ty}`)}</button>
                    ))}
                </div>
            </div>
            {WITH_DIRECTION.includes(anim.type as AnimType) && (
                <div>
                    <span className={label}>{t('eventAlertsView.animFx.direction')}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {DIRECTIONS.map(d => <button key={d} type="button" className={chip(anim.direction === d)} onClick={() => onChange({ animation: { ...anim, direction: d } })}>{t(`eventAlertsView.animFx.directions.${d}`)}</button>)}
                    </div>
                </div>
            )}
            <div>
                <span className={label}>{t('eventAlertsView.animFx.effectsLabel')}</span>
                <div className="flex flex-wrap gap-1.5">
                    {EFFECTS.map(e => <button key={e} type="button" className={chip(fx.enabled && fx.effects.includes(e))} onClick={() => toggleEffect(e)}>{t(`eventAlertsView.animFx.effects.${e}`)}</button>)}
                </div>
            </div>
            <p className="text-xs 3xl:text-sm text-ds-soft">{t('eventAlertsView.animFx.hint')}</p>
        </div>
    );
}
