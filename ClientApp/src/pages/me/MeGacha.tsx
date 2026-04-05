import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Globe, Lock, Eye, EyeOff, Dices, ChevronRight, ChevronDown, Check, ExternalLink, Loader2, Star, Heart, X, Plus, Package } from 'lucide-react';
import api from '../../services/api';

interface JwtInfo {
    username: string;
    profileImage?: string;
}

function getJwtInfo(): JwtInfo | null {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return {
            username: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload['Name'] || payload['name'] || payload['unique_name'] || '',
            profileImage: payload['ProfileImage'] || payload['profileImage'] || undefined,
        };
    } catch {
        return null;
    }
}

interface ChannelCollection {
    channelName: string;
    banner?: string;
    uniqueCards: number;
    totalCards: number;
    totalAvailable: number;
    pullsUsed: number;
    pullsAvailable: number;
    totalDonated: number;
    isPrivate: boolean;
    participantId?: number;
}

interface ShowcaseItem {
    itemId: number;
    name: string;
    rarity: string;
    image?: string;
    position: number;
}

interface WishlistItem {
    itemId: number;
    name: string;
    rarity: string;
    image?: string;
}

interface InventoryItem {
    id: number;
    itemId: number;
    name: string;
    rarity: string;
    image?: string;
    quantity: number;
}

interface AvailableItem {
    id: number;
    name: string;
    rarity: string;
    image?: string;
}

interface ChannelExpandedData {
    showcase: ShowcaseItem[];
    showcaseLoading: boolean;
    showcaseEditing: boolean;
    showcaseInventory: InventoryItem[];
    showcaseSelected: number[];
    showcaseSaving: boolean;
    wishlist: WishlistItem[];
    wishlistLoading: boolean;
    wishlistAdding: boolean;
    wishlistAvailable: AvailableItem[];
}

