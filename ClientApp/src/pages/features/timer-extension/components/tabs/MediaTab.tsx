/**
 * Timer Extension - Media Tab Component
 * 
 * Gestión de archivos multimedia (imágenes, GIFs, sonidos, videos).
 */

import MediaGallery from '../../../../../components/timer/MediaGallery';

export const MediaTab: React.FC<any> = () => {
    return (
        <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    ℹ️ Gestiona todos tus archivos multimedia con categorías profesionales. Sube imágenes, GIFs, videos y sonidos organizados por carpetas.
                </p>
            </div>

            {/* MediaGallery Profesional con Upload, Rename, Delete y Categorías */}
            <MediaGallery />
        </div>
    );
};

export default MediaTab;
