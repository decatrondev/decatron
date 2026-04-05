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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <div>
                        <h2 className="text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            Seleccionar Archivo
                        </h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Elige un archivo de tu galería o usa una URL externa
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#e2e8f0] dark:border-[#374151] px-6">
                    <button
                        onClick={() => setActiveTab('gallery')}
                        className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                            activeTab === 'gallery'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
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
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
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
                            selectedFileType={allowedTypes?.[0]}
                        />
                    ) : (
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    URL del archivo
                                </label>
                                <input
                                    type="url"
                                    value={externalUrl}
                                    onChange={(e) => setExternalUrl(e.target.value)}
                                    placeholder="https://ejemplo.com/imagen.png"
                                    className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {externalUrl && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        ℹ️ Asegúrate de que la URL sea pública y accesible desde cualquier navegador.
                                    </p>
                                </div>
                            )}

                            {/* Preview de URL externa */}
                            {externalUrl && (externalUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) && (
                                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                                    <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
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
                <div className="flex items-center justify-between p-6 border-t border-[#e2e8f0] dark:border-[#374151] bg-gray-50 dark:bg-[#262626]">
                    <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                        {activeTab === 'gallery' && selectedFile && (
                            <span>
                                Seleccionado: <strong className="text-[#1e293b] dark:text-[#f8fafc]">{selectedFile.originalFileName}</strong>
                            </span>
                        )}
                        {activeTab === 'url' && externalUrl && (
                            <span>
                                URL: <strong className="text-[#1e293b] dark:text-[#f8fafc] truncate max-w-md inline-block align-bottom">{externalUrl}</strong>
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSelect}
                            disabled={
                                (activeTab === 'gallery' && !selectedFile) ||
                                (activeTab === 'url' && !externalUrl)
                            }
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                        >
                            Seleccionar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
