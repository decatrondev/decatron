import React, { useState, useEffect } from 'react';
import { Image, Plus, Trash2, CheckCircle, X, AlertCircle, ImagePlus, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaBanner } from '../../types';
import MediaSelector from '../../../../../components/timer/MediaSelector';

export const BannersTab: React.FC = () => {
    const [banners, setBanners] = useState<GachaBanner[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [bannerUrl, setBannerUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showMediaSelector, setShowMediaSelector] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const loadBanners = async () => {
        setLoading(true);
        try {
            const res = await api.get('/gacha/banners');
            setBanners(res.data.banners || []);
        } catch (err) {
            console.error('Error loading banners', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadBanners(); }, []);

    const handleCreate = async () => {
        if (!bannerUrl.trim()) return;
        setSubmitting(true);
        try {
            await api.post('/gacha/banners', { bannerUrl: bannerUrl.trim() });
            setBannerUrl('');
            setShowModal(false);
            loadBanners();
        } catch (err) {
            console.error('Error creating banner', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleActivate = async (id: number) => {
        try {
            await api.post(`/gacha/banners/${id}/activate`);
            loadBanners();
        } catch (err) {
            console.error('Error activating banner', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Eliminar este banner?')) return;
        try {
            await api.delete(`/gacha/banners/${id}`);
            loadBanners();
        } catch (err) {
            console.error('Error deleting banner', err);
        }
    };

    const isVideo = (url: string) => /\.(mp4|webm|ogg)(\?|$)/i.test(url);

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-ds-border">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-ds-accent rounded-lg">
                        <Image className="w-6 h-6 text-ds-on-accent" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-ds-text">Banners</h2>
                        <p className="text-sm text-ds-soft">Imagenes y videos para el overlay del gacha</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} disabled={banners.length >= 5} className="ds-btn ds-btn--primary">
                    <Plus className="w-4 h-4" /> Agregar Banner
                </button>
            </div>

            {/* Help Banner */}
            <div className="rounded-lg border border-ds-border bg-ds-bg overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-ds-soft flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-ds-soft">Como funcionan los banners</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-ds-soft">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Los banners son <strong className="text-ds-text">imagenes decorativas</strong> que se muestran en la pagina publica de coleccion</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span>Sube hasta <strong className="text-ds-text">5 banners</strong> y activa uno a la vez</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span>Se muestra en la parte superior de la coleccion cuando un viewer visita su pagina</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-ds-raised text-xs">
                            <strong className="text-ds-text">Tip:</strong> Usa imagenes horizontales (16:9) de buena calidad. Ideal para mostrar las cartas mas raras de tu gacha.
                        </div>
                    </div>
                )}
            </div>

            {/* Max notice */}
            <div className="flex items-center gap-2 p-3 bg-ds-warn/10 border border-ds-warn/40 rounded-lg">
                <AlertCircle className="w-4 h-4 text-ds-warn flex-shrink-0" />
                <p className="text-sm text-ds-warn">Maximo 5 banners. Actualmente: {banners.length}/5</p>
            </div>

            {/* Grid */}
            {loading ? (
                <p className="text-center text-ds-soft py-8">Cargando...</p>
            ) : banners.length === 0 ? (
                <p className="text-center text-ds-soft py-8">No hay banners configurados</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {banners.map((b) => (
                        <div key={b.id} className={`rounded-lg border-2 overflow-hidden transition-all ${b.isActive ? 'border-ds-ok/40 shadow-green-500/20' : 'border-ds-border '}`}>
                            {/* Preview */}
                            <div className="aspect-video bg-ds-bg relative">
                                {isVideo(b.bannerUrl) ? (
                                    <video src={b.bannerUrl} className="w-full h-full object-cover" muted loop autoPlay />
                                ) : b.bannerUrl ? (
                                    <img src={b.bannerUrl} alt="Banner" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-ds-soft">
                                        <span className="text-sm">Sin preview</span>
                                    </div>
                                )}
                                {/* Active badge */}
                                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${b.isActive ? 'bg-ds-accent text-ds-on-accent' : 'bg-ds-faint/80 text-ds-on-accent'}`}>
                                    {b.isActive ? 'Activo' : 'Inactivo'}
                                </div>
                            </div>
                            {/* Actions */}
                            <div className="p-3 bg-ds-surface flex items-center justify-between gap-2">
                                <p className="text-xs text-ds-soft truncate flex-1" title={b.bannerUrl}>
                                    {b.bannerUrl}
                                </p>
                                <div className="flex items-center gap-1">
                                    {!b.isActive && (
                                        <button onClick={() => handleActivate(b.id)} className="p-2 text-ds-ok hover:bg-ds-ok/10 rounded-lg transition-all" title="Activar">
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(b.id)} disabled={b.isActive} className="p-2 text-ds-danger hover:bg-ds-danger/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed" title={b.isActive ? 'No se puede eliminar el banner activo' : 'Eliminar'}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-ds-text">Nuevo Banner</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-ds-bg rounded-lg"><X className="w-5 h-5 text-ds-soft" /></button>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">Seleccionar imagen o video</label>
                            <button
                                type="button"
                                onClick={() => setShowMediaSelector(true)}
                                className="ds-btn ds-btn--secondary ds-btn--lg w-full"
                            >
                                <ImagePlus className="w-5 h-5" />
                                {bannerUrl ? 'Cambiar media' : 'Seleccionar de galeria'}
                            </button>
                        </div>
                        {bannerUrl && (
                            <div className="aspect-video bg-ds-bg rounded-lg overflow-hidden relative">
                                {isVideo(bannerUrl) ? (
                                    <video src={bannerUrl} className="w-full h-full object-cover" muted loop autoPlay />
                                ) : (
                                    <img src={bannerUrl} alt="Preview" className="w-full h-full object-cover" />
                                )}
                                <button onClick={() => setBannerUrl('')} className="ds-btn ds-btn--danger absolute top-2 right-2 w-6">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        <button onClick={handleCreate} disabled={!bannerUrl.trim() || submitting} className="ds-btn ds-btn--primary ds-btn--lg w-full">
                            {submitting ? 'Guardando...' : 'Crear Banner'}
                        </button>
                    </div>
                </div>
            )}

            {/* Media Selector */}
            <MediaSelector
                isOpen={showMediaSelector}
                onClose={() => setShowMediaSelector(false)}
                onSelect={(fileUrl) => {
                    setBannerUrl(fileUrl);
                    setShowMediaSelector(false);
                }}
                allowedTypes={['image', 'gif', 'video']}
                currentUrl={bannerUrl}
            />
        </div>
    );
};
