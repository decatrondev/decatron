/**
 * Now Playing Extension - Progress Bar Tab
 */

import React from 'react';
import type { ConfigJson, TierLimits } from '../../types';
import { Card, SectionTitle, Label, Slider, ColorInput, Toggle, TierLock } from '../ui/SharedUI';

export const ProgressBarTab: React.FC<{
    config: ConfigJson;
    onUpdate: (partial: Partial<ConfigJson>) => void;
    limits: TierLimits;
}> = ({ config, onUpdate, limits }) => {
    const updatePB = (partial: Partial<ConfigJson['progressBar']>) => {
        onUpdate({ progressBar: { ...config.progressBar, ...partial } });
    };

    return (
        <div className="space-y-5">
            <Card>
                <SectionTitle>Barra de Progreso</SectionTitle>
                <div className="space-y-4">
                    <div>
                        <Label>Altura</Label>
                        <Slider value={config.progressBar.height} onChange={(v) => updatePB({ height: v })} min={2} max={20} unit="px" />
                    </div>
                    <div>
                        <Label>Radio de borde</Label>
                        <Slider value={config.progressBar.borderRadius} onChange={(v) => updatePB({ borderRadius: v })} min={0} max={10} unit="px" />
                    </div>
                    <TierLock allowed={limits.allowProgressBarColors} requiredTier="supporter">
                        <div>
                            <Label>Color de fondo (track)</Label>
                            <ColorInput value={config.progressBar.backgroundColor} onChange={(v) => updatePB({ backgroundColor: v })} />
                        </div>
                        <div>
                            <Label>Color de relleno (progreso)</Label>
                            <ColorInput value={config.progressBar.foregroundColor} onChange={(v) => updatePB({ foregroundColor: v })} />
                        </div>
                    </TierLock>
                    <TierLock allowed={limits.allowProgressBarAnimation} requiredTier="premium">
                        <Toggle checked={config.progressBar.animated} onChange={(v) => updatePB({ animated: v })} label="Animacion suave" description="Transicion suave al avanzar el progreso" />
                    </TierLock>
                </div>
            </Card>

            {/* Preview */}
            <Card>
                <SectionTitle>Vista Previa</SectionTitle>
                <div className="space-y-3">
                    <div
                        className="w-full overflow-hidden"
                        style={{
                            height: `${config.progressBar.height}px`,
                            borderRadius: `${config.progressBar.borderRadius}px`,
                            backgroundColor: config.progressBar.backgroundColor,
                        }}
                    >
                        <div
                            style={{
                                width: '65%',
                                height: '100%',
                                borderRadius: `${config.progressBar.borderRadius}px`,
                                backgroundColor: config.progressBar.foregroundColor,
                                transition: config.progressBar.animated ? 'width 0.3s ease' : 'none',
                            }}
                        />
                    </div>
                    <p className="text-xs text-[#64748b] text-center">Simulacion al 65%</p>
                </div>
            </Card>
        </div>
    );
};
