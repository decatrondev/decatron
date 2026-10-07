import { useState, useEffect } from 'react';
import { FolderOpen, FileText, ChevronLeft, Loader2, AlertCircle, Home, Clock, HardDrive, Archive, ArchiveRestore, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../services/api';
import './dev-docs.css';

interface FolderItem {
    name: string;
    path: string;
    type: 'folder';
    itemCount: number;
}

interface FileItem {
    name: string;
    path: string;
    type: 'file';
    size: number;
    lastModified: string;
}

interface BrowseResponse {
    success: boolean;
    currentPath: string;
    parentPath: string | null;
    folders: FolderItem[];
    files: FileItem[];
}

interface FileResponse {
    success: boolean;
    name: string;
    path: string;
    content: string;
    size: number;
    lastModified: string;
}

/** Archivar y restaurar solo existen para los planes: plans/ <-> archivados/plans/. */
type MoveAction = 'archive' | 'restore';
const moveActionOf = (path: string): MoveAction | null => {
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    return dir === 'plans' ? 'archive' : dir === 'archivados/plans' ? 'restore' : null;
};

export default function DevDocs() {
    const [currentPath, setCurrentPath] = useState('');
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [parentPath, setParentPath] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<FileResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    // La confirmacion va en la propia fila: mover un documento no se deshace sin saber donde quedo.
    const [confirmPath, setConfirmPath] = useState<string | null>(null);
    const [moving, setMoving] = useState(false);

    useEffect(() => {
        loadFolder(currentPath);
    }, [currentPath]);

    const loadFolder = async (path: string) => {
        try {
            setLoading(true);
            setError(null);
            setSelectedFile(null);
            const res = await api.get<BrowseResponse>(`/admin/dev-docs/browse?path=${encodeURIComponent(path)}`);
            setFolders(res.data.folders);
            setFiles(res.data.files);
            setParentPath(res.data.parentPath);
        } catch (err: any) {
            if (err.response?.status === 403) {
                setError('No tienes permisos para acceder a esta seccion.');
            } else {
                setError(err.response?.data?.message || 'Error cargando documentos');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadFile = async (path: string) => {
        try {
            setLoading(true);
            setError(null);
            const res = await api.get<FileResponse>(`/admin/dev-docs/read?path=${encodeURIComponent(path)}`);
            setSelectedFile(res.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error leyendo archivo');
        } finally {
            setLoading(false);
        }
    };

    const move = async (path: string, action: MoveAction) => {
        try {
            setMoving(true);
            setError(null);
            const res = await api.post<{ success: boolean; newPath: string }>('/admin/dev-docs/move', { path, action });
            const name = path.split('/').pop();
            setConfirmPath(null);
            await loadFolder(currentPath);
            setNotice(action === 'archive'
                ? `Archivado: ${name} (ahora en ${res.data.newPath.replace(/\/[^/]+$/, '')}/)`
                : `Restaurado: ${name} (ahora en ${res.data.newPath.replace(/\/[^/]+$/, '')}/)`);
        } catch (err: any) {
            setConfirmPath(null);
            setError(err.response?.data?.message || 'No se pudo mover el documento');
        } finally {
            setMoving(false);
        }
    };

    const moveLabel = (a: MoveAction) => (a === 'archive' ? 'Archivar' : 'Restaurar');

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Dev Docs</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Documentacion interna del proyecto (.dev/)
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            {notice && (
                <div role="status" className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-700 dark:text-green-300 flex-1">{notice}</p>
                    <button onClick={() => setNotice(null)} className="text-xs font-bold text-green-700 dark:text-green-300 hover:underline">Cerrar</button>
                </div>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
                <button
                    onClick={() => { setCurrentPath(''); setSelectedFile(null); }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                        !currentPath && !selectedFile
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold'
                            : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-gray-100 dark:hover:bg-[#262626]'
                    }`}
                >
                    <Home className="w-3.5 h-3.5" /> .dev
                </button>
                {breadcrumbs.map((crumb, i) => {
                    const crumbPath = breadcrumbs.slice(0, i + 1).join('/');
                    return (
                        <span key={crumbPath} className="flex items-center gap-2">
                            <span className="text-gray-400">/</span>
                            <button
                                onClick={() => { setCurrentPath(crumbPath); setSelectedFile(null); }}
                                className="text-[#64748b] dark:text-[#94a3b8] hover:text-blue-600 dark:hover:text-blue-400 transition"
                            >
                                {crumb}
                            </button>
                        </span>
                    );
                })}
                {selectedFile && (
                    <span className="flex items-center gap-2">
                        <span className="text-gray-400">/</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedFile.name}</span>
                    </span>
                )}
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            )}

            {/* File Viewer */}
            {selectedFile && !loading && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
                    {/* File header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#262626] rounded-lg transition"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-500" />
                            </button>
                            <FileText className="w-5 h-5 text-blue-500" />
                            <h2 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{selectedFile.name}</h2>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            {moveActionOf(selectedFile.path) && (() => {
                                const a = moveActionOf(selectedFile.path)!;
                                return confirmPath === selectedFile.path ? (
                                    <span className="flex items-center gap-2 text-sm">
                                        <span className="text-[#1e293b] dark:text-[#f8fafc] font-medium">¿{moveLabel(a)}?</span>
                                        <button disabled={moving} onClick={() => move(selectedFile.path, a)} className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50">Sí</button>
                                        <button disabled={moving} onClick={() => setConfirmPath(null)} className="px-3 py-1 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] font-bold">No</button>
                                    </span>
                                ) : (
                                    <button onClick={() => setConfirmPath(selectedFile.path)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm font-bold text-[#475569] dark:text-[#cbd5e1] hover:bg-gray-50 dark:hover:bg-[#262626]">
                                        {a === 'archive' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}{moveLabel(a)}
                                    </button>
                                );
                            })()}
                            <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" />{formatSize(selectedFile.size)}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDate(selectedFile.lastModified)}</span>
                        </div>
                    </div>

                    {/* Markdown content */}
                    <div className="p-6 markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedFile.content}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Folder Browser */}
            {!selectedFile && !loading && (
                <div className="space-y-3">
                    {/* Back button */}
                    {parentPath !== null && (
                        <button
                            onClick={() => setCurrentPath(parentPath)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] transition text-sm text-[#64748b] dark:text-[#94a3b8]"
                        >
                            <ChevronLeft className="w-4 h-4" /> Volver
                        </button>
                    )}

                    {/* Folders */}
                    {folders.map(folder => (
                        <button
                            key={folder.path}
                            onClick={() => setCurrentPath(folder.path)}
                            className="w-full flex items-center gap-4 px-5 py-4 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-left group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FolderOpen className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{folder.name}</h3>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                    {folder.itemCount} archivo{folder.itemCount !== 1 ? 's' : ''} .md
                                </p>
                            </div>
                            <span className="text-gray-400 group-hover:text-blue-500 transition">&rarr;</span>
                        </button>
                    ))}

                    {/* Files */}
                    {files.map(file => {
                        const action = moveActionOf(file.path);
                        return (
                            <div
                                key={file.path}
                                className="w-full flex items-center bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all group"
                            >
                                <button
                                    onClick={() => loadFile(file.path)}
                                    className="flex-1 min-w-0 flex items-center gap-4 px-5 py-4 text-left"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                        <FileText className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{file.name}</h3>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                            {formatSize(file.size)} &middot; {formatDate(file.lastModified)}
                                        </p>
                                    </div>
                                </button>

                                {action && (
                                    <div className="pr-4 shrink-0 flex items-center gap-2">
                                        {confirmPath === file.path ? (
                                            <>
                                                <span className="text-sm font-medium text-[#1e293b] dark:text-[#f8fafc]">¿{moveLabel(action)}?</span>
                                                <button disabled={moving} onClick={() => move(file.path, action)} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50">Sí</button>
                                                <button disabled={moving} onClick={() => setConfirmPath(null)} className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">No</button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmPath(file.path)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-sm font-bold text-[#475569] dark:text-[#cbd5e1] hover:bg-gray-50 dark:hover:bg-[#262626]"
                                            >
                                                {action === 'archive' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                                                {moveLabel(action)}
                                            </button>
                                        )}
                                    </div>
                                )}
                                {!action && <span className="pr-5 text-gray-400 group-hover:text-blue-500 transition">&rarr;</span>}
                            </div>
                        );
                    })}

                    {/* Empty state */}
                    {folders.length === 0 && files.length === 0 && (
                        <div className="text-center py-16 text-gray-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-bold">No hay documentos aqui</p>
                            <p className="text-sm mt-1">Esta carpeta no contiene archivos .md</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
