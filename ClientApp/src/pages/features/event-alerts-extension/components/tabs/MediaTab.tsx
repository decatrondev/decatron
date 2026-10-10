/**
 * Event Alerts Extension - Media Tab Component
 *
 * Galería de archivos multimedia para las alertas.
 * Idéntico al sistema de media del Timer Extensible.
 */

import React from 'react';
import MediaGallery from '../../../../../components/timer/MediaGallery';
import { EventSection } from '../EventSection';

export const MediaTab: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <EventSection title="📁 Galería de Multimedia" description="Sube y gestiona tus archivos de audio, video e imágenes para las alertas. Estos archivos
          estarán disponibles en el selector de media de cada evento." defaultOpen>
      </EventSection>

      {/* Gallery */}
      <div className="rounded-lg border border-ds-border bg-ds-surface p-6">
        <MediaGallery />
      </div>
    </div>
  );
};
