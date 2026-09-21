import MediaGallery from '../../../../../components/timer/MediaGallery';

export function MediaTab() {
    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
                <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    📁 Galería de Multimedia
                </label>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Subí y gestioná los archivos de tus Sound Alerts desde acá — es la misma
                    galería que después elegís al asignar un archivo a una recompensa en "Archivos".
                </p>
            </div>

            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
                <MediaGallery selectedCategory="sound-alerts" />
            </div>
        </div>
    );
}
