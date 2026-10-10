import { useState } from 'react';
import { Image, ExternalLink, CheckCircle, X } from 'lucide-react';
import MediaGallery from '../../../../components/timer/MediaGallery';

export default function StaticThumbnailPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const isExternal = value ? value.startsWith('http') : false;
  const [mode, setMode] = useState<'gallery' | 'url'>(isExternal ? 'url' : 'gallery');
  const [showGallery, setShowGallery] = useState(false);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <button onClick={() => setMode('gallery')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all border ${mode === 'gallery' ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text' : 'border-ds-border text-ds-soft'}`}>
          <Image className="w-3 h-3 inline mr-1" /> Galeria
        </button>
        <button onClick={() => setMode('url')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all border ${mode === 'url' ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text' : 'border-ds-border text-ds-soft'}`}>
          <ExternalLink className="w-3 h-3 inline mr-1" /> URL externa
        </button>
      </div>

      {mode === 'url' ? (
        <input type="url" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="https://ejemplo.com/imagen.jpg"
          className="ds-input w-full" />
      ) : (
        <div>
          {value ? (
            <div className="flex items-center gap-3 p-2 bg-ds-surface rounded-lg border border-ds-border">
              <img src={value} alt="" className="w-20 h-12 rounded-lg object-cover" />
              <span className="flex-1 text-sm text-ds-soft truncate">{value.split('/').pop()}</span>
              <button onClick={() => setShowGallery(true)} className="px-3 py-1.5 text-xs font-medium bg-ds-bg text-ds-accent-text rounded-lg border border-ds-border">Cambiar</button>
            </div>
          ) : (
            <button onClick={() => setShowGallery(true)}
              className="w-full px-4 py-3 border-2 border-dashed border-ds-border rounded-lg text-sm text-ds-soft hover:border-ds-accent hover:text-ds-accent-text transition-colors">
              Seleccionar imagen de la galeria
            </button>
          )}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-2">
          <img src={value} alt="" className="w-16 h-9 rounded object-cover" />
          <span className="text-xs text-ds-ok flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Imagen seleccionada</span>
        </div>
      )}

      {showGallery && (
        <div className="fixed inset-0 bg-ds-input/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-ds-surface rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-ds-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-ds-text">Seleccionar imagen</h3>
              <button onClick={() => setShowGallery(false)} className="text-ds-soft hover:text-ds-text"><X className="w-5 h-5" /></button>
            </div>
            <MediaGallery selectedFileType="image" onFileSelect={(file) => { onChange(file.fileUrl); setShowGallery(false); }} />
          </div>
        </div>
      )}
    </div>
  );
}
