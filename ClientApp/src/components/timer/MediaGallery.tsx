import { useState, useEffect } from 'react';
import { Upload, Trash2, Edit2, Copy, FolderOpen, Image as ImageIcon, Film, Music, AlertCircle } from 'lucide-react';
import api from '../../services/api';

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

interface MediaGalleryProps {
    onFileSelect?: (file: MediaFile) => void;
    selectedCategory?: string;
    selectedFileType?: string;
}

export default function MediaGallery({ onFileSelect, selectedCategory, selectedFileType }: MediaGalleryProps) {
    // Helper: Convierte 'audio' a 'sound' para compatibilidad con el backend
    const mapFileType = (type: string): string => {
        return type === 'audio' ? 'sound' : type;
    };

    const [files, setFiles] = useState<MediaFile[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
    const [filterCategory, setFilterCategory] = useState<string>(selectedCategory || 'all');
    const [filterType, setFilterType] = useState<string>(selectedFileType ? mapFileType(selectedFileType) : 'all');
    const [searchQuery, setSearchQuery] = useState('');
    const [storageInfo, setStorageInfo] = useState({ used: 0, max: 0, percentage: 0 });

    // Upload states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadCategory, setUploadCategory] = useState('general');
    const [uploadType, setUploadType] = useState<'image' | 'gif' | 'video' | 'audio'>('image');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Rename states
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameFileId, setRenameFileId] = useState<number | null>(null);
    const [newFileName, setNewFileName] = useState('');

    useEffect(() => {
        loadFiles();
        loadCategories();
    }, [filterCategory, filterType]);

    // Fix: Actualizar filtros cuando cambian los props
    useEffect(() => {
        if (selectedCategory && selectedCategory !== filterCategory) {
            setFilterCategory(selectedCategory);
        }
        if (selectedFileType) {
            const mappedType = mapFileType(selectedFileType);
            if (mappedType !== filterType) {
                setFilterType(mappedType);
            }
        }
    }, [selectedCategory, selectedFileType]);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterCategory !== 'all') params.append('category', filterCategory);
            if (filterType !== 'all') params.append('fileType', filterType);

            const res = await api.get(`/timer/media?${params.toString()}`);
            if (res.data.success) {
                setFiles(res.data.files);
                setStorageInfo({
                    used: res.data.totalStorageUsed,
                    max: res.data.maxStorageAllowed,
                    percentage: res.data.storageUsagePercentage
                });
            }
        } catch (error) {
            console.error('Error loading media files:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const res = await api.get('/timer/media/categories');
            if (res.data.success) {
                setCategories(res.data.all);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    const handleDelete = async (fileId: number) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) return;

        try {
            const res = await api.delete(`/timer/media/${fileId}`);
            if (res.data.success) {
                loadFiles();
            }
        } catch (error: any) {
            if (error.response?.data?.usageCount > 0) {
                const forceDelete = confirm(
                    `Este archivo se usa en ${error.response.data.usageCount} configuración(es). ¿Eliminar de todas formas?`
                );
                if (forceDelete) {
                    await api.delete(`/timer/media/${fileId}?force=true`);
                    loadFiles();
                }
            } else {
                alert('Error al eliminar archivo');
            }
        }
    };

    const copyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        alert('URL copiada al portapapeles');
    };

    const handleUpload = async () => {
        if (!uploadFile) {
            alert('Por favor selecciona un archivo');
            return;
        }

        try {
            setUploading(true);
            setUploadProgress(0);

            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('fileType', uploadType);
            formData.append('category', uploadCategory);

            const res = await api.post('/timer/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percentage);
                    }
                }
            });

            if (res.data.success) {
                alert('Archivo subido exitosamente');
                setShowUploadModal(false);
                setUploadFile(null);
                setUploadProgress(0);
                loadFiles(); // Recargar archivos
            }
        } catch (error: any) {
            if (error.response?.data?.message) {
                alert(`Error: ${error.response.data.message}`);
            } else {
                alert('Error al subir archivo');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFile(file);

            // Auto-detectar tipo de archivo por extensión (más fiable)
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            
            if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
                setUploadType('audio');
            } else if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
                setUploadType('video');
            } else if (ext === 'gif') {
                setUploadType('gif');
            } else if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp'].includes(ext)) {
                setUploadType('image');
            } else {
                // Fallback a MIME type
                if (file.type.startsWith('image/')) {
                    setUploadType(file.type === 'image/gif' ? 'gif' : 'image');
                } else if (file.type.startsWith('video/')) {
                    setUploadType('video');
                } else if (file.type.startsWith('audio/')) {
                    setUploadType('audio');
                }
            }
        }
    };

    const handleRename = async () => {
        if (!renameFileId || !newFileName.trim()) {
            alert('Por favor ingresa un nombre válido');
            return;
        }

        try {
            const res = await api.put(`/timer/media/${renameFileId}/rename`, {
                newFileName: newFileName.trim()
            });

            if (res.data.success) {
                alert('Archivo renombrado exitosamente');
                setShowRenameModal(false);
                setRenameFileId(null);
                setNewFileName('');
                loadFiles();
            }
        } catch (error: any) {
            if (error.response?.data?.message) {
                alert(`Error: ${error.response.data.message}`);
            } else {
                alert('Error al renombrar archivo');
            }
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = (fileType: string) => {
        switch (fileType) {
            case 'image':
            case 'gif':
                return <ImageIcon className="w-6 h-6" />;
            case 'video':
                return <Film className="w-6 h-6" />;
            case 'sound':
                return <Music className="w-6 h-6" />;
            default:
                return <AlertCircle className="w-6 h-6" />;
        }
    };

    const filteredFiles = files.filter(file =>
        file.originalFileName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header con estadísticas */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            Galería de Medios
                        </h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {filteredFiles.length} archivo(s) | {formatFileSize(storageInfo.used)} de {formatFileSize(storageInfo.max)}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Upload className="w-4 h-4" />
                            Subir Archivo
                        </button>
                        <div className="w-32">
                            <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`absolute top-0 left-0 h-full ${
                                        storageInfo.percentage > 80 ? 'bg-red-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-center mt-1 text-[#64748b] dark:text-[#94a3b8]">
                                {storageInfo.percentage.toFixed(0)}% usado
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <div className="grid grid-cols-3 gap-4">
                    {/* Búsqueda */}
                    <input
                        type="text"
                        placeholder="Buscar archivos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                    />

                    {/* Filtro por categoría */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                    >
                        <option value="all">Todas las categorías</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    {/* Filtro por tipo */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                    >
                        <option value="all">Todos los tipos</option>
                        <option value="image">Imágenes</option>
                        <option value="gif">GIFs</option>
                        <option value="video">Videos</option>
                        <option value="sound">Sonidos</option>
                    </select>
                </div>
            </div>

            {/* Grid de archivos */}
            {loading ? (
                <div className="text-center py-12 text-[#64748b] dark:text-[#94a3b8]">
                    Cargando archivos...
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151]">
                    <FolderOpen className="w-16 h-16 mx-auto mb-4 text-[#64748b] dark:text-[#94a3b8]" />
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        No hay archivos en esta categoría
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFiles.map(file => (
                        <div
                            key={file.id}
                            className={`bg-white dark:bg-[#1B1C1D] rounded-xl border-2 ${
                                selectedFile?.id === file.id
                                    ? 'border-blue-500'
                                    : 'border-[#e2e8f0] dark:border-[#374151]'
                            } p-4 cursor-pointer hover:border-blue-400 transition-all`}
                            onClick={() => {
                                setSelectedFile(file);
                                onFileSelect?.(file);
                            }}
                        >
                            {/* Preview */}
                            <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                                {file.fileType === 'image' || file.fileType === 'gif' ? (
                                    <img
                                        src={file.fileUrl}
                                        alt={file.originalFileName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : file.fileType === 'video' ? (
                                    file.thumbnailUrl ? (
                                        <img
                                            src={file.thumbnailUrl}
                                            alt={file.originalFileName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="text-[#64748b] dark:text-[#94a3b8]">
                                            {getFileIcon(file.fileType)}
                                        </div>
                                    )
                                ) : (
                                    <div className="text-[#64748b] dark:text-[#94a3b8]">
                                        {getFileIcon(file.fileType)}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm text-[#1e293b] dark:text-[#f8fafc] truncate" title={file.originalFileName}>
                                    {file.originalFileName}
                                </h3>
                                <div className="flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    <span>{formatFileSize(file.fileSize)}</span>
                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                        {file.category}
                                    </span>
                                </div>
                                {file.usageCount > 0 && (
                                    <div className="text-xs text-green-600 dark:text-green-400">
                                        ✓ Usado en {file.usageCount} config(s)
                                    </div>
                                )}
                            </div>

                            {/* Acciones */}
                            <div className="flex gap-2 mt-3 pt-3 border-t border-[#e2e8f0] dark:border-[#374151]">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        copyUrl(file.fileUrl);
                                    }}
                                    className="flex-1 px-2 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center justify-center gap-1"
                                    title="Copiar URL"
                                >
                                    <Copy className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRenameFileId(file.id);
                                        setNewFileName(file.originalFileName);
                                        setShowRenameModal(true);
                                    }}
                                    className="flex-1 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-1"
                                    title="Renombrar"
                                >
                                    <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(file.id);
                                    }}
                                    className="flex-1 px-2 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center gap-1"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Upload */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !uploading && setShowUploadModal(false)}>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                            Subir Archivo
                        </h3>

                        <div className="space-y-4">
                            {/* Selector de archivo */}
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                    Archivo
                                </label>
                                <input
                                    type="file"
                                    onChange={handleFileSelect}
                                    disabled={uploading}
                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    accept="image/*,video/*,audio/*"
                                />
                                {uploadFile && (
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        {uploadFile.name} ({formatFileSize(uploadFile.size)})
                                    </p>
                                )}
                            </div>

                            {/* Selector de categoría */}
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                    Categoría
                                </label>
                                <select
                                    value={uploadCategory}
                                    onChange={(e) => setUploadCategory(e.target.value)}
                                    disabled={uploading}
                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                >
                                    {categories.filter(c => c !== 'all').map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    El archivo se guardará en: /timerextensible/{'{username}'}/{uploadCategory}/
                                </p>
                            </div>

                            {/* Tipo de archivo (auto-detectado) */}
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                    Tipo de Archivo
                                </label>
                                <select
                                    value={uploadType}
                                    onChange={(e) => setUploadType(e.target.value as any)}
                                    disabled={uploading}
                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                >
                                    <option value="image">Imagen</option>
                                    <option value="gif">GIF Animado</option>
                                    <option value="video">Video</option>
                                    <option value="audio">Audio</option>
                                </select>
                            </div>

                            {/* Progress bar */}
                            {uploading && (
                                <div>
                                    <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="absolute top-0 left-0 h-full bg-blue-500 transition-all"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-center mt-1 text-[#64748b] dark:text-[#94a3b8]">
                                        Subiendo... {uploadProgress}%
                                    </p>
                                </div>
                            )}

                            {/* Botones */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    disabled={uploading}
                                    className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={!uploadFile || uploading}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? 'Subiendo...' : 'Subir'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Rename */}
            {showRenameModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRenameModal(false)}>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                            Renombrar Archivo
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                                    Nuevo Nombre
                                </label>
                                <input
                                    type="text"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    placeholder="mi-archivo.png"
                                    autoFocus
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    Solo se cambiará el nombre visible, no la extensión del archivo
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowRenameModal(false)}
                                    className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleRename}
                                    disabled={!newFileName.trim()}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Renombrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
