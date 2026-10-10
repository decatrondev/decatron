import { useState } from 'react';
import { X, ExternalLink, Upload } from 'lucide-react';
import MediaGallery from './MediaGallery';

interface MediaFile {
    id: number;
    originalFileName: string;
    fileName: string;
    fileType: string;
    category: string;
    fileUrl: string;
    thumbnailUrl?: string;
    fileSize: number;
    uploadedAt: string;
    duration?: number;
    usageCount: number;
}

interface MediaSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (fileUrl: string, fileName: string) => void;
    allowedTypes?: string[]; // ['image', 'gif', 'video', 'sound']
    currentUrl?: string;
}

export default function MediaSelector({
    isOpen,
    onClose,
    onSelect,
    allowedTypes,
    currentUrl
}: MediaSelectorProps) {
    const [activeTab, setActiveTab] = useState<'gallery' | 'url'>('gallery');
    const [externalUrl, setExternalUrl] = useState(currentUrl || '');
    const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);

    if (!isOpen) return null;

    const handleSelect = () => {
        if (activeTab === 'gallery' && selectedFile) {
            onSelect(selectedFile.fileUrl, selectedFile.originalFileName);
            onClose();
        } else if (activeTab === 'url' && externalUrl) {
            onSelect(externalUrl, 'URL externa');
            onClose();
        }
    };

    const handleFileSelect = (file: MediaFile) => {
        setSelectedFile(file);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ds-input bg-opacity-50 backdrop-blur-sm">
            <div className="bg-ds-surface rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-ds-border">
                    <div>
                        <h2 className="text-2xl font-bold text-ds-text">
                            Seleccionar Archivo
                        </h2>
                        <p className="text-sm text-ds-soft mt-1">
                            Elige un archivo de tu galería o usa una URL externa
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-ds-bg rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-ds-soft" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-ds-border px-6">
                    <button
                        onClick={() => setActiveTab('gallery')}
                        className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                            activeTab === 'gallery'
                                ? 'border-ds-accent text-ds-accent-text '
                                : 'border-transparent text-ds-soft hover:text-ds-text '
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            Mis Archivos
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('url')}
                        className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                            activeTab === 'url'
                                ? 'border-ds-accent text-ds-accent-text '
                                : 'border-transparent text-ds-soft hover:text-ds-text '
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            URL Externa
                        </span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'gallery' ? (
                        <MediaGallery
                            onFileSelect={handleFileSelect}
                            // La lista entera, no solo el primero: un campo que acepta
                            // imagen y gif filtraba antes solo por imagen y escondia
                            // todos los gifs de la biblioteca.
                            selectedFileType={allowedTypes?.join(',')}
                        />
                    ) : (
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-ds-text mb-2">
                                    URL del archivo
                                </label>
                                <input
                                    type="url"
                                    value={externalUrl}
                                    onChange={(e) => setExternalUrl(e.target.value)}
                                    placeholder="https://ejemplo.com/imagen.png"
                                    className="w-full px-4 py-3 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent"
                                />
                            </div>

                            {externalUrl && (
                                <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4">
                                    <p className="text-sm text-ds-accent-text">
                                        ℹ️ Asegúrate de que la URL sea pública y accesible desde cualquier navegador.
                                    </p>
                                </div>
                            )}

                            {/* Preview de URL externa */}
                            {externalUrl && (externalUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) && (
                                <div className="bg-ds-bg rounded-lg p-4">
                                    <p className="text-sm font-semibold text-ds-text mb-2">
                                        Vista previa:
                                    </p>
                                    <img
                                        src={externalUrl}
                                        alt="Preview"
                                        className="max-w-full h-auto rounded-lg"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-ds-border bg-ds-surface">
                    <div className="text-sm text-ds-soft">
                        {activeTab === 'gallery' && selectedFile && (
                            <span>
                                Seleccionado: <strong className="text-ds-text">{selectedFile.originalFileName}</strong>
                            </span>
                        )}
                        {activeTab === 'url' && externalUrl && (
                            <span>
                                URL: <strong className="text-ds-text truncate max-w-md inline-block align-bottom">{externalUrl}</strong>
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 border border-ds-border rounded-lg text-ds-soft hover:bg-ds-bg font-semibold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSelect}
                            disabled={
                                (activeTab === 'gallery' && !selectedFile) ||
                                (activeTab === 'url' && !externalUrl)
                            }
                            className="px-6 py-2.5 bg-ds-accent hover:bg-ds-accent-hover disabled:bg-ds-faint disabled:cursor-not-allowed text-ds-on-accent rounded-lg font-semibold transition-colors"
                        >
                            Seleccionar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
