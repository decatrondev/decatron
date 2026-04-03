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
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all border ${mode === 'gallery' ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b]'}`}>
          <Image className="w-3 h-3 inline mr-1" /> Galeria
        </button>
        <button onClick={() => setMode('url')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all border ${mode === 'url' ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b]'}`}>
          <ExternalLink className="w-3 h-3 inline mr-1" /> URL externa
        </button>
      </div>

      {mode === 'url' ? (
        <input type="url" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="https://ejemplo.com/imagen.jpg"
          className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] placeholder-[#94a3b8] text-sm" />
      ) : (
        <div>
          {value ? (
            <div className="flex items-center gap-3 p-2 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
              <img src={value} alt="" className="w-20 h-12 rounded-lg object-cover" />
              <span className="flex-1 text-sm text-[#64748b] truncate">{value.split('/').pop()}</span>
              <button onClick={() => setShowGallery(true)} className="px-3 py-1.5 text-xs font-medium bg-[#f8fafc] dark:bg-[#374151] text-[#2563eb] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">Cambiar</button>
            </div>
          ) : (
            <button onClick={() => setShowGallery(true)}
              className="w-full px-4 py-3 border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#64748b] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">
              Seleccionar imagen de la galeria
            </button>
          )}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-2">
          <img src={value} alt="" className="w-16 h-9 rounded object-cover" />
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Imagen seleccionada</span>
        </div>
      )}

      {showGallery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Seleccionar imagen</h3>
              <button onClick={() => setShowGallery(false)} className="text-[#64748b] hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <MediaGallery selectedFileType="image" onFileSelect={(file) => { onChange(file.fileUrl); setShowGallery(false); }} />
          </div>
        </div>
      )}
    </div>
  );
}
