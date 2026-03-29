import React from 'react';
import type { ConfigJson, TierLimits } from '../../types';
import { Card, SectionTitle, Label, TierLock, Toggle, Slider, Checkbox } from '../ui/SharedUI';

export const LayoutTab: React.FC<{
    config: ConfigJson;
    onUpdate: (partial: Partial<ConfigJson>) => void;
    limits: TierLimits;
}> = ({ config, onUpdate, limits }) => {
    const updateLayout = (partial: Partial<ConfigJson['layout']>) => {
        onUpdate({ layout: { ...config.layout, ...partial } });
    };
    const updateAlbumArt = (partial: Partial<ConfigJson['albumArt']>) => {
        onUpdate({ albumArt: { ...config.albumArt, ...partial } });
    };

    return (
        <div className="space-y-5">
            {/* Orientation */}
            <Card>
                <SectionTitle>Orientacion</SectionTitle>
                <TierLock allowed={limits.allowVertical} requiredTier="supporter">
                    <div className="grid grid-cols-2 gap-3">
                        {(['horizontal', 'vertical'] as const).map((orient) => (
                            <button
                                key={orient}
                                onClick={() => updateLayout({ orientation: orient })}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                    config.layout.orientation === orient
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-[#374151] bg-[#262626] hover:border-[#4b5563]'
                                }`}
                            >
                                <div className={`flex ${orient === 'horizontal' ? 'flex-row' : 'flex-col'} items-center gap-2 mb-2 justify-center`}>
                                    <div className="w-8 h-8 rounded bg-[#374151]" />
                                    <div className="space-y-1">
                                        <div className="h-2 w-12 bg-[#374151] rounded" />
                                        <div className="h-1.5 w-8 bg-[#374151] rounded" />
                                    </div>
                                </div>
                                <div className="text-sm font-medium text-[#f8fafc] text-center capitalize">{orient}</div>
                            </button>
                        ))}
                    </div>
                </TierLock>
            </Card>

            {/* Visibility Toggles */}
            <Card>
                <SectionTitle>Elementos Visibles</SectionTitle>
                <TierLock allowed={limits.allowToggleElements} requiredTier="supporter">
                    <div className="space-y-1">
                        <Checkbox checked={config.layout.showAlbumArt} onChange={(v) => updateLayout({ showAlbumArt: v })} label="Caratula del album" />
                        <Checkbox checked={config.layout.showArtist} onChange={(v) => updateLayout({ showArtist: v })} label="Nombre del artista" />
                        <Checkbox checked={config.layout.showAlbum} onChange={(v) => updateLayout({ showAlbum: v })} label="Nombre del album" />
                        <Checkbox checked={config.layout.showProgressBar} onChange={(v) => updateLayout({ showProgressBar: v })} label="Barra de progreso" />
                        <Checkbox checked={config.layout.showTimeStamps} onChange={(v) => updateLayout({ showTimeStamps: v })} label="Timestamps (tiempo)" />
                        <Checkbox checked={config.layout.showProviderIcon} onChange={(v) => updateLayout({ showProviderIcon: v })} label="Icono del proveedor" />
                        <Checkbox checked={config.layout.marqueeOnOverflow} onChange={(v) => updateLayout({ marqueeOnOverflow: v })} label="Marquee en texto largo" />
                    </div>
                </TierLock>
            </Card>

            {/* Album Art */}
            <Card>
                <SectionTitle>Caratula del Album</SectionTitle>
                <div className="space-y-4">
                    <div>
                        <Label>Tamano</Label>
                        <Slider value={config.albumArt.size} onChange={(v) => updateAlbumArt({ size: v })} min={40} max={200} unit="px" />
                    </div>
                    <div>
                        <Label>Radio de borde</Label>
                        <Slider value={config.albumArt.borderRadius} onChange={(v) => updateAlbumArt({ borderRadius: v })} min={0} max={50} unit="%" />
                    </div>
                    <Toggle checked={config.albumArt.shadow} onChange={(v) => updateAlbumArt({ shadow: v })} label="Sombra" />
                </div>
            </Card>
        </div>
    );
};
