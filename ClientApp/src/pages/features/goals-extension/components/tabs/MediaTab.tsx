// MediaTab - Media management for goals (sounds, images, videos)

import React from 'react';
import { FolderOpen, Info } from 'lucide-react';
import MediaGallery from '../../../../../components/timer/MediaGallery';

export const MediaTab: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-xl flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            Galería de Media
                        </h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Sube y organiza archivos multimedia para usar en alertas y notificaciones
                        </p>
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
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
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <h4 className="font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-3">
                    Tipos de archivos soportados
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 bg-white dark:bg-[#1B1C1D] rounded-lg">
                        <div className="text-lg mb-1">🖼️</div>
                        <div className="font-medium text-[#1e293b] dark:text-[#f8fafc]">Imágenes</div>
                        <div className="text-xs text-[#64748b]">JPG, PNG, WebP</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-[#1B1C1D] rounded-lg">
                        <div className="text-lg mb-1">🎞️</div>
                        <div className="font-medium text-[#1e293b] dark:text-[#f8fafc]">GIFs</div>
                        <div className="text-xs text-[#64748b]">Animados</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-[#1B1C1D] rounded-lg">
                        <div className="text-lg mb-1">🎬</div>
                        <div className="font-medium text-[#1e293b] dark:text-[#f8fafc]">Videos</div>
                        <div className="text-xs text-[#64748b]">MP4, WebM</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-[#1B1C1D] rounded-lg">
                        <div className="text-lg mb-1">🔊</div>
                        <div className="font-medium text-[#1e293b] dark:text-[#f8fafc]">Audio</div>
                        <div className="text-xs text-[#64748b]">MP3, WAV, OGG</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaTab;
