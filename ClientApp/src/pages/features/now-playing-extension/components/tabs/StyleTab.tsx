import React from 'react';
import type { ConfigJson, TierLimits } from '../../types';
import { Card, SectionTitle, Label, TierLock, Toggle, Slider, ColorInput } from '../ui/SharedUI';

export const StyleTab: React.FC<{
    config: ConfigJson;
    onUpdate: (partial: Partial<ConfigJson>) => void;
    limits: TierLimits;
}> = ({ config, onUpdate, limits }) => {
    const updateStyle = (partial: Partial<ConfigJson['style']>) => {
        onUpdate({ style: { ...config.style, ...partial } });
    };
    const updateGradient = (partial: Partial<ConfigJson['style']['backgroundGradient']>) => {
        onUpdate({
            style: {
                ...config.style,
                backgroundGradient: { ...config.style.backgroundGradient, ...partial },
            },
        });
    };

    return (
        <div className="space-y-5">
            {/* Background */}
            <Card>
                <SectionTitle>Fondo</SectionTitle>
                <div className="space-y-4">
                    <div>
                        <Label>Tipo de fondo</Label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                            <button
                                onClick={() => updateStyle({ backgroundType: 'color' })}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                    config.style.backgroundType === 'color'
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                        : 'border-[#374151] bg-[#262626] text-[#94a3b8] hover:border-[#4b5563]'
                                }`}
                            >Color</button>
                            <TierLock allowed={limits.allowGradient} requiredTier="premium">
                                <button
                                    onClick={() => updateStyle({ backgroundType: 'gradient' })}
                                    className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                        config.style.backgroundType === 'gradient'
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                            : 'border-[#374151] bg-[#262626] text-[#94a3b8] hover:border-[#4b5563]'
                                    }`}
                                >Gradiente</button>
                            </TierLock>
                            <TierLock allowed={limits.allowTransparent} requiredTier="supporter">
                                <button
                                    onClick={() => updateStyle({ backgroundType: 'transparent' })}
                                    className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                        config.style.backgroundType === 'transparent'
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                            : 'border-[#374151] bg-[#262626] text-[#94a3b8] hover:border-[#4b5563]'
                                    }`}
                                >Transparente</button>
                            </TierLock>
                        </div>
                    </div>

                    {config.style.backgroundType === 'color' && (
                        <TierLock allowed={limits.allowCustomColors} requiredTier="supporter">
                            <div>
                                <Label>Color de fondo</Label>
                                <ColorInput value={config.style.backgroundColor} onChange={(v) => updateStyle({ backgroundColor: v })} />
                            </div>
                        </TierLock>
                    )}

                    {config.style.backgroundType === 'gradient' && (
                        <div className="space-y-3">
                            <div>
                                <Label>Color 1</Label>
                                <ColorInput value={config.style.backgroundGradient.color1} onChange={(v) => updateGradient({ color1: v })} />
                            </div>
                            <div>
                                <Label>Color 2</Label>
                                <ColorInput value={config.style.backgroundGradient.color2} onChange={(v) => updateGradient({ color2: v })} />
                            </div>
                            <div>
                                <Label>Angulo</Label>
                                <Slider value={config.style.backgroundGradient.angle} onChange={(v) => updateGradient({ angle: v })} min={0} max={360} unit="deg" />
                            </div>
                            {/* Gradient preview */}
                            <div
                                className="h-10 rounded-lg border border-[#374151]"
                                style={{
                                    background: `linear-gradient(${config.style.backgroundGradient.angle}deg, ${config.style.backgroundGradient.color1}, ${config.style.backgroundGradient.color2})`,
                                }}
                            />
                        </div>
                    )}

                    <TierLock allowed={limits.allowCustomOpacity} requiredTier="supporter">
                        <div>
                            <Label>Opacidad</Label>
                            <Slider value={config.style.opacity} onChange={(v) => updateStyle({ opacity: v })} min={0} max={100} unit="%" />
                        </div>
                    </TierLock>
                </div>
            </Card>

            {/* Border */}
            <Card>
                <SectionTitle>Borde</SectionTitle>
                <div className="space-y-4">
                    <Toggle checked={config.style.borderEnabled} onChange={(v) => updateStyle({ borderEnabled: v })} label="Mostrar borde" />
                    {config.style.borderEnabled && (
                        <TierLock allowed={limits.allowCustomColors} requiredTier="supporter">
                            <div>
                                <Label>Color del borde</Label>
                                <ColorInput value={config.style.borderColor} onChange={(v) => updateStyle({ borderColor: v })} />
                            </div>
                            <div>
                                <Label>Ancho del borde</Label>
                                <Slider value={config.style.borderWidth} onChange={(v) => updateStyle({ borderWidth: v })} min={1} max={10} unit="px" />
                            </div>
                        </TierLock>
                    )}
                    <div>
                        <Label>Radio de borde</Label>
                        <Slider value={config.style.borderRadius} onChange={(v) => updateStyle({ borderRadius: v })} min={0} max={50} unit="px" />
                    </div>
                </div>
            </Card>
        </div>
    );
};
