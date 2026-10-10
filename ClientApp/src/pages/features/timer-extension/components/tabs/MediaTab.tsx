/**
 * Timer Extension - Media Tab Component
 * 
 * Gestión de archivos multimedia (imágenes, GIFs, sonidos, videos).
 */

import MediaGallery from '../../../../../components/timer/MediaGallery';

export const MediaTab: React.FC<any> = () => {
    return (
        <div className="space-y-6">
            <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4">
                <p className="text-sm text-ds-accent-text">
                    ℹ️ Gestiona todos tus archivos multimedia con categorías profesionales. Sube imágenes, GIFs, videos y sonidos organizados por carpetas.
                </p>
            </div>

            {/* MediaGallery Profesional con Upload, Rename, Delete y Categorías */}
            <MediaGallery />
        </div>
    );
};

export default MediaTab;
