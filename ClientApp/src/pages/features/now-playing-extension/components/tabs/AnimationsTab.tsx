/**
 * Now Playing Extension - Animations Tab
 */

import React from 'react';
import type { ConfigJson, TierLimits } from '../../types';
import { Card, SectionTitle, Label, Slider, SelectInput, TierLock } from '../ui/SharedUI';

export const AnimationsTab: React.FC<{
    config: ConfigJson;
    onUpdate: (partial: Partial<ConfigJson>) => void;
    limits: TierLimits;
}> = ({ config, onUpdate, limits }) => {
    const updateAnim = (partial: Partial<ConfigJson['animations']>) => {
        onUpdate({ animations: { ...config.animations, ...partial } });
    };

    const animationOptions = [
        { value: 'fadeIn', label: 'Fade In' },
        { value: 'slideIn', label: 'Slide In' },
        { value: 'bounceIn', label: 'Bounce In' },
        { value: 'zoomIn', label: 'Zoom In' },
    ];
    const hideAnimationOptions = [
        { value: 'fadeOut', label: 'Fade Out' },
        { value: 'slideOut', label: 'Slide Out' },
        { value: 'bounceOut', label: 'Bounce Out' },
        { value: 'zoomOut', label: 'Zoom Out' },
    ];
    const directionOptions = [
        { value: 'left', label: 'Izquierda' },
        { value: 'right', label: 'Derecha' },
        { value: 'top', label: 'Arriba' },
        { value: 'bottom', label: 'Abajo' },
    ];
    const easingOptions = [
        { value: 'ease', label: 'Ease' },
        { value: 'ease-in', label: 'Ease In' },
        { value: 'ease-out', label: 'Ease Out' },
        { value: 'ease-in-out', label: 'Ease In-Out' },
    ];
    const songChangeOptions = [
        { value: 'crossfade', label: 'Crossfade' },
        { value: 'slideUp', label: 'Slide Up' },
        { value: 'none', label: 'Ninguna' },
    ];

    const showNeedsDirection = ['slideIn', 'bounceIn'].includes(config.animations.showAnimation);
    const hideNeedsDirection = ['slideOut', 'bounceOut'].includes(config.animations.hideAnimation);

    return (
        <div className="space-y-5">
            {/* Show Animation */}
            <Card>
                <SectionTitle>Animacion de Entrada</SectionTitle>
                <div className="space-y-4">
                    <TierLock allowed={limits.allowAnimationType} requiredTier="supporter">
                        <div>
                            <Label>Animacion</Label>
                            <SelectInput value={config.animations.showAnimation} onChange={(v) => updateAnim({ showAnimation: v })} options={animationOptions} />
                        </div>
                    </TierLock>
                    <TierLock allowed={limits.allowAnimationDetails} requiredTier="premium">
                        {showNeedsDirection && (
                            <div>
                                <Label>Direccion</Label>
                                <SelectInput value={config.animations.showDirection} onChange={(v) => updateAnim({ showDirection: v })} options={directionOptions} />
                            </div>
                        )}
                        <div>
                            <Label>Duracion</Label>
                            <Slider value={config.animations.showDuration} onChange={(v) => updateAnim({ showDuration: v })} min={200} max={2000} step={50} unit="ms" />
                        </div>
                        <div>
                            <Label>Easing</Label>
                            <SelectInput value={config.animations.showEasing} onChange={(v) => updateAnim({ showEasing: v })} options={easingOptions} />
                        </div>
                    </TierLock>
                </div>
            </Card>

            {/* Hide Animation */}
            <Card>
                <SectionTitle>Animacion de Salida</SectionTitle>
                <div className="space-y-4">
                    <TierLock allowed={limits.allowAnimationType} requiredTier="supporter">
                        <div>
                            <Label>Animacion</Label>
                            <SelectInput value={config.animations.hideAnimation} onChange={(v) => updateAnim({ hideAnimation: v })} options={hideAnimationOptions} />
                        </div>
                    </TierLock>
                    <TierLock allowed={limits.allowAnimationDetails} requiredTier="premium">
                        {hideNeedsDirection && (
                            <div>
                                <Label>Direccion</Label>
                                <SelectInput value={config.animations.hideDirection} onChange={(v) => updateAnim({ hideDirection: v })} options={directionOptions} />
                            </div>
                        )}
                        <div>
                            <Label>Duracion</Label>
                            <Slider value={config.animations.hideDuration} onChange={(v) => updateAnim({ hideDuration: v })} min={200} max={2000} step={50} unit="ms" />
                        </div>
                        <div>
                            <Label>Easing</Label>
                            <SelectInput value={config.animations.hideEasing} onChange={(v) => updateAnim({ hideEasing: v })} options={easingOptions} />
                        </div>
                    </TierLock>
                </div>
            </Card>

            {/* Song Change */}
            <Card>
                <SectionTitle>Cambio de Cancion</SectionTitle>
                <div className="space-y-4">
                    <div>
                        <Label>Animacion</Label>
                        <SelectInput value={config.animations.songChangeAnimation} onChange={(v) => updateAnim({ songChangeAnimation: v })} options={songChangeOptions} />
                    </div>
                    <div>
                        <Label>Duracion</Label>
                        <Slider value={config.animations.songChangeDuration} onChange={(v) => updateAnim({ songChangeDuration: v })} min={100} max={1000} step={50} unit="ms" />
                    </div>
                </div>
            </Card>
        </div>
    );
};
