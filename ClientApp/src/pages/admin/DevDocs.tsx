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
        <div className="panel-scale space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-ds-text">Dev Docs</h1>
                <p className="text-ds-soft mt-1">
                    Documentacion interna del proyecto (.dev/)
                </p>
            </div>

            {error && (
                <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-ds-danger flex-shrink-0" />
                    <p className="text-sm text-ds-danger">{error}</p>
                </div>
            )}

            {notice && (
                <div role="status" className="bg-ds-ok/10 border border-ds-ok/40 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-ds-ok flex-shrink-0" />
                    <p className="text-sm text-ds-ok flex-1">{notice}</p>
                    <button onClick={() => setNotice(null)} className="text-xs font-bold text-ds-ok hover:underline">Cerrar</button>
                </div>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
                <button
                    onClick={() => { setCurrentPath(''); setSelectedFile(null); }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                        !currentPath && !selectedFile
                            ? 'bg-ds-accent/10 text-ds-accent-text font-bold'
                            : 'text-ds-soft hover:bg-ds-bg '
                    }`}
                >
                    <Home className="w-3.5 h-3.5" /> .dev
                </button>
                {breadcrumbs.map((crumb, i) => {
                    const crumbPath = breadcrumbs.slice(0, i + 1).join('/');
                    return (
                        <span key={crumbPath} className="flex items-center gap-2">
                            <span className="text-ds-soft">/</span>
                            <button
                                onClick={() => { setCurrentPath(crumbPath); setSelectedFile(null); }}
                                className="text-ds-soft hover:text-ds-accent-text transition"
                            >
                                {crumb}
                            </button>
                        </span>
                    );
                })}
                {selectedFile && (
                    <span className="flex items-center gap-2">
                        <span className="text-ds-soft">/</span>
                        <span className="text-ds-accent-text font-bold">{selectedFile.name}</span>
                    </span>
                )}
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
                </div>
            )}

            {/* File Viewer */}
            {selectedFile && !loading && (
                <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                    {/* File header */}
                    <div className="px-6 py-4 border-b border-ds-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="p-1.5 hover:bg-ds-bg rounded-lg transition"
                            >
                                <ChevronLeft className="w-5 h-5 text-ds-soft" />
                            </button>
                            <FileText className="w-5 h-5 text-ds-accent-text" />
                            <h2 className="font-bold text-ds-text">{selectedFile.name}</h2>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-ds-soft">
                            {moveActionOf(selectedFile.path) && (() => {
                                const a = moveActionOf(selectedFile.path)!;
                                return confirmPath === selectedFile.path ? (
                                    <span className="flex items-center gap-2 text-sm">
                                        <span className="text-ds-text font-medium">¿{moveLabel(a)}?</span>
                                        <button disabled={moving} onClick={() => move(selectedFile.path, a)} className="ds-btn ds-btn--primary ds-btn--sm">Sí</button>
                                        <button disabled={moving} onClick={() => setConfirmPath(null)} className="px-3 py-1 rounded-lg border border-ds-border text-ds-soft font-bold">No</button>
                                    </span>
                                ) : (
                                    <button onClick={() => setConfirmPath(selectedFile.path)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ds-border text-sm font-bold text-ds-soft hover:bg-ds-surface">
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
                            className="ds-btn ds-btn--secondary"
                        >
                            <ChevronLeft className="w-4 h-4" /> Volver
                        </button>
                    )}

                    {/* Folders */}
                    {folders.map(folder => (
                        <button
                            key={folder.path}
                            onClick={() => setCurrentPath(folder.path)}
                            className="w-full flex items-center gap-4 px-5 py-4 bg-ds-surface border border-ds-border rounded-lg hover:border-ds-accent transition-all text-left group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-ds-warn/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FolderOpen className="w-5 h-5 text-ds-accent-text" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-ds-text">{folder.name}</h3>
                                <p className="text-xs text-ds-soft mt-0.5">
                                    {folder.itemCount} archivo{folder.itemCount !== 1 ? 's' : ''} .md
                                </p>
                            </div>
                            <span className="text-ds-soft group-hover:text-ds-accent-text transition">&rarr;</span>
                        </button>
                    ))}

                    {/* Files */}
                    {files.map(file => {
                        const action = moveActionOf(file.path);
                        return (
                            <div
                                key={file.path}
                                className="w-full flex items-center bg-ds-surface border border-ds-border rounded-lg hover:border-ds-accent transition-all group"
                            >
                                <button
                                    onClick={() => loadFile(file.path)}
                                    className="flex-1 min-w-0 flex items-center gap-4 px-5 py-4 text-left"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-ds-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                                        <FileText className="w-5 h-5 text-ds-accent-text" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-ds-text truncate">{file.name}</h3>
                                        <p className="text-xs text-ds-soft mt-0.5">
                                            {formatSize(file.size)} &middot; {formatDate(file.lastModified)}
                                        </p>
                                    </div>
                                </button>

                                {action && (
                                    <div className="pr-4 shrink-0 flex items-center gap-2">
                                        {confirmPath === file.path ? (
                                            <>
                                                <span className="text-sm font-medium text-ds-text">¿{moveLabel(action)}?</span>
                                                <button disabled={moving} onClick={() => move(file.path, action)} className="ds-btn ds-btn--primary ds-btn--sm">Sí</button>
                                                <button disabled={moving} onClick={() => setConfirmPath(null)} className="px-3 py-1.5 rounded-lg border border-ds-border text-sm font-bold text-ds-soft">No</button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmPath(file.path)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ds-border text-sm font-bold text-ds-soft hover:bg-ds-surface"
                                            >
                                                {action === 'archive' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                                                {moveLabel(action)}
                                            </button>
                                        )}
                                    </div>
                                )}
                                {!action && <span className="pr-5 text-ds-soft group-hover:text-ds-accent-text transition">&rarr;</span>}
                            </div>
                        );
                    })}

                    {/* Empty state */}
                    {folders.length === 0 && files.length === 0 && (
                        <div className="text-center py-16 text-ds-soft">
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
