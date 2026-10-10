import { useState, useRef } from 'react';
import { X, Upload, Link, Volume2 } from 'lucide-react';

interface SoundFile {
    id: number;
    rewardId: string;
    rewardTitle: string;
    fileType: string;
    fileName: string;
    showImage: boolean;
    imageUrl?: string;
    imageSource: 'upload' | 'url';
    imagePath?: string;
    volume?: number | null;
}

interface EditSoundModalProps {
    file: SoundFile;
    onClose: () => void;
    onSave: (rewardId: string, data: FormData) => Promise<void>;
    saving: boolean;
}

export default function EditSoundModal({ file, onClose, onSave, saving }: EditSoundModalProps) {
    const [showImage, setShowImage] = useState(file.showImage);
    const [imageSource, setImageSource] = useState<'upload' | 'url'>(file.imageSource || 'upload');
    const [imageUrlInput, setImageUrlInput] = useState(file.imageUrl || '');
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [volume, setVolume] = useState<number | null>(file.volume ?? null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const currentImagePreview = newImageFile
        ? URL.createObjectURL(newImageFile)
        : imageSource === 'url' && imageUrlInput
        ? imageUrlInput
        : file.imagePath
        ? file.imagePath
        : null;

    const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 10 * 1024 * 1024) { alert('La imagen no puede superar los 10MB'); return; }
        setNewImageFile(f);
    };

    const handleSave = async () => {
        const fd = new FormData();
        fd.append('showImage', String(showImage));
        fd.append('imageSource', imageSource);
        fd.append('imageUrl', imageSource === 'url' ? imageUrlInput : '');
        if (imageSource === 'upload' && newImageFile) fd.append('imageFile', newImageFile);
        if (volume !== null) fd.append('volume', String(volume));
        await onSave(file.rewardId, fd);
    };

    return (
        <div className="fixed inset-0 bg-ds-input/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-ds-surface rounded-lg w-full max-w-md border border-ds-border">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-ds-border">
                    <h3 className="font-bold text-ds-text text-lg">Editar sonido</h3>
                    <button onClick={onClose} className="text-ds-soft hover:text-ds-text transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Reward title */}
                    <div className="bg-ds-bg rounded-lg px-4 py-2 text-sm text-ds-text">
                        🎵 {file.rewardTitle} — <span className="text-ds-soft">{file.fileName}</span>
                    </div>

                    {/* Show image toggle */}
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-ds-text">Mostrar imagen en overlay</p>
                            <p className="text-xs text-ds-soft mt-0.5">Si está desactivado, no se mostrará ninguna imagen ni icono</p>
                        </div>
                        <button
                            onClick={() => setShowImage(!showImage)}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${showImage ? 'bg-ds-accent' : 'bg-ds-raised '}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-ds-surface rounded-full transition-transform ${showImage ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Image source (only if showImage) */}
                    {showImage && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-ds-text">Fuente de imagen</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setImageSource('upload')}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${imageSource === 'upload' ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text' : 'border-ds-border text-ds-soft hover:border-ds-faint'}`}
                                >
                                    <Upload className="w-4 h-4" /> Subir archivo
                                </button>
                                <button
                                    onClick={() => setImageSource('url')}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${imageSource === 'url' ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text' : 'border-ds-border text-ds-soft hover:border-ds-faint'}`}
                                >
                                    <Link className="w-4 h-4" /> URL externa
                                </button>
                            </div>

                            {imageSource === 'upload' && (
                                <div>
                                    <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,.gif" onChange={handleImageFile} className="hidden" />
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-ds-border rounded-lg p-4 text-center hover:border-ds-accent transition-colors group"
                                    >
                                        {newImageFile ? (
                                            <p className="text-sm text-ds-ok">✓ {newImageFile.name}</p>
                                        ) : file.imagePath ? (
                                            <p className="text-sm text-ds-soft">Imagen actual: <span className="text-ds-text">{file.imagePath.split('/').pop()}</span> — click para cambiar</p>
                                        ) : (
                                            <p className="text-sm text-ds-soft group-hover:text-ds-accent-text">Click para subir PNG, JPG, JPEG o GIF (máx 10MB)</p>
                                        )}
                                    </button>
                                </div>
                            )}

                            {imageSource === 'url' && (
                                <input
                                    type="text"
                                    value={imageUrlInput}
                                    onChange={e => setImageUrlInput(e.target.value)}
                                    placeholder="https://ejemplo.com/imagen.gif"
                                    className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm text-ds-text placeholder-ds-soft focus:outline-none focus:border-ds-accent"
                                />
                            )}

                            {/* Preview */}
                            {currentImagePreview && (
                                <div className="rounded-lg overflow-hidden border border-ds-border bg-ds-bg flex items-center justify-center h-32">
                                    <img src={currentImagePreview} alt="preview" className="max-h-full max-w-full object-contain" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Volume */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-ds-text flex items-center gap-2"><Volume2 className="w-4 h-4" /> Volumen</p>
                            <span className="text-xs text-ds-soft">{volume === null ? 'Global' : `${volume}%`}</span>
                        </div>
                        <input
                            type="range" min={0} max={100} value={volume ?? 70}
                            onChange={e => setVolume(Number(e.target.value))}
                            className="w-full accent-ds-accent"
                        />
                        {volume !== null && (
                            <button onClick={() => setVolume(null)} className="text-xs text-ds-soft hover:text-ds-text">
                                Usar volumen global
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t border-ds-border">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-ds-border text-ds-soft text-sm font-medium hover:bg-ds-bg transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-lg bg-ds-accent hover:bg-ds-accent-hover disabled:opacity-50 text-ds-on-accent text-sm font-bold transition-colors"
                    >
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
