// MediaTab - Media management for goals (sounds, images, videos)

import React from 'react';
import { FolderOpen, Info } from 'lucide-react';
import MediaGallery from '../../../../../components/timer/MediaGallery';

export const MediaTab: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-ds-accent rounded-lg flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-ds-on-accent" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-ds-text">
                            Galería de Media
                        </h2>
                        <p className="text-sm text-ds-soft">
                            Sube y organiza archivos multimedia para usar en alertas y notificaciones
                        </p>
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-ds-accent-text flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-ds-accent-text">
                            Gestiona todos tus archivos multimedia con categorías profesionales.
                            Sube imágenes, GIFs, videos y sonidos organizados por carpetas.
                            Estos archivos se pueden usar en las notificaciones de metas.
                        </p>
                    </div>
                </div>
            </div>

            {/* Media Gallery */}
            <MediaGallery />

            {/* Usage Tips */}
            <div className="bg-ds-bg border border-ds-border rounded-lg p-4">
                <h4 className="font-semibold text-ds-text mb-3">
                    Tipos de archivos soportados
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 bg-ds-surface rounded-lg">
                        <div className="text-lg mb-1">🖼️</div>
                        <div className="font-medium text-ds-text">Imágenes</div>
                        <div className="text-xs text-ds-soft">JPG, PNG, WebP</div>
                    </div>
                    <div className="p-3 bg-ds-surface rounded-lg">
                        <div className="text-lg mb-1">🎞️</div>
                        <div className="font-medium text-ds-text">GIFs</div>
                        <div className="text-xs text-ds-soft">Animados</div>
                    </div>
                    <div className="p-3 bg-ds-surface rounded-lg">
                        <div className="text-lg mb-1">🎬</div>
                        <div className="font-medium text-ds-text">Videos</div>
                        <div className="text-xs text-ds-soft">MP4, WebM</div>
                    </div>
                    <div className="p-3 bg-ds-surface rounded-lg">
                        <div className="text-lg mb-1">🔊</div>
                        <div className="font-medium text-ds-text">Audio</div>
                        <div className="text-xs text-ds-soft">MP3, WAV, OGG</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaTab;
