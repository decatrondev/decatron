import MediaGallery from '../../../../../components/timer/MediaGallery';

export function MediaTab() {
    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
                <label className="text-sm font-bold text-ds-text flex items-center gap-2">
                    📁 Galería de Multimedia
                </label>
                <p className="text-xs text-ds-soft mt-1">
                    Sube y administra aquí los archivos de tus Sound Alerts. Es la misma galería
                    que aparece al asignar un archivo a una recompensa en "Recompensas".
                </p>
            </div>

            <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
                <MediaGallery selectedCategory="sound-alerts" />
            </div>
        </div>
    );
}