const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; stars: string }> = {
    legendary: { label: 'Legendario', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', stars: '★★★★★' },
    epic:      { label: 'Epico',      color: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: '#a855f7', stars: '★★★★' },
    rare:      { label: 'Raro',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: '#3b82f6', stars: '★★★' },
    uncommon:  { label: 'Poco Comun', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: '#22c55e', stars: '★★' },
    common:    { label: 'Comun',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: '#94a3b8', stars: '★' },
};

const defaultExpandedData = (): ChannelExpandedData => ({
    showcase: [],
    showcaseLoading: false,
    showcaseEditing: false,
    showcaseInventory: [],
    showcaseSelected: [],
    showcaseSaving: false,
    wishlist: [],
    wishlistLoading: false,
    wishlistAdding: false,
    wishlistAvailable: [],
});

export default function MeGacha() {
    const jwtInfo = useMemo(() => getJwtInfo(), []);
    const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
    const [termsChecked, setTermsChecked] = useState(false);
    const [acceptingTerms, setAcceptingTerms] = useState(false);
    const [collections, setCollections] = useState<ChannelCollection[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingChannel, setTogglingChannel] = useState<string | null>(null);
    const [togglingAll, setTogglingAll] = useState(false);
    const [globalPublic, setGlobalPublic] = useState(true);

    // Per-channel expanded state
    const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
    const [channelData, setChannelData] = useState<Record<string, ChannelExpandedData>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/gacha/viewer/collections');
            const data = res.data;
            if (data.termsRequired) {
                setTermsAccepted(false);
                setCollections([]);
            } else {
                setTermsAccepted(true);
                setCollections(data.collections || []);
                if (data.collections && data.collections.length > 0) {
                    setGlobalPublic(data.collections.every((c: ChannelCollection) => !c.isPrivate));
                }
            }
        } catch (err: any) {
            if (err?.response?.status === 403 || err?.response?.data?.requiresTerms) {
                setTermsAccepted(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptTerms = async () => {
        setAcceptingTerms(true);
        try {
            await api.post('/gacha/viewer/accept-terms');
            setTermsAccepted(true);
            loadData();
        } catch {
            alert('Error al aceptar los terminos');
        } finally {
            setAcceptingTerms(false);
        }
    };

    const handleTogglePrivacy = async (channel: string, currentlyPrivate: boolean) => {
        setTogglingChannel(channel);
        try {
            await api.post('/gacha/viewer/privacy', { channel, isPublic: currentlyPrivate });
            setCollections(prev => prev.map(c => c.channelName === channel ? { ...c, isPrivate: !currentlyPrivate } : c));
        } catch {
            alert('Error al cambiar privacidad');
        } finally {
            setTogglingChannel(null);
        }
    };

    const handleToggleAll = async () => {
        setTogglingAll(true);
        const newValue = !globalPublic;
        try {
            await api.post('/gacha/viewer/privacy', { channel: null, isPublic: newValue });
            setGlobalPublic(newValue);
            setCollections(prev => prev.map(c => ({ ...c, isPublic: newValue })));
        } catch {
            alert('Error al cambiar privacidad global');
        } finally {
            setTogglingAll(false);
        }
    };

    // --- Per-channel data helpers ---

    const getChannelData = (channelName: string): ChannelExpandedData => {
        return channelData[channelName] || defaultExpandedData();
    };

    const updateChannelData = useCallback((channelName: string, updates: Partial<ChannelExpandedData>) => {
        setChannelData(prev => ({
            ...prev,
            [channelName]: { ...(prev[channelName] || defaultExpandedData()), ...updates },
        }));
    }, []);

    const handleExpandChannel = async (col: ChannelCollection) => {
        const name = col.channelName;
        if (expandedChannel === name) {
            setExpandedChannel(null);
            return;
        }
        setExpandedChannel(name);
        const pid = col.participantId;
        if (!pid) return;

        // Only load if not already loaded
        const existing = channelData[name];
        if (existing && (existing.showcase.length > 0 || existing.wishlist.length > 0 || existing.showcaseLoading || existing.wishlistLoading)) return;

        updateChannelData(name, { showcaseLoading: true, wishlistLoading: true });
        try {
            const [showcaseRes, wishlistRes] = await Promise.all([
                api.get(`/gacha/viewer/showcase/${pid}`),
                api.get(`/gacha/viewer/wishlist/${pid}`),
            ]);
            updateChannelData(name, {
                showcase: showcaseRes.data.showcase || [],
                showcaseLoading: false,
                wishlist: wishlistRes.data.wishlist || [],
                wishlistLoading: false,
            });
        } catch {
            updateChannelData(name, { showcaseLoading: false, wishlistLoading: false });
        }
    };

    const loadShowcaseForChannel = async (col: ChannelCollection) => {
        const pid = col.participantId;
        if (!pid) return;
        updateChannelData(col.channelName, { showcaseLoading: true });
        try {
            const res = await api.get(`/gacha/viewer/showcase/${pid}`);
            updateChannelData(col.channelName, { showcase: res.data.showcase || [], showcaseLoading: false });
        } catch {
            updateChannelData(col.channelName, { showcaseLoading: false });
        }
    };

    const openShowcaseEditor = async (col: ChannelCollection) => {
        const pid = col.participantId;
        if (!pid) return;
        const data = getChannelData(col.channelName);
        try {
            const res = await api.get(`/gacha/viewer/inventory/${pid}`);
            updateChannelData(col.channelName, {
                showcaseInventory: res.data.inventory || [],
                showcaseSelected: data.showcase.map(s => s.itemId),
                showcaseEditing: true,
            });
        } catch { /* empty */ }
    };

    const toggleShowcaseItem = (channelName: string, itemId: number) => {
        const data = getChannelData(channelName);
        const prev = data.showcaseSelected;
        if (prev.includes(itemId)) {
            updateChannelData(channelName, { showcaseSelected: prev.filter(id => id !== itemId) });
        } else if (prev.length < 5) {
            updateChannelData(channelName, { showcaseSelected: [...prev, itemId] });
        }
    };

    const saveShowcase = async (col: ChannelCollection) => {
        const pid = col.participantId;
        if (!pid) return;
        const data = getChannelData(col.channelName);
        updateChannelData(col.channelName, { showcaseSaving: true });
        try {
            await api.post('/gacha/viewer/showcase', { participantId: pid, itemIds: data.showcaseSelected });
            await loadShowcaseForChannel(col);
            updateChannelData(col.channelName, { showcaseEditing: false, showcaseSaving: false });
        } catch {
            alert('Error al guardar vitrina');
            updateChannelData(col.channelName, { showcaseSaving: false });
        }
    };

    const loadWishlistForChannel = async (col: ChannelCollection) => {
        const pid = col.participantId;
        if (!pid) return;
        updateChannelData(col.channelName, { wishlistLoading: true });
        try {
            const res = await api.get(`/gacha/viewer/wishlist/${pid}`);
            updateChannelData(col.channelName, { wishlist: res.data.wishlist || [], wishlistLoading: false });
        } catch {
            updateChannelData(col.channelName, { wishlistLoading: false });
        }
    };

    const openWishlistAdder = async (col: ChannelCollection) => {
        const pid = col.participantId;
        if (!pid) return;
        try {
            const res = await api.get(`/gacha/viewer/wishlist/${pid}/available`);
            updateChannelData(col.channelName, { wishlistAvailable: res.data.items || [], wishlistAdding: true });
        } catch { /* empty */ }
    };

    const addToWishlist = async (col: ChannelCollection, itemId: number) => {
        const pid = col.participantId;
        if (!pid) return;
        try {
            await api.post('/gacha/viewer/wishlist', { participantId: pid, itemId });
            await loadWishlistForChannel(col);
            const data = getChannelData(col.channelName);
            updateChannelData(col.channelName, { wishlistAvailable: data.wishlistAvailable.filter(i => i.id !== itemId) });
        } catch {
            alert('Error al agregar a lista de deseos');
        }
    };

    const removeFromWishlist = async (col: ChannelCollection, itemId: number) => {
        const pid = col.participantId;
        if (!pid) return;
        try {
            await api.delete(`/gacha/viewer/wishlist/${pid}/${itemId}`);
            const data = getChannelData(col.channelName);
            updateChannelData(col.channelName, { wishlist: data.wishlist.filter(w => w.itemId !== itemId) });
        } catch {
            alert('Error al eliminar de lista de deseos');
        }
    };

    // --- Render ---

    if (loading) return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D] flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
    );

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D] text-gray-900 dark:text-white font-sans">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Header */}
                <div className="flex items-center gap-5">
                    {jwtInfo?.profileImage ? (
                        <img src={jwtInfo.profileImage} alt="Avatar" className="w-16 h-16 rounded-2xl border-2 border-blue-600 shadow-lg" />
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                            {jwtInfo?.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                    )}
                    <div className="flex-1">
                        <h1 className="text-3xl font-black flex items-center gap-3">
                            <Dices className="w-7 h-7 text-blue-500" /> Mi Gacha
                        </h1>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">{jwtInfo?.username || 'Usuario'} — Gestiona tus colecciones y privacidad</p>
                    </div>
                    <Link
                        to="/me"
                        className="px-4 py-2 text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:text-blue-500 dark:hover:text-blue-400 bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl transition"
                    >
                        Volver
                    </Link>
                </div>

                {/* Terms section */}
                {termsAccepted === false && (
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6">
                            <div className="flex items-center gap-3">
                                <Shield className="w-8 h-8 text-white" />
                                <div>
                                    <h2 className="text-xl font-black text-white">Terminos del Sistema Gacha</h2>
                                    <p className="text-sm text-blue-100">Lee y acepta antes de continuar</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Al usar el sistema Gacha de Decatron aceptas lo siguiente:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                                        <Eye className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">Lectura de mensajes</h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">El bot puede leer mensajes en los canales donde participas para procesar comandos del gacha</p>
                                </div>
                                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                                        <Globe className="w-5 h-5 text-green-500" />
                                    </div>
                                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">Colecciones publicas</h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Tus colecciones son publicas por defecto. Puedes hacerlas privadas en cualquier momento</p>
                                </div>
                                <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                                        <Shield className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1">Control total</h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Puedes desactivar funciones, hacer privadas tus colecciones o eliminar tu cuenta en cualquier momento</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div
                                        onClick={() => setTermsChecked(!termsChecked)}
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition cursor-pointer ${
                                            termsChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-400 dark:border-gray-600'
                                        }`}
                                    >
                                        {termsChecked && <Check className="w-4 h-4 text-white" />}
                                    </div>
                                    <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Acepto los terminos y condiciones</span>
                                </label>

                                <button
                                    onClick={handleAcceptTerms}
                                    disabled={!termsChecked || acceptingTerms}
                                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center gap-2"
                                >
                                    {acceptingTerms ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Aceptar y Continuar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Collections - only show after terms accepted */}
                {termsAccepted && (
                    <>
                        {/* Global privacy toggle */}
                        <div className="bg-white dark:bg-[#262626] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {globalPublic ? (
                                        <Globe className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <Lock className="w-5 h-5 text-red-400" />
                                    )}
                                    <div>
                                        <p className="text-sm font-bold">Todas mis colecciones publicas</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {globalPublic ? 'Cualquiera puede ver tus colecciones' : 'Tus colecciones estan ocultas'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleToggleAll}
                                    disabled={togglingAll}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${globalPublic ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                                >
                                    {togglingAll ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-white mx-auto" />
                                    ) : (
                                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${globalPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Collections list */}
                        {collections.length === 0 ? (
                            <div className="text-center py-16 text-gray-500">
                                <Dices className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-bold">No tienes colecciones aun</p>
                                <p className="text-sm mt-1">Participa en canales con Gacha habilitado para empezar</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5">
                                {collections.map(col => {
                                    const isExpanded = expandedChannel === col.channelName;
                                    const data = getChannelData(col.channelName);

                                    return (
                                        <div
                                            key={col.channelName}
                                            className="bg-white dark:bg-[#262626] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden transition"
                                            style={isExpanded ? { borderColor: 'rgba(59,130,246,0.5)' } : undefined}
                                        >
                                            {/* Channel header - clickable to expand */}
                                            <button
                                                onClick={() => handleExpandChannel(col)}
                                                className="w-full text-left"
                                            >
                                                <div className="flex items-stretch">
                                                    {/* Banner thumbnail */}
                                                    <div className="w-40 sm:w-52 flex-shrink-0 relative overflow-hidden">
                                                        {col.banner ? (
                                                            <img src={col.banner} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500" />
                                                        )}
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />
                                                        <div className="absolute bottom-2 left-3 flex items-center gap-2">
                                                            <h3 className="text-white font-bold text-sm drop-shadow-lg">{col.channelName}</h3>
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                !col.isPrivate
                                                                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                            }`}>
                                                                {!col.isPrivate ? 'Publica' : 'Privada'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Stats inline */}
                                                    <div className="flex-1 flex items-center px-5 py-4 gap-6">
                                                        <div className="flex gap-6">
                                                            <div className="text-center">
                                                                <p className="text-lg font-black text-blue-500">{col.uniqueCards}</p>
                                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">Unicas</p>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-lg font-black text-purple-500">{col.totalCards}</p>
                                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">Total</p>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-lg font-black text-green-500">{col.pullsUsed}</p>
                                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">Tiros</p>
                                                            </div>
                                                        </div>

                                                        {/* Completion bar */}
                                                        {col.totalAvailable > 0 && (
                                                            <div className="flex-1 max-w-xs hidden sm:block">
                                                                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                                                                    <span>Completado</span>
                                                                    <span>{col.uniqueCards}/{col.totalAvailable} ({Math.round((col.uniqueCards / col.totalAvailable) * 100)}%)</span>
                                                                </div>
                                                                <div className="h-2 bg-gray-200 dark:bg-[#1B1C1D] rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                                                        style={{ width: `${Math.round((col.uniqueCards / col.totalAvailable) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Expand arrow */}
                                                        <div className="ml-auto flex-shrink-0">
                                                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>

                                            {/* Expanded content */}
                                            {isExpanded && (
                                                <div className="border-t border-[#e2e8f0] dark:border-[#374151]">
                                                    {/* Actions row */}
                                                    <div className="flex items-center justify-between px-5 py-3 bg-[#f8fafc] dark:bg-[#1B1C1D]">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleTogglePrivacy(col.channelName, col.isPrivate); }}
                                                            disabled={togglingChannel === col.channelName}
                                                            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition"
                                                        >
                                                            {togglingChannel === col.channelName ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : !col.isPrivate ? (
                                                                <EyeOff className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <Eye className="w-3.5 h-3.5" />
                                                            )}
                                                            {!col.isPrivate ? 'Hacer privada' : 'Hacer publica'}
                                                        </button>

                                                        <Link
                                                            to={`/gacha/collection?channel=${encodeURIComponent(col.channelName)}&user=${encodeURIComponent(jwtInfo?.username || '')}`}
                                                            className="flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-400 transition"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            Ver coleccion <ExternalLink className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </div>

                                                    <div className="px-5 py-4 space-y-5">
                                                        {/* === Vitrina Section === */}
                                                        <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-4 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                                                        <Star className="w-4 h-4 text-yellow-400" /> Vitrina
                                                                    </h3>
                                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Hasta 5 cartas para mostrar en tu perfil</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => openShowcaseEditor(col)}
                                                                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                                                                >
                                                                    Editar
                                                                </button>
                                                            </div>

                                                            {data.showcaseLoading ? (
                                                                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
                                                            ) : data.showcase.length === 0 ? (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">No has seleccionado cartas para tu vitrina</p>
                                                            ) : (
                                                                <div className="flex gap-3 overflow-x-auto pb-1">
                                                                    {[...data.showcase].sort((a, b) => a.position - b.position).map(card => {
                                                                        const rc = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.common;
                                                                        return (
                                                                            <div key={card.itemId} className="flex-shrink-0 w-24 rounded-xl overflow-hidden border-2" style={{ borderColor: rc.border, boxShadow: `0 0 10px ${rc.color}30` }}>
                                                                                <div className="aspect-[3/4] relative" style={{ backgroundColor: rc.bg }}>
                                                                                    {card.image ? (
                                                                                        <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center">
                                                                                            <Package className="w-7 h-7" style={{ color: rc.color, opacity: 0.2 }} />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="p-1.5 bg-white dark:bg-[#262626] text-center">
                                                                                    <p className="text-[9px] font-bold truncate">{card.name}</p>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            {/* Showcase Editor */}
                                                            {data.showcaseEditing && (
                                                                <div className="border-t border-[#e2e8f0] dark:border-[#374151] pt-3 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-xs font-bold">Seleccionar cartas ({data.showcaseSelected.length}/5)</p>
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => updateChannelData(col.channelName, { showcaseEditing: false })}
                                                                                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-300 bg-transparent border border-[#e2e8f0] dark:border-[#374151] rounded-lg transition"
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => saveShowcase(col)}
                                                                                disabled={data.showcaseSaving}
                                                                                className="px-4 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-1.5"
                                                                            >
                                                                                {data.showcaseSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                                                Guardar
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
                                                                        {data.showcaseInventory.map(item => {
                                                                            const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
                                                                            const isSelected = data.showcaseSelected.includes(item.itemId);
                                                                            return (
                                                                                <button
                                                                                    key={item.itemId}
                                                                                    onClick={() => toggleShowcaseItem(col.channelName, item.itemId)}
                                                                                    className="rounded-lg overflow-hidden border-2 transition-all"
                                                                                    style={{
                                                                                        borderColor: isSelected ? rc.color : '#374151',
                                                                                        opacity: isSelected ? 1 : 0.6,
                                                                                        boxShadow: isSelected ? `0 0 8px ${rc.color}40` : 'none',
                                                                                    }}
                                                                                >
                                                                                    <div className="aspect-square relative" style={{ backgroundColor: rc.bg }}>
                                                                                        {item.image ? (
                                                                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                                                        ) : (
                                                                                            <div className="w-full h-full flex items-center justify-center">
                                                                                                <Package className="w-5 h-5" style={{ color: rc.color, opacity: 0.2 }} />
                                                                                            </div>
                                                                                        )}
                                                                                        {isSelected && (
                                                                                            <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                                                                                                <Check className="w-5 h-5 text-white" />
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="p-1 bg-white dark:bg-[#262626] text-center">
                                                                                        <p className="text-[8px] font-bold truncate">{item.name}</p>
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* === Wishlist Section === */}
                                                        <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-4 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                                                        <Heart className="w-4 h-4 text-pink-400" /> Lista de Deseos
                                                                    </h3>
                                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Cartas que quieres pero aun no tienes</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => openWishlistAdder(col)}
                                                                    className="px-3 py-1.5 text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition flex items-center gap-1.5"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" /> Agregar
                                                                </button>
                                                            </div>

                                                            {data.wishlistLoading ? (
                                                                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-pink-500" /></div>
                                                            ) : data.wishlist.length === 0 ? (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">Tu lista de deseos esta vacia</p>
                                                            ) : (
                                                                <div className="flex gap-3 overflow-x-auto pb-1">
                                                                    {data.wishlist.map(card => {
                                                                        const rc = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.common;
                                                                        return (
                                                                            <div key={card.itemId} className="flex-shrink-0 w-20 rounded-lg overflow-hidden border-2 relative group" style={{ borderColor: rc.border }}>
                                                                                <div className="aspect-square relative" style={{ backgroundColor: rc.bg }}>
                                                                                    {card.image ? (
                                                                                        <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center">
                                                                                            <Package className="w-5 h-5" style={{ color: rc.color, opacity: 0.2 }} />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="p-1 bg-white dark:bg-[#262626] text-center">
                                                                                    <p className="text-[8px] font-bold truncate">{card.name}</p>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => removeFromWishlist(col, card.itemId)}
                                                                                    className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                                                                >
                                                                                    <X className="w-3 h-3 text-white" />
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            {/* Wishlist Add Panel */}
                                                            {data.wishlistAdding && (
                                                                <div className="border-t border-[#e2e8f0] dark:border-[#374151] pt-3 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-xs font-bold">Cartas disponibles</p>
                                                                        <button
                                                                            onClick={() => updateChannelData(col.channelName, { wishlistAdding: false })}
                                                                            className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-300 bg-transparent border border-[#e2e8f0] dark:border-[#374151] rounded-lg transition"
                                                                        >
                                                                            Cerrar
                                                                        </button>
                                                                    </div>
                                                                    {data.wishlistAvailable.length === 0 ? (
                                                                        <p className="text-xs text-gray-500 text-center py-3">No hay cartas disponibles para agregar</p>
                                                                    ) : (
                                                                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
                                                                            {data.wishlistAvailable.map(item => {
                                                                                const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
                                                                                return (
                                                                                    <button
                                                                                        key={item.id}
                                                                                        onClick={() => addToWishlist(col, item.id)}
                                                                                        className="rounded-lg overflow-hidden border-2 transition-all hover:scale-105"
                                                                                        style={{ borderColor: rc.border }}
                                                                                    >
                                                                                        <div className="aspect-square relative" style={{ backgroundColor: rc.bg }}>
                                                                                            {item.image ? (
                                                                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                                                            ) : (
                                                                                                <div className="w-full h-full flex items-center justify-center">
                                                                                                    <Package className="w-5 h-5" style={{ color: rc.color, opacity: 0.2 }} />
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="p-1 bg-white dark:bg-[#262626] text-center">
                                                                                            <p className="text-[8px] font-bold truncate">{item.name}</p>
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* Footer */}
                <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-600">
                    Powered by <span className="font-bold text-gray-600 dark:text-gray-400">Decatron</span> Gacha System
                </div>
            </div>
        </div>
    );
}
