import React from 'react';
import type { ConfigJson, TierLimits, TypographySettings } from '../../types';
import { Card, SectionTitle, Label, TierLock, Slider, ColorInput, SelectInput } from '../ui/SharedUI';
import { FONT_OPTIONS, FONT_WEIGHT_OPTIONS, TEXT_SHADOW_OPTIONS } from '../../constants/defaults';

const TypographySectionEditor: React.FC<{
    label: string;
    settings: TypographySettings;
    onChange: (s: TypographySettings) => void;
    showTextShadow?: boolean;
    limits: TierLimits;
}> = ({ label, settings, onChange, showTextShadow = true, limits }) => {
    const update = (partial: Partial<TypographySettings>) => onChange({ ...settings, ...partial });

    return (
        <Card>
            <SectionTitle>{label}</SectionTitle>
            <div className="space-y-4">
                <TierLock allowed={limits.allowCustomFonts} requiredTier="premium">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Fuente</Label>
                            <SelectInput
                                value={settings.fontFamily}
                                onChange={(v) => update({ fontFamily: v })}
                                options={FONT_OPTIONS.map((f) => ({ value: f, label: f }))}
                            />
                        </div>
                        <div>
                            <Label>Peso</Label>
                            <SelectInput
                                value={settings.fontWeight}
                                onChange={(v) => update({ fontWeight: Number(v) })}
                                options={FONT_WEIGHT_OPTIONS.map((w) => ({ value: w, label: `${w}` }))}
                            />
                        </div>
                    </div>
                </TierLock>
                <TierLock allowed={limits.allowFontSize} requiredTier="supporter">
                    <div>
                        <Label>Tamano de fuente</Label>
                        <Slider value={settings.fontSize} onChange={(v) => update({ fontSize: v })} min={8} max={72} unit="px" />
                    </div>
                </TierLock>
                <TierLock allowed={limits.allowCustomColors} requiredTier="supporter">
                    <div>
                        <Label>Color</Label>
                        <ColorInput value={settings.color} onChange={(v) => update({ color: v })} />
                    </div>
                </TierLock>
                {showTextShadow && settings.textShadow !== undefined && (
                    <TierLock allowed={limits.allowTextShadow} requiredTier="premium">
                        <div>
                            <Label>Sombra de texto</Label>
                            <SelectInput
                                value={settings.textShadow || 'none'}
                                onChange={(v) => update({ textShadow: v })}
                                options={TEXT_SHADOW_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                            />
                        </div>
                    </TierLock>
                )}
                {/* Preview */}
                <div className="p-3 bg-[#262626] rounded-lg border border-[#374151]">
                    <span style={{
                        fontFamily: settings.fontFamily,
                        fontSize: `${settings.fontSize}px`,
                        fontWeight: settings.fontWeight,
                        color: settings.color,
                        textShadow: settings.textShadow === 'none' ? undefined : settings.textShadow,
                    }}>
                        Texto de ejemplo
                    </span>
                </div>
            </div>
        </Card>
    );
};

export const TypographyTab: React.FC<{
    config: ConfigJson;
    onUpdate: (partial: Partial<ConfigJson>) => void;
    limits: TierLimits;
}> = ({ config, onUpdate, limits }) => {
    const updateTypo = (key: keyof ConfigJson['typography'], settings: TypographySettings) => {
        onUpdate({ typography: { ...config.typography, [key]: settings } });
    };

    return (
        <div className="space-y-5">
            <TypographySectionEditor label="Titulo de la Cancion" settings={config.typography.songTitle} onChange={(s) => updateTypo('songTitle', s)} limits={limits} />
            <TypographySectionEditor label="Artista" settings={config.typography.artist} onChange={(s) => updateTypo('artist', s)} limits={limits} />
            <TypographySectionEditor label="Album" settings={config.typography.album} onChange={(s) => updateTypo('album', s)} limits={limits} />
            <TypographySectionEditor label="Tiempo" settings={config.typography.time} onChange={(s) => updateTypo('time', s)} showTextShadow={false} limits={limits} />
        </div>
    );
};
