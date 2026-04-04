import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Coins, ShoppingBag, ArrowUpRight, ArrowDownLeft, Gift, History, Loader2, Tag, Star, Send, Ticket, Check, X } from 'lucide-react';
import api from '../../services/api';

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TYPE_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    purchase: { label: 'Compra', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <ShoppingBag className="w-3 h-3" /> },
    admin_gift: { label: 'Regalo Admin', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Gift className="w-3 h-3" /> },
    admin_remove: { label: 'Removido', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <ArrowDownLeft className="w-3 h-3" /> },
    transfer_in: { label: 'Recibido', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <ArrowDownLeft className="w-3 h-3" /> },
    transfer_out: { label: 'Enviado', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <ArrowUpRight className="w-3 h-3" /> },
    marketplace_buy: { label: 'Marketplace', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <ShoppingBag className="w-3 h-3" /> },
};

export default function MeCoins() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [balance, setBalance] = useState<{ balance: number; currencyName: string; currencyIcon: string } | null>(null);
    const [packages, setPackages] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<number | null>(null);
    const [captureMessage, setCaptureMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [customCoins, setCustomCoins] = useState<string>('');
    const [purchasingCustom, setPurchasingCustom] = useState(false);

    // Coupon state
    const [couponCode, setCouponCode] = useState('');
    const [validatedCoupon, setValidatedCoupon] = useState<any>(null);
    const [validatingCoupon, setValidatingCoupon] = useState(false);
    const [couponError, setCouponError] = useState<string | null>(null);

    // Transfer state
    const [transferUsername, setTransferUsername] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferMessage, setTransferMessage] = useState('');
    const [transferring, setTransferring] = useState(false);
    const [transferResult, setTransferResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState<any>(null);

    // Capture PayPal return
    useEffect(() => {
        const status = searchParams.get('status');
        const orderId = searchParams.get('orderId') || localStorage.getItem('pendingCoinOrderId');

        if (status === 'return' && orderId) {
            localStorage.removeItem('pendingCoinOrderId');
            api.post('/coins/capture', { orderId })
                .then((res) => {
                    setCaptureMessage({ type: 'success', text: `Compra exitosa! Recibiste ${res.data.coinsAdded ?? ''} monedas.` });
                    api.get('/coins/balance').then(r => setBalance(r.data));
                })
                .catch((err) => {
                    console.error('Capture error:', err);
                    setCaptureMessage({ type: 'error', text: 'Error al procesar el pago. Contacta soporte si el problema persiste.' });
                });
            setSearchParams({}, { replace: true });
        } else if (status === 'cancel') {
            localStorage.removeItem('pendingCoinOrderId');
            setCaptureMessage({ type: 'error', text: 'Compra cancelada.' });
            setSearchParams({}, { replace: true });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Initial data load
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const balanceRes = await api.get('/coins/balance');
                setBalance(balanceRes.data);
            } catch (err) { console.error('Error loading balance:', err); }

            try {
                const packagesRes = await api.get('/coins/packages');
                setPackages(Array.isArray(packagesRes.data) ? packagesRes.data : []);
            } catch (err) { console.error('Error loading packages:', err); }

            try {
                const historyRes = await api.get('/coins/history?page=1');
                const items = historyRes.data.items ?? historyRes.data;
                setHistory(Array.isArray(items) ? items : []);
                if (Array.isArray(items) && items.length < 10) setHasMoreHistory(false);
            } catch (err) { console.error('Error loading history:', err); } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const loadMoreHistory = async () => {
        const nextPage = historyPage + 1;
        setLoadingHistory(true);
        try {
            const res = await api.get(`/coins/history?page=${nextPage}`);
            const items = res.data.items ?? res.data;
            setHistory(prev => [...prev, ...items]);
            setHistoryPage(nextPage);
            if (items.length < 10) setHasMoreHistory(false);
        } catch (err) {
            console.error('Error loading history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleBuyCustom = async () => {
        const coins = parseInt(customCoins);
        if (!coins || coins < 100 || coins > 5000) {
            setCaptureMessage({ type: 'error', text: 'Cantidad invalida. Minimo 100, maximo 5,000 coins.' });
            return;
        }
        setPurchasingCustom(true);
        try {
            const res = await api.post('/coins/buy', { packageId: 0, customCoins: coins });
            if (res.data.approvalUrl) {
                localStorage.setItem('pendingCoinOrderId', res.data.orderId);
                window.location.href = res.data.approvalUrl;
            }
        } catch (err) {
            console.error('Error purchasing custom:', err);
            setCaptureMessage({ type: 'error', text: 'Error al iniciar la compra.' });
        } finally {
            setPurchasingCustom(false);
        }
    };

    const handleValidateCoupon = async () => {
        if (!couponCode.trim()) return;
        setValidatingCoupon(true);
        setCouponError(null);
        setValidatedCoupon(null);
        try {
            // Validate against packageId 0 for a general check
            const res = await api.post('/coins/validate-code', { code: couponCode.trim(), packageId: 0 });
            if (res.data.valid) {
                setValidatedCoupon({ ...res.data, code: couponCode.trim() });
                setCouponError(null);
            } else {
                setCouponError(res.data.error || 'Codigo invalido');
                setValidatedCoupon(null);
            }
        } catch (err: any) {
            setCouponError(err?.response?.data?.error || 'Error al validar el codigo');
            setValidatedCoupon(null);
        } finally {
            setValidatingCoupon(false);
        }
    };

    const clearCoupon = () => {
        setCouponCode('');
        setValidatedCoupon(null);
        setCouponError(null);
    };

    const getDiscountedPrice = (pkg: any): { finalPrice: number; bonusCoins: number } | null => {
        if (!validatedCoupon) return null;
        // Check if coupon applies to this package (applicablePackageId check is server-side, but we can show for all if no restriction)
        const dt = validatedCoupon.discountType;
        const dv = validatedCoupon.discountValue;
        const price = pkg.priceUsd;

        if (dt === 'percentage') {
            return { finalPrice: Math.max(0, Math.round(price * (1 - dv / 100) * 100) / 100), bonusCoins: 0 };
        } else if (dt === 'fixed_amount') {
            return { finalPrice: Math.max(0, price - dv), bonusCoins: 0 };
        } else if (dt === 'bonus_coins') {
            return { finalPrice: price, bonusCoins: dv };
        }
        return null;
    };

    const handleBuy = async (packageId: number) => {
        setPurchasing(packageId);
        try {
            const res = await api.post('/coins/buy', {
                packageId,
                discountCode: validatedCoupon?.code || undefined,
            });
            if (res.data.free) {
                setCaptureMessage({ type: 'success', text: `Compra gratuita exitosa! Recibiste ${res.data.coinsReceived} monedas.` });
                setBalance((prev: any) => prev ? { ...prev, balance: res.data.newBalance } : prev);
                clearCoupon();
                // Refresh history
                try {
                    const historyRes = await api.get('/coins/history?page=1');
                    const items = historyRes.data.items ?? historyRes.data;
                    setHistory(Array.isArray(items) ? items : []);
                    setHistoryPage(1);
                    setHasMoreHistory(Array.isArray(items) && items.length >= 10);
                } catch { /* ignore */ }
            } else if (res.data.approvalUrl) {
                localStorage.setItem('pendingCoinOrderId', res.data.orderId);
                window.location.href = res.data.approvalUrl;
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Error al iniciar la compra. Intenta de nuevo.';
            console.error('Error purchasing package:', err);
            setCaptureMessage({ type: 'error', text: msg });
        } finally {
            setPurchasing(null);
        }
    };

    const handleUsernameChange = (value: string) => {
        setTransferUsername(value);
        if (searchTimeout) clearTimeout(searchTimeout);
        if (value.length < 2) {
            setUserSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const timeout = setTimeout(async () => {
            try {
                const res = await api.get(`/coins/search-users?q=${encodeURIComponent(value)}`);
                setUserSuggestions(Array.isArray(res.data) ? res.data : []);
                setShowSuggestions(true);
            } catch { setUserSuggestions([]); }
        }, 300);
        setSearchTimeout(timeout);
    };

    const selectUser = (user: any) => {
        setTransferUsername(user.login || user.discordUsername || user.displayName);
        setShowSuggestions(false);
        setUserSuggestions([]);
    };

    const handleTransfer = async () => {
        if (!transferUsername.trim()) {
            setTransferResult({ type: 'error', text: 'Ingresa un nombre de usuario.' });
            return;
        }
        const amt = parseInt(transferAmount);
        if (!amt || amt <= 0) {
            setTransferResult({ type: 'error', text: 'Ingresa una cantidad valida.' });
            return;
        }
        setTransferring(true);
        setTransferResult(null);
        try {
            const res = await api.post('/coins/transfer', {
                username: transferUsername.trim(),
                amount: amt,
                message: transferMessage.trim() || undefined,
            });
            setTransferResult({ type: 'success', text: `Transferencia exitosa! Enviaste ${amt} coins a ${transferUsername.trim()}.` });
            setBalance(prev => prev ? { ...prev, balance: res.data.newBalance } : prev);
            setTransferUsername('');
            setTransferAmount('');
            setTransferMessage('');
            // Refresh history
            try {
                const historyRes = await api.get('/coins/history?page=1');
                const items = historyRes.data.items ?? historyRes.data;
                setHistory(Array.isArray(items) ? items : []);
                setHistoryPage(1);
                setHasMoreHistory(Array.isArray(items) && items.length >= 10);
            } catch { /* ignore */ }
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Error al realizar la transferencia.';
            setTransferResult({ type: 'error', text: msg });
        } finally {
            setTransferring(false);
        }
    };

    const currencyName = balance?.currencyName || 'DecaCoins';

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{currencyName}</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">Tu moneda en la plataforma Decatron</p>
            </div>

            {/* Capture Message */}
            {captureMessage && (
                <div className={`rounded-xl p-4 border ${captureMessage.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <p className="font-semibold">{captureMessage.text}</p>
                </div>
            )}

            {/* Balance Card */}
            <div className="bg-gradient-to-r from-[#1a1b1e] to-[#2d2f36] rounded-2xl p-6 border border-[#374151] shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#eab308]/20 flex items-center justify-center flex-shrink-0">
                        <Coins className="w-8 h-8 text-[#eab308]" />
                    </div>
                    <div>
                        <p className="text-sm text-[#94a3b8]">Tu Balance</p>
                        <p className="text-4xl font-black text-white">{formatNumber(balance?.balance ?? 0)}</p>
                        <p className="text-sm text-[#94a3b8]">{currencyName}</p>
                    </div>
                </div>
            </div>

            {/* Coupon Section */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-2 mb-3">
                    <Ticket className="w-5 h-5 text-[#eab308]" />
                    <h2 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Codigo de descuento</h2>
                </div>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">Si tienes un codigo de descuento, ingresalo aqui para ver los precios rebajados.</p>

                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleValidateCoupon(); }}
                        placeholder="Ingresa tu codigo"
                        disabled={!!validatedCoupon}
                        className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white placeholder:text-gray-400 focus:border-[#eab308] focus:outline-none focus:ring-1 focus:ring-[#eab308] disabled:opacity-50 font-mono tracking-wider"
                    />
                    {validatedCoupon ? (
                        <button
                            onClick={clearCoupon}
                            className="flex items-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-all font-semibold text-sm"
                        >
                            <X className="w-4 h-4" />
                            Quitar
                        </button>
                    ) : (
                        <button
                            onClick={handleValidateCoupon}
                            disabled={validatingCoupon || !couponCode.trim()}
                            className="flex items-center gap-2 px-6 py-3 bg-[#eab308] hover:bg-yellow-600 text-black rounded-lg transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Validar
                        </button>
                    )}
                </div>

                {couponError && (
                    <div className="mt-3 rounded-lg p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold">
                        {couponError}
                    </div>
                )}

                {validatedCoupon && (
                    <div className="mt-3 rounded-lg p-3 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span>
                            Codigo aplicado: {' '}
                            {validatedCoupon.discountType === 'percentage' && `${validatedCoupon.discountValue}% de descuento`}
                            {validatedCoupon.discountType === 'fixed_amount' && `$${validatedCoupon.discountValue} USD de descuento`}
                            {validatedCoupon.discountType === 'bonus_coins' && `+${validatedCoupon.discountValue} coins bonus`}
                        </span>
                    </div>
                )}
            </div>

            {/* Packages Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <ShoppingBag className="w-5 h-5 text-[#2563eb]" />
                    <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Paquetes</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packages.map((pkg) => (
                        <div
                            key={pkg.id}
                            className={`bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border transition-all hover:shadow-lg ${pkg.isOffer ? 'border-[#eab308]/50' : 'border-[#e2e8f0] dark:border-[#374151]'}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">{pkg.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        {pkg.isOffer && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/30">
                                                <Tag className="w-3 h-3" />
                                                OFERTA
                                            </span>
                                        )}
                                        {pkg.firstPurchaseOnly && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-[#2563eb]/20 text-[#3b82f6] border border-[#2563eb]/30">
                                                <Star className="w-3 h-3" />
                                                PRIMERA COMPRA
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Coins className="w-6 h-6 text-[#eab308] flex-shrink-0" />
                            </div>

                            <div className="mb-4">
                                <p className="text-3xl font-black text-[#1e293b] dark:text-white">
                                    {formatNumber(pkg.coins)}
                                    <span className="text-sm font-normal text-[#64748b] dark:text-[#94a3b8] ml-1">monedas</span>
                                </p>
                                {pkg.bonusCoins > 0 && (
                                    <p className="text-sm font-bold text-green-400">+{formatNumber(pkg.bonusCoins)} bonus</p>
                                )}
                            </div>

                            {(() => {
                                const discount = getDiscountedPrice(pkg);
                                return (
                                    <>
                                        {discount && discount.bonusCoins > 0 && (
                                            <div className="mb-2">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/30">
                                                    <Ticket className="w-3 h-3" />
                                                    +{discount.bonusCoins} bonus coins con cupon
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                            <div>
                                                {discount && discount.finalPrice < pkg.priceUsd ? (
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm text-[#64748b] line-through">${pkg.priceUsd} USD</p>
                                                        <p className="text-xl font-black text-green-400">${discount.finalPrice.toFixed(2)} USD</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xl font-black text-[#2563eb]">${pkg.priceUsd} USD</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleBuy(pkg.id)}
                                                disabled={purchasing === pkg.id}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {purchasing === pkg.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <ShoppingBag className="w-4 h-4" />
                                                )}
                                                Comprar
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    ))}
                    {packages.length === 0 && (
                        <div className="col-span-2 text-center py-8 text-[#64748b] dark:text-[#94a3b8]">
                            No hay paquetes disponibles en este momento.
                        </div>
                    )}
                </div>

                {/* Custom Amount */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] mt-4">
                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-1">Cantidad personalizada</h3>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">Elige cuantas monedas quieres. Sin bonus. $1 = 100 coins.</p>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <input
                                type="number"
                                min="100"
                                max="5000"
                                step="100"
                                value={customCoins}
                                onChange={(e) => setCustomCoins(e.target.value)}
                                placeholder="100 - 5,000"
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#64748b]">coins</span>
                        </div>
                        <div className="text-center min-w-[80px]">
                            <p className="text-lg font-black text-[#2563eb]">
                                ${customCoins && parseInt(customCoins) >= 100 ? (parseInt(customCoins) / 100).toFixed(2) : '0.00'}
                            </p>
                            <p className="text-xs text-[#64748b]">USD</p>
                        </div>
                        <button
                            onClick={handleBuyCustom}
                            disabled={purchasingCustom || !customCoins || parseInt(customCoins) < 100 || parseInt(customCoins) > 5000}
                            className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {purchasingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                            Comprar
                        </button>
                    </div>
                </div>
            </div>

            {/* Transfer Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Send className="w-5 h-5 text-[#2563eb]" />
                    <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Transferir Coins</h2>
                </div>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">Envia coins a otro usuario de la plataforma.</p>

                    {transferResult && (
                        <div className={`rounded-xl p-3 border mb-4 ${transferResult.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                            <p className="font-semibold text-sm">{transferResult.text}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        <div className="relative">
                            <label className="block text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 font-semibold">Usuario</label>
                            <input
                                type="text"
                                value={transferUsername}
                                onChange={(e) => handleUsernameChange(e.target.value)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                onFocus={() => { if (userSuggestions.length > 0) setShowSuggestions(true); }}
                                placeholder="Buscar usuario..."
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                            />
                            {showSuggestions && userSuggestions.length > 0 && (
                                <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {userSuggestions.map((u) => (
                                        <button
                                            key={u.id}
                                            onClick={() => selectUser(u)}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] transition-colors text-left"
                                        >
                                            {u.profileImage ? (
                                                <img src={u.profileImage} alt="" className="w-7 h-7 rounded-full" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-[#374151] flex items-center justify-center text-xs font-bold text-white">
                                                    {(u.displayName || u.login || '?')[0].toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-[#1e293b] dark:text-white truncate">{u.displayName || u.login}</p>
                                                <p className="text-xs text-[#64748b] truncate">
                                                    {u.login && `@${u.login}`}
                                                    {u.discordUsername && u.login && ' · '}
                                                    {u.discordUsername && `Discord: ${u.discordUsername}`}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 font-semibold">Cantidad</label>
                            <input
                                type="number"
                                min="1"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                placeholder="Cantidad de coins"
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 font-semibold">Mensaje (opcional)</label>
                            <input
                                type="text"
                                value={transferMessage}
                                onChange={(e) => setTransferMessage(e.target.value)}
                                placeholder="Mensaje opcional"
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-white placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={handleTransfer}
                            disabled={transferring || !transferUsername.trim() || !transferAmount || parseInt(transferAmount) <= 0}
                            className="flex items-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Transferir
                        </button>
                    </div>
                </div>
            </div>

            {/* Transaction History */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <History className="w-5 h-5 text-[#2563eb]" />
                    <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Historial de Transacciones</h2>
                </div>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                    {history.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[#e2e8f0] dark:border-[#374151]">
                                            <th className="text-left px-4 py-3 text-[#64748b] dark:text-[#94a3b8] font-semibold">Fecha</th>
                                            <th className="text-left px-4 py-3 text-[#64748b] dark:text-[#94a3b8] font-semibold">Tipo</th>
                                            <th className="text-right px-4 py-3 text-[#64748b] dark:text-[#94a3b8] font-semibold">Monto</th>
                                            <th className="text-right px-4 py-3 text-[#64748b] dark:text-[#94a3b8] font-semibold hidden sm:table-cell">Balance</th>
                                            <th className="text-left px-4 py-3 text-[#64748b] dark:text-[#94a3b8] font-semibold hidden md:table-cell">Descripcion</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((tx, idx) => {
                                            const badge = TYPE_BADGES[tx.type] || { label: tx.type, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: null };
                                            const isPositive = tx.amount > 0;
                                            return (
                                                <tr key={tx.id ?? idx} className="border-b border-[#e2e8f0] dark:border-[#374151] last:border-b-0">
                                                    <td className="px-4 py-3 text-[#1e293b] dark:text-[#f8fafc] whitespace-nowrap">
                                                        {formatDate(tx.createdAt ?? tx.created_at)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border ${badge.color}`}>
                                                            {badge.icon}
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                        {isPositive ? '+' : ''}{formatNumber(tx.amount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-[#1e293b] dark:text-[#f8fafc] font-semibold hidden sm:table-cell">
                                                        {formatNumber(tx.balanceAfter ?? 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-[#64748b] dark:text-[#94a3b8] hidden md:table-cell">
                                                        {tx.description || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {hasMoreHistory && (
                                <div className="p-4 text-center border-t border-[#e2e8f0] dark:border-[#374151]">
                                    <button
                                        onClick={loadMoreHistory}
                                        disabled={loadingHistory}
                                        className="px-6 py-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all font-semibold text-sm disabled:opacity-50"
                                    >
                                        {loadingHistory ? (
                                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                        ) : null}
                                        Cargar mas
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-[#64748b] dark:text-[#94a3b8]">
                            <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>No hay transacciones aun.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
