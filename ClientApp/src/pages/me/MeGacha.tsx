import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Globe, Lock, Eye, EyeOff, Dices, ChevronRight, ChevronDown, Check, Loader2, Star, Heart, X, Package } from 'lucide-react';
import api from '../../services/api';

const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; stars: string }> = {
    legendary: { label: 'Legendario', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', stars: '★★★★★' },
    epic:      { label: 'Epico',      color: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: '#a855f7', stars: '★★★★' },
    rare:      { label: 'Raro',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: '#3b82f6', stars: '★★★' },
    uncommon:  { label: 'Poco Comun', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: '#22c55e', stars: '★★' },
    common:    { label: 'Comun',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: '#94a3b8', stars: '★' },
};

function getJwtInfo() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return {
            username: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload['Name'] || payload['name'] || '',
            profileImage: payload['ProfileImage'] || undefined,
        };
    } catch { return null; }
}

interface Collection {
    channelName: string;
    banner?: string;
    participantId: number;
    uniqueCards: number;
    totalCards: number;
    totalAvailable: number;
    pullsUsed: number;
    pullsAvailable: number;
    totalDonated: number;
    isPrivate: boolean;
}

interface CardItem { id?: number; itemId: number; name: string; rarity: string; image?: string; quantity?: number; }

export default function MeGacha() {
    const jwt = useMemo(() => getJwtInfo(), []);
    const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
    const [termsChecked, setTermsChecked] = useState(false);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [globalPublic, setGlobalPublic] = useState(true);

    // Expanded channel state
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showcase, setShowcase] = useState<CardItem[]>([]);
    const [wishlist, setWishlist] = useState<CardItem[]>([]);
    const [inventory, setInventory] = useState<CardItem[]>([]);
    const [available, setAvailable] = useState<CardItem[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Editors
    const [editingShowcase, setEditingShowcase] = useState(false);
    const [selectedShowcase, setSelectedShowcase] = useState<number[]>([]);
    const [addingWishlist, setAddingWishlist] = useState(false);

    useEffect(() => { loadCollections(); }, []);

    const loadCollections = async () => {
        setLoading(true);
        try {
            const res = await api.get('/gacha/viewer/collections');
            if (res.data.termsRequired) { setTermsAccepted(false); }
            else {
                setTermsAccepted(true);
                setCollections(res.data.collections || []);
                setGlobalPublic((res.data.collections || []).every((c: Collection) => !c.isPrivate));
            }
        } catch { setTermsAccepted(false); }
        finally { setLoading(false); }
    };

    const acceptTerms = async () => {
        await api.post('/gacha/viewer/accept-terms');
        setTermsAccepted(true);
        loadCollections();
    };

    const toggleExpand = async (channelName: string, participantId: number) => {
        if (expanded === channelName) { setExpanded(null); return; }
        setExpanded(channelName);
        setEditingShowcase(false);
        setAddingWishlist(false);
        setDetailLoading(true);
        try {
            const [sRes, wRes] = await Promise.all([
                api.get(`/gacha/viewer/showcase/${participantId}`),
                api.get(`/gacha/viewer/wishlist/${participantId}`),
            ]);
            setShowcase(sRes.data.showcase || []);
            setWishlist(wRes.data.wishlist || []);
        } catch { /* silently fail */ }
        finally { setDetailLoading(false); }
    };

    const openShowcaseEditor = async (participantId: number) => {
        try {
            const res = await api.get(`/gacha/viewer/inventory/${participantId}`);
            setInventory(res.data.inventory || []);
        } catch { setInventory([]); }
        setSelectedShowcase(showcase.map(s => s.itemId));
        setEditingShowcase(true);
    };

    const saveShowcase = async (participantId: number) => {
        await api.post('/gacha/viewer/showcase', { participantId, itemIds: selectedShowcase });
        const res = await api.get(`/gacha/viewer/showcase/${participantId}`);
        setShowcase(res.data.showcase || []);
        setEditingShowcase(false);
    };

    const openWishlistAdder = async (participantId: number) => {
        try {
            const res = await api.get(`/gacha/viewer/wishlist/${participantId}/available`);
            setAvailable(res.data.items || []);
        } catch { setAvailable([]); }
        setAddingWishlist(true);
    };

    const addWishlist = async (participantId: number, itemId: number) => {
        await api.post('/gacha/viewer/wishlist', { participantId, itemId });
        setWishlist(prev => [...prev, available.find(a => a.itemId === itemId || (a as any).id === itemId) as CardItem].filter(Boolean));
        setAvailable(prev => prev.filter(a => (a.itemId || (a as any).id) !== itemId));
    };

    const removeWishlist = async (participantId: number, itemId: number) => {
        await api.delete(`/gacha/viewer/wishlist/${participantId}/${itemId}`);
        setWishlist(prev => prev.filter(w => w.itemId !== itemId));
    };

    const togglePrivacy = async (channel: string, isPrivate: boolean) => {
        await api.post('/gacha/viewer/privacy', { channel, isPublic: isPrivate });
        setCollections(prev => prev.map(c => c.channelName === channel ? { ...c, isPrivate: !isPrivate } : c));
    };

    const toggleGlobalPrivacy = async () => {
        const newVal = !globalPublic;
        await api.post('/gacha/viewer/privacy', { channel: null, isPublic: newVal });
        setGlobalPublic(newVal);
        setCollections(prev => prev.map(c => ({ ...c, isPrivate: !newVal })));
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                {jwt?.profileImage ? (
                    <img src={jwt.profileImage} alt="" className="w-14 h-14 rounded-2xl border-2 border-blue-600 shadow-lg" />
                ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white text-xl font-black shadow-lg">
                        {jwt?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                )}
                <div className="flex-1">
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2"><Dices className="w-7 h-7 text-blue-500" /> Mi Gacha</h1>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{jwt?.username} — Gestiona tus colecciones</p>
                </div>
                <Link to="/me" className="px-4 py-2 text-sm font-bold text-[#64748b] bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl">Volver</Link>
            </div>

            {/* Terms */}
            {termsAccepted === false && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-5">
                        <h2 className="text-xl font-black text-white flex items-center gap-2"><Shield className="w-6 h-6" /> Terminos del Gacha</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { icon: <Eye className="w-5 h-5 text-blue-500" />, title: 'Lectura de mensajes', desc: 'El bot lee mensajes en canales donde participas para procesar comandos' },
                                { icon: <Globe className="w-5 h-5 text-green-500" />, title: 'Colecciones publicas', desc: 'Por defecto son publicas. Puedes hacerlas privadas cuando quieras' },
                                { icon: <Shield className="w-5 h-5 text-orange-500" />, title: 'Control total', desc: 'Puedes desactivar todo o eliminar tu cuenta en cualquier momento' },
                            ].map((t, i) => (
                                <div key={i} className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1B1C1D] flex items-center justify-center mb-3">{t.icon}</div>
                                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">{t.title}</h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{t.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setTermsChecked(!termsChecked)}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${termsChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                                    {termsChecked && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Acepto los terminos</span>
                            </label>
                            <button onClick={acceptTerms} disabled={!termsChecked} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl">Aceptar y Continuar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Collections */}
            {termsAccepted && (
                <>
                    {/* Global Privacy */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {globalPublic ? <Globe className="w-5 h-5 text-green-500" /> : <Lock className="w-5 h-5 text-red-400" />}
                            <div>
                                <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{globalPublic ? 'Colecciones publicas' : 'Colecciones privadas'}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{globalPublic ? 'Cualquiera puede ver' : 'Solo tu puedes ver'}</p>
                            </div>
                        </div>
                        <button onClick={toggleGlobalPrivacy} className={`w-12 h-7 rounded-full transition ${globalPublic ? 'bg-green-500' : 'bg-gray-400'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${globalPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {collections.length === 0 ? (
                        <div className="text-center py-16 text-[#64748b]">
                            <Dices className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="font-bold">No tienes colecciones aun</p>
                            <p className="text-sm mt-1">Participa en canales con Gacha para empezar</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {collections.map(col => {
                                const isExpanded = expanded === col.channelName;
                                const completion = col.totalAvailable > 0 ? Math.round((col.uniqueCards / col.totalAvailable) * 100) : 0;

                                return (
                                    <div key={col.channelName} className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden shadow-sm">
                                        {/* Channel Header (clickable) */}
                                        <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition" onClick={() => toggleExpand(col.channelName, col.participantId)}>
                                            {/* Banner thumbnail */}
                                            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-[#e2e8f0] dark:border-[#374151]">
                                                {col.banner ? <img src={col.banner} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-violet-600 to-blue-600" />}
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">{col.channelName}</h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.isPrivate ? 'bg-red-100 dark:bg-red-900/20 text-red-600' : 'bg-green-100 dark:bg-green-900/20 text-green-600'}`}>
                                                        {col.isPrivate ? 'Privada' : 'Publica'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-4 mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                    <span><strong className="text-blue-500">{col.uniqueCards}</strong>/{col.totalAvailable} unicas</span>
                                                    <span><strong className="text-purple-500">{col.totalCards}</strong> total</span>
                                                    <span><strong className="text-green-500">{col.pullsUsed}</strong> tiros</span>
                                                    <span>{completion}% completado</span>
                                                </div>
                                            </div>
                                            <ChevronDown className={`w-5 h-5 text-[#64748b] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="border-t border-[#e2e8f0] dark:border-[#374151] p-5 space-y-5 bg-[#f8fafc] dark:bg-[#262626]">
                                                {detailLoading ? (
                                                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                                                ) : (
                                                    <>
                                                        {/* Actions */}
                                                        <div className="flex items-center justify-between">
                                                            <button onClick={() => togglePrivacy(col.channelName, col.isPrivate)} className="flex items-center gap-2 text-xs font-bold text-[#64748b] hover:text-blue-500 transition">
                                                                {col.isPrivate ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                                {col.isPrivate ? 'Hacer publica' : 'Hacer privada'}
                                                            </button>
                                                            <Link to={`/gacha/collection?channel=${col.channelName}&user=${jwt?.username}`} className="flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-400">
                                                                Ver coleccion <ChevronRight className="w-3.5 h-3.5" />
                                                            </Link>
                                                        </div>

                                                        {/* Vitrina */}
                                                        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> Vitrina</h4>
                                                                <button onClick={() => editingShowcase ? setEditingShowcase(false) : openShowcaseEditor(col.participantId)} className="text-xs font-bold text-blue-500 hover:text-blue-400">
                                                                    {editingShowcase ? 'Cancelar' : 'Editar'}
                                                                </button>
                                                            </div>

                                                            {editingShowcase ? (
                                                                <div className="space-y-3">
                                                                    <p className="text-xs text-[#64748b]">Selecciona hasta 5 cartas ({selectedShowcase.length}/5)</p>
                                                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                                                                        {inventory.map(item => {
                                                                            const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
                                                                            const selected = selectedShowcase.includes(item.itemId);
                                                                            return (
                                                                                <div key={item.itemId} onClick={() => {
                                                                                    if (selected) setSelectedShowcase(prev => prev.filter(id => id !== item.itemId));
                                                                                    else if (selectedShowcase.length < 5) setSelectedShowcase(prev => [...prev, item.itemId]);
                                                                                }} className={`rounded-xl overflow-hidden border-2 cursor-pointer transition ${selected ? 'ring-2 ring-blue-500 opacity-100 scale-[1.03]' : 'opacity-60 hover:opacity-100'}`} style={{ borderColor: selected ? '#3b82f6' : rc.border }}>
                                                                                    <div className="aspect-[3/4] relative" style={{ backgroundColor: rc.bg }}>
                                                                                        {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6" style={{ color: rc.color, opacity: 0.2 }} /></div>}
                                                                                        {selected && <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                                                                                    </div>
                                                                                    <div className="p-1.5 bg-white dark:bg-[#1B1C1D] text-center">
                                                                                        <p className="text-[9px] font-bold truncate text-[#1e293b] dark:text-[#f8fafc]">{item.name}</p>
                                                                                        <p className="text-[8px]" style={{ color: rc.color }}>{rc.stars}</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <button onClick={() => saveShowcase(col.participantId)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg">Guardar Vitrina</button>
                                                                </div>
                                                            ) : showcase.length === 0 ? (
                                                                <p className="text-xs text-[#64748b] text-center py-3">Sin cartas en vitrina</p>
                                                            ) : (
                                                                <div className="flex gap-2 overflow-x-auto pb-1">
                                                                    {showcase.map(card => {
                                                                        const rc = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.common;
                                                                        return (
                                                                            <div key={card.itemId} className="flex-shrink-0 w-20 rounded-lg overflow-hidden border" style={{ borderColor: rc.border }}>
                                                                                <div className="aspect-square" style={{ backgroundColor: rc.bg }}>
                                                                                    {card.image ? <img src={card.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5" style={{ color: rc.color, opacity: 0.3 }} /></div>}
                                                                                </div>
                                                                                <p className="text-[9px] font-bold text-center py-1 truncate px-1">{card.name}</p>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Wishlist */}
                                                        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2"><Heart className="w-4 h-4 text-red-400" /> Lista de Deseos</h4>
                                                                <button onClick={() => addingWishlist ? setAddingWishlist(false) : openWishlistAdder(col.participantId)} className="text-xs font-bold text-blue-500 hover:text-blue-400">
                                                                    {addingWishlist ? 'Cerrar' : 'Agregar'}
                                                                </button>
                                                            </div>

                                                            {/* Current wishlist */}
                                                            {wishlist.length > 0 && (
                                                                <div className="flex gap-2 flex-wrap mb-3">
                                                                    {wishlist.map(w => {
                                                                        const rc = RARITY_CONFIG[w.rarity] || RARITY_CONFIG.common;
                                                                        return (
                                                                            <div key={w.itemId} className="flex items-center gap-2 px-2 py-1 rounded-lg border text-xs" style={{ borderColor: rc.border, backgroundColor: rc.bg }}>
                                                                                {w.image && <img src={w.image} alt="" className="w-5 h-5 rounded object-cover" />}
                                                                                <span className="font-bold" style={{ color: rc.color }}>{w.name}</span>
                                                                                <button onClick={() => removeWishlist(col.participantId, w.itemId)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            {wishlist.length === 0 && !addingWishlist && (
                                                                <p className="text-xs text-[#64748b] text-center py-3">Sin items en tu lista de deseos</p>
                                                            )}

                                                            {/* Available to add */}
                                                            {addingWishlist && (
                                                                <div className="space-y-2 pt-2 border-t border-[#e2e8f0] dark:border-[#374151]">
                                                                    <p className="text-xs text-[#64748b]">Cartas que no tienes — click para agregar</p>
                                                                    {available.length === 0 ? (
                                                                        <p className="text-xs text-[#64748b] text-center py-2">No hay cartas disponibles (ya tienes todas o estan en tu wishlist)</p>
                                                                    ) : (
                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                                            {available.map(item => {
                                                                                const id = item.itemId || (item as any).id;
                                                                                const name = item.name || (item as any).Name || `Item #${id}`;
                                                                                const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
                                                                                return (
                                                                                    <div key={id} onClick={() => addWishlist(col.participantId, id)} className="rounded-xl overflow-hidden border-2 cursor-pointer opacity-70 hover:opacity-100 hover:scale-[1.03] transition" style={{ borderColor: rc.border }}>
                                                                                        <div className="aspect-[3/4] relative" style={{ backgroundColor: rc.bg }}>
                                                                                            {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8" style={{ color: rc.color, opacity: 0.2 }} /></div>}
                                                                                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: rc.color, color: '#fff' }}>{rc.stars}</div>
                                                                                        </div>
                                                                                        <div className="p-2 bg-white dark:bg-[#1B1C1D] text-center">
                                                                                            <p className="text-[10px] font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{name}</p>
                                                                                            <p className="text-[9px]" style={{ color: rc.color }}>{rc.label}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
