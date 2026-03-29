/**
 * Event Alerts Extension - Media Tab Component
 *
 * Galería de archivos multimedia para las alertas.
 * Idéntico al sistema de media del Timer Extensible.
 */

import React from 'react';
import MediaGallery from '../../../../../components/timer/MediaGallery';

export const MediaTab: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
          📁 Galería de Multimedia
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
          Sube y gestiona tus archivos de audio, video e imágenes para las alertas. Estos archivos
          estarán disponibles en el selector de media de cada evento.
        </p>
      </div>

      {/* Gallery */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <MediaGallery />
      </div>
    </div>
  );
};
