import React, { useState, useEffect } from 'react';
import { Image, Plus, Trash2, CheckCircle, X, AlertCircle, ImagePlus } from 'lucide-react';
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
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl">
                        <Image className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">Banners</h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Imagenes y videos para el overlay del gacha</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} disabled={banners.length >= 5} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all">
                    <Plus className="w-4 h-4" /> Agregar Banner
                </button>
            </div>

            {/* Max notice */}
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">Maximo 5 banners. Actualmente: {banners.length}/5</p>
            </div>

            {/* Grid */}
            {loading ? (
                <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando...</p>
            ) : banners.length === 0 ? (
                <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">No hay banners configurados</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {banners.map((b) => (
                        <div key={b.id} className={`rounded-2xl border-2 overflow-hidden transition-all ${b.isActive ? 'border-green-500 shadow-lg shadow-green-500/20' : 'border-[#e2e8f0] dark:border-[#374151]'}`}>
                            {/* Preview */}
                            <div className="aspect-video bg-[#f8fafc] dark:bg-[#262626] relative">
                                {isVideo(b.bannerUrl) ? (
                                    <video src={b.bannerUrl} className="w-full h-full object-cover" muted loop autoPlay />
                                ) : b.bannerUrl ? (
                                    <img src={b.bannerUrl} alt="Banner" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#64748b] dark:text-[#94a3b8]">
                                        <span className="text-sm">Sin preview</span>
                                    </div>
                                )}
                                {/* Active badge */}
                                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${b.isActive ? 'bg-green-500 text-white' : 'bg-gray-500/80 text-white'}`}>
                                    {b.isActive ? 'Activo' : 'Inactivo'}
                                </div>
                            </div>
                            {/* Actions */}
                            <div className="p-3 bg-white dark:bg-[#1B1C1D] flex items-center justify-between gap-2">
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate flex-1" title={b.bannerUrl}>
                                    {b.bannerUrl}
                                </p>
                                <div className="flex items-center gap-1">
                                    {!b.isActive && (
                                        <button onClick={() => handleActivate(b.id)} className="p-2 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-all" title="Activar">
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(b.id)} disabled={b.isActive} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed" title={b.isActive ? 'No se puede eliminar el banner activo' : 'Eliminar'}>
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-2xl w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Nuevo Banner</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="w-5 h-5 text-[#64748b]" /></button>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">Seleccionar imagen o video</label>
                            <button
                                type="button"
                                onClick={() => setShowMediaSelector(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-dashed border-[#94a3b8] dark:border-[#374151] rounded-xl text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:border-blue-400 transition"
                            >
                                <ImagePlus className="w-5 h-5" />
                                {bannerUrl ? 'Cambiar media' : 'Seleccionar de galeria'}
                            </button>
                        </div>
                        {bannerUrl && (
                            <div className="aspect-video bg-[#f8fafc] dark:bg-[#262626] rounded-xl overflow-hidden relative">
                                {isVideo(bannerUrl) ? (
                                    <video src={bannerUrl} className="w-full h-full object-cover" muted loop autoPlay />
                                ) : (
                                    <img src={bannerUrl} alt="Preview" className="w-full h-full object-cover" />
                                )}
                                <button onClick={() => setBannerUrl('')} className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        <button onClick={handleCreate} disabled={!bannerUrl.trim() || submitting} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-bold transition-all">
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
