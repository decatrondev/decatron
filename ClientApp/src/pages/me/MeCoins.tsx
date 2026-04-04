import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Coins, ShoppingBag, ArrowUpRight, ArrowDownLeft, Gift, History, Loader2, Tag, Star } from 'lucide-react';
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

    const handleBuy = async (packageId: number) => {
        setPurchasing(packageId);
        try {
            const res = await api.post('/coins/buy', { packageId });
            if (res.data.approvalUrl) {
                localStorage.setItem('pendingCoinOrderId', res.data.orderId);
                window.location.href = res.data.approvalUrl;
            }
        } catch (err) {
            console.error('Error purchasing package:', err);
            setCaptureMessage({ type: 'error', text: 'Error al iniciar la compra. Intenta de nuevo.' });
        } finally {
            setPurchasing(null);
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

                            <div className="flex items-center justify-between pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                <p className="text-xl font-black text-[#2563eb]">${pkg.priceUsd} USD</p>
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
