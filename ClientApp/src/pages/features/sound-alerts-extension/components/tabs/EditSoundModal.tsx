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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1e1e2e] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <h3 className="font-bold text-white text-lg">Editar sonido</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Reward title */}
                    <div className="bg-white/5 rounded-xl px-4 py-2 text-sm text-gray-300">
                        🎵 {file.rewardTitle} — <span className="text-gray-500">{file.fileName}</span>
                    </div>

                    {/* Show image toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-white">Mostrar imagen en overlay</p>
                            <p className="text-xs text-gray-500 mt-0.5">Si está desactivado, no se mostrará ninguna imagen ni icono</p>
                        </div>
                        <button
                            onClick={() => setShowImage(!showImage)}
                            className={`w-11 h-6 rounded-full transition-colors relative ${showImage ? 'bg-purple-500' : 'bg-gray-600'}`}
                        >
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${showImage ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    {/* Image source (only if showImage) */}
                    {showImage && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-white">Fuente de imagen</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setImageSource('upload')}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${imageSource === 'upload' ? 'border-purple-500 bg-purple-500/10 text-purple-300' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
                                >
                                    <Upload className="w-4 h-4" /> Subir archivo
                                </button>
                                <button
                                    onClick={() => setImageSource('url')}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${imageSource === 'url' ? 'border-purple-500 bg-purple-500/10 text-purple-300' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
                                >
                                    <Link className="w-4 h-4" /> URL externa
                                </button>
                            </div>

                            {imageSource === 'upload' && (
                                <div>
                                    <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,.gif" onChange={handleImageFile} className="hidden" />
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-white/20 rounded-xl p-4 text-center hover:border-purple-500/50 transition-colors group"
                                    >
                                        {newImageFile ? (
                                            <p className="text-sm text-green-400">✓ {newImageFile.name}</p>
                                        ) : file.imagePath ? (
                                            <p className="text-sm text-gray-400">Imagen actual: <span className="text-white">{file.imagePath.split('/').pop()}</span> — click para cambiar</p>
                                        ) : (
                                            <p className="text-sm text-gray-500 group-hover:text-gray-300">Click para subir PNG, JPG, JPEG o GIF (máx 10MB)</p>
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
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                                />
                            )}

                            {/* Preview */}
                            {currentImagePreview && (
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30 flex items-center justify-center h-32">
                                    <img src={currentImagePreview} alt="preview" className="max-h-full max-w-full object-contain" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Volume */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white flex items-center gap-2"><Volume2 className="w-4 h-4" /> Volumen</p>
                            <span className="text-xs text-gray-400">{volume === null ? 'Global' : `${volume}%`}</span>
                        </div>
                        <input
                            type="range" min={0} max={100} value={volume ?? 70}
                            onChange={e => setVolume(Number(e.target.value))}
                            className="w-full accent-purple-500"
                        />
                        {volume !== null && (
                            <button onClick={() => setVolume(null)} className="text-xs text-gray-500 hover:text-gray-300">
                                Usar volumen global
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t border-white/10">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/5 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                    >
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
