import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart3, Package, Tag, Users, FileText, UserPlus, Settings as SettingsIcon,
    Loader2, ArrowLeft, Coins, Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight,
    Check, X, AlertTriangle, Gift, ShoppingBag, ArrowDownLeft, ArrowUpRight, Send,
    ToggleLeft, ToggleRight, Save, RefreshCw
} from 'lucide-react';
import api from '../../services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function formatCurrency(n: number): string {
    return `$${n.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TYPE_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    purchase: { label: 'Compra', color: 'bg-ds-accent/20 text-ds-ok border-ds-ok/40', icon: <ShoppingBag className="w-3 h-3" /> },
    admin_give: { label: 'Regalo Admin', color: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/30', icon: <Gift className="w-3 h-3" /> },
    admin_remove: { label: 'Removido', color: 'bg-ds-danger-solid/20 text-ds-danger border-ds-danger/40', icon: <ArrowDownLeft className="w-3 h-3" /> },
    transfer_in: { label: 'Recibido', color: 'bg-ds-accent/20 text-ds-ok border-ds-ok/40', icon: <ArrowDownLeft className="w-3 h-3" /> },
    transfer_out: { label: 'Enviado', color: 'bg-ds-warn/20 text-ds-warn border-ds-warn/40', icon: <ArrowUpRight className="w-3 h-3" /> },
    marketplace_buy: { label: 'Marketplace', color: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/30', icon: <ShoppingBag className="w-3 h-3" /> },
    referral_bonus: { label: 'Referido', color: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/30', icon: <Users className="w-3 h-3" /> },
};

type TabId = 'dashboard' | 'packages' | 'discounts' | 'users' | 'audit' | 'referrals' | 'settings';

const tabs: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'packages',  label: 'Paquetes',  icon: Package },
    { id: 'discounts', label: 'Cupones',   icon: Tag },
    { id: 'users',     label: 'Usuarios',  icon: Users },
    { id: 'audit',     label: 'Auditoria', icon: FileText },
    { id: 'referrals', label: 'Referidos',  icon: UserPlus },
    { id: 'settings',  label: 'Configuracion', icon: SettingsIcon },
];

// ─── Dashboard Tab ──────────────────────────────────────────────────────────

function DashboardTab() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/coins/stats').then(r => { setStats(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    if (loading) return <LoadingSpinner />;

    if (!stats) return <p className="text-ds-soft text-center py-8">No se pudieron cargar las estadisticas</p>;

    const cards = [
        { label: 'Total en circulacion', value: formatNumber(stats.totalCoinsInCirculation), color: 'text-ds-warn', bg: 'bg-ds-warn/10' },
        { label: 'Total vendido', value: formatNumber(stats.totalCoinsSold), color: 'text-ds-ok', bg: 'bg-ds-accent/10' },
        { label: 'Ingresos totales', value: formatCurrency(stats.totalRevenue), color: 'text-ds-ok', bg: 'bg-ds-accent/10' },
        { label: 'Ingresos este mes', value: formatCurrency(stats.revenueThisMonth), color: 'text-ds-accent-text', bg: 'bg-ds-accent/10' },
        { label: 'Transacciones hoy', value: formatNumber(stats.transactionsToday), color: 'text-ds-accent-text', bg: 'bg-ds-accent/10' },
        { label: 'Total usuarios', value: formatNumber(stats.totalUsers), color: 'text-ds-accent-text', bg: 'bg-ds-accent/10' },
        { label: 'Usuarios flagged', value: formatNumber(stats.flaggedUsers), color: 'text-ds-danger', bg: 'bg-ds-danger-solid/10' },
        { label: 'Referidos pendientes', value: formatNumber(stats.pendingReferrals), color: 'text-ds-warn', bg: 'bg-ds-warn/10' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c, i) => (
                <div key={i} className="bg-ds-surface rounded-lg p-5 border border-ds-border">
                    <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center mb-3`}>
                        <Coins className={`w-5 h-5 ${c.color}`} />
                    </div>
                    <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-ds-soft mt-1 font-medium">{c.label}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Packages Tab ───────────────────────────────────────────────────────────

function PackagesTab() {
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        api.get('/admin/coins/packages').then(r => { setPackages(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!modal) return;
        setSaving(true);
        try {
            if (modal.mode === 'create') {
                await api.post('/admin/coins/packages', modal.data);
            } else {
                await api.put(`/admin/coins/packages/${modal.data.id}`, modal.data);
            }
            setModal(null);
            load();
        } catch (e: any) {
            alert(e.response?.data?.error || 'Error al guardar');
        }
        setSaving(false);
    };

    const toggleEnabled = async (pkg: any) => {
        try {
            await api.put(`/admin/coins/packages/${pkg.id}`, { ...pkg, enabled: !pkg.enabled });
            load();
        } catch { /* ignore */ }
    };

    if (loading) return <LoadingSpinner />;

    const emptyPkg = { name: '', description: '', coins: 0, bonusCoins: 0, priceUsd: 0, icon: '', isOffer: false, offerStartsAt: null, offerExpiresAt: null, firstPurchaseOnly: false, maxPerTransaction: 1, sortOrder: 0, enabled: true };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setModal({ mode: 'create', data: { ...emptyPkg } })} className="ds-btn ds-btn--primary">
                    <Plus className="w-4 h-4" /> Nuevo paquete
                </button>
            </div>

            <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-ds-border">
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Nombre</th>
                                <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Coins</th>
                                <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Bonus</th>
                                <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Precio</th>
                                <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Oferta</th>
                                <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Orden</th>
                                <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Estado</th>
                                <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.map(pkg => (
                                <tr key={pkg.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                    <td className="px-4 py-3 text-ds-text font-medium">{pkg.name}</td>
                                    <td className="px-4 py-3 text-right text-ds-text">{pkg.coins.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-ds-warn font-bold">{pkg.bonusCoins > 0 ? `+${pkg.bonusCoins}` : '-'}</td>
                                    <td className="px-4 py-3 text-right text-ds-ok font-bold">${pkg.priceUsd}</td>
                                    <td className="px-4 py-3 text-center">{pkg.isOffer ? <span className="text-ds-warn text-xs font-bold">OFERTA</span> : '-'}</td>
                                    <td className="px-4 py-3 text-center text-ds-soft">{pkg.sortOrder}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => toggleEnabled(pkg)} className="focus:outline-none">
                                            {pkg.enabled
                                                ? <ToggleRight className="w-6 h-6 text-ds-accent-text" />
                                                : <ToggleLeft className="w-6 h-6 text-ds-soft" />}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => setModal({ mode: 'edit', data: { ...pkg } })} className="p-1.5 hover:bg-ds-raised rounded-lg transition-colors">
                                            <Pencil className="w-4 h-4 text-ds-soft" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {packages.length === 0 && (
                                <tr><td colSpan={8} className="px-4 py-8 text-center text-ds-soft">No hay paquetes</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Package Modal */}
            {modal && (
                <Modal title={modal.mode === 'create' ? 'Nuevo paquete' : 'Editar paquete'} onClose={() => setModal(null)}>
                    <div className="space-y-4">
                        <FormField label="Nombre" value={modal.data.name} onChange={v => setModal({ ...modal, data: { ...modal.data, name: v } })} />
                        <FormField label="Descripcion" value={modal.data.description || ''} onChange={v => setModal({ ...modal, data: { ...modal.data, description: v } })} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Coins" type="number" value={modal.data.coins} onChange={v => setModal({ ...modal, data: { ...modal.data, coins: parseInt(v) || 0 } })} />
                            <FormField label="Bonus Coins" type="number" value={modal.data.bonusCoins} onChange={v => setModal({ ...modal, data: { ...modal.data, bonusCoins: parseInt(v) || 0 } })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Precio USD" type="number" value={modal.data.priceUsd} onChange={v => setModal({ ...modal, data: { ...modal.data, priceUsd: parseFloat(v) || 0 } })} />
                            <FormField label="Orden" type="number" value={modal.data.sortOrder} onChange={v => setModal({ ...modal, data: { ...modal.data, sortOrder: parseInt(v) || 0 } })} />
                        </div>
                        <FormField label="Icono" value={modal.data.icon || ''} onChange={v => setModal({ ...modal, data: { ...modal.data, icon: v } })} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormCheckbox label="Es oferta" checked={modal.data.isOffer} onChange={v => setModal({ ...modal, data: { ...modal.data, isOffer: v } })} />
                            <FormCheckbox label="Solo primera compra" checked={modal.data.firstPurchaseOnly} onChange={v => setModal({ ...modal, data: { ...modal.data, firstPurchaseOnly: v } })} />
                        </div>
                        <FormCheckbox label="Habilitado" checked={modal.data.enabled} onChange={v => setModal({ ...modal, data: { ...modal.data, enabled: v } })} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Max por transaccion" type="number" value={modal.data.maxPerTransaction} onChange={v => setModal({ ...modal, data: { ...modal.data, maxPerTransaction: parseInt(v) || 1 } })} />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => setModal(null)} className="px-4 py-2 bg-ds-bg text-ds-soft rounded-lg text-sm font-bold">Cancelar</button>
                            <button onClick={handleSave} disabled={saving} className="ds-btn ds-btn--primary">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── Discounts Tab ──────────────────────────────────────────────────────────

function DiscountsTab() {
    const [codes, setCodes] = useState<any[]>([]);
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: any } | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [userSearch, setUserSearch] = useState('');
    const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
    const [showUserSuggestions, setShowUserSuggestions] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState<any>(null);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            api.get('/admin/coins/discounts'),
            api.get('/admin/coins/packages'),
        ]).then(([discRes, pkgRes]) => {
            setCodes(discRes.data);
            setPackages(Array.isArray(pkgRes.data) ? pkgRes.data : []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    };

    const handleSave = async () => {
        if (!modal) return;
        setSaveError(null);

        // Validations
        if (!modal.data.code || modal.data.code.trim().length < 3) {
            setSaveError('El codigo debe tener al menos 3 caracteres');
            return;
        }
        if (modal.data.discountValue <= 0) {
            setSaveError('El valor debe ser mayor a 0');
            return;
        }
        if (modal.data.discountType === 'percentage' && modal.data.discountValue > 100) {
            setSaveError('El porcentaje no puede ser mayor a 100%');
            return;
        }
        // Check duplicate code on create
        if (modal.mode === 'create' && codes.some(c => c.code === modal.data.code)) {
            setSaveError('Este codigo ya existe');
            return;
        }

        setSaving(true);
        try {
            if (modal.mode === 'create') {
                await api.post('/admin/coins/discounts', modal.data);
            } else {
                await api.put(`/admin/coins/discounts/${modal.data.id}`, modal.data);
            }
            setModal(null);
            load();
        } catch (e: any) {
            setSaveError(e.response?.data?.error || 'Error al guardar');
        }
        setSaving(false);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Desactivar este cupon?')) return;
        try {
            await api.delete(`/admin/coins/discounts/${id}`);
            load();
        } catch { /* ignore */ }
    };

    const handleUserSearch = (value: string) => {
        setUserSearch(value);
        if (searchTimeout) clearTimeout(searchTimeout);
        if (value.length < 2) { setUserSuggestions([]); setShowUserSuggestions(false); return; }
        const timeout = setTimeout(async () => {
            try {
                const res = await api.get(`/coins/search-users?q=${encodeURIComponent(value)}`);
                setUserSuggestions(Array.isArray(res.data) ? res.data : []);
                setShowUserSuggestions(true);
            } catch { setUserSuggestions([]); }
        }, 300);
        setSearchTimeout(timeout);
    };

    if (loading) return <LoadingSpinner />;

    const emptyCode = { code: '', discountType: 'percentage', discountValue: 0, assignedUserId: null, maxUses: null, maxUsesPerUser: 1, minPurchaseUsd: 0, applicablePackageId: null, combinableWithFirstPurchase: true, startsAt: null, expiresAt: null };

    const discountTypeLabel: Record<string, string> = { percentage: 'Porcentaje', fixed_amount: 'Monto fijo', bonus_coins: 'Bonus coins' };
    const discountTypeBadge: Record<string, string> = {
        percentage: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/30',
        fixed_amount: 'bg-ds-accent/20 text-ds-ok border-ds-ok/40',
        bonus_coins: 'bg-ds-warn/20 text-ds-warn border-ds-warn/40',
    };

    const getStatus = (c: any): { label: string; color: string } => {
        if (!c.enabled) return { label: 'Deshabilitado', color: 'bg-ds-faint/10 text-ds-soft border-ds-border/30' };
        const now = new Date();
        if (c.startsAt && new Date(c.startsAt) > now) return { label: 'Programado', color: 'bg-ds-warn/10 text-ds-warn border-ds-warn/40' };
        if (c.expiresAt && new Date(c.expiresAt) < now) return { label: 'Expirado', color: 'bg-ds-danger-solid/10 text-ds-danger border-ds-danger/40' };
        if (c.maxUses && c.totalUses >= c.maxUses) return { label: 'Agotado', color: 'bg-ds-warn/10 text-ds-warn border-ds-warn/40' };
        return { label: 'Activo', color: 'bg-ds-accent/10 text-ds-ok border-ds-ok/40' };
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setModal({ mode: 'create', data: { ...emptyCode } })} className="ds-btn ds-btn--primary">
                    <Plus className="w-4 h-4" /> Nuevo cupon
                </button>
            </div>

            <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-ds-border">
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Codigo</th>
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Tipo</th>
                                <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Valor</th>
                                <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Usos</th>
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Vigencia</th>
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Asignado</th>
                                <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Paquete</th>
                                <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Estado</th>
                                <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codes.map(c => {
                                const status = getStatus(c);
                                const pkg = c.applicablePackageId ? packages.find((p: any) => p.id === c.applicablePackageId) : null;
                                return (
                                <tr key={c.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                    <td className="px-4 py-3 font-mono font-bold text-ds-text">{c.code}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${discountTypeBadge[c.discountType] || ''}`}>
                                            {discountTypeLabel[c.discountType] || c.discountType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-ds-warn font-bold">
                                        {c.discountType === 'percentage' ? `${c.discountValue}%` : c.discountType === 'bonus_coins' ? `+${c.discountValue} coins` : `$${c.discountValue}`}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-ds-soft">{c.totalUses ?? c.currentUses ?? 0}</span>
                                        <span className="text-ds-soft">/{c.maxUses ?? '∞'}</span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-ds-soft">
                                        {c.startsAt && <div>Desde: {formatDate(c.startsAt)}</div>}
                                        {c.expiresAt ? <div>Hasta: {formatDate(c.expiresAt)}</div> : <span>Sin limite</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-ds-soft">
                                        {c.assignedUserId ? `Usuario #${c.assignedUserId}` : 'Publico'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-ds-soft">
                                        {pkg ? pkg.name : c.applicablePackageId ? `#${c.applicablePackageId}` : 'Todos'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${status.color}`}>{status.label}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => { setModal({ mode: 'edit', data: { ...c } }); setSaveError(null); setUserSearch(''); }} className="p-1.5 hover:bg-ds-raised rounded-lg transition-colors">
                                                <Pencil className="w-4 h-4 text-ds-soft" />
                                            </button>
                                            {c.enabled && (
                                                <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-ds-danger-solid/10 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4 text-ds-danger" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                            {codes.length === 0 && (
                                <tr><td colSpan={9} className="px-4 py-8 text-center text-ds-soft">No hay cupones</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Discount Modal — Full version */}
            {modal && (
                <Modal title={modal.mode === 'create' ? 'Nuevo cupon' : 'Editar cupon'} onClose={() => { setModal(null); setSaveError(null); }}>
                    <div className="space-y-4">
                        {saveError && (
                            <div className="p-3 bg-ds-danger-solid/10 border border-ds-danger/40 rounded-lg text-sm text-ds-danger flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {saveError}
                            </div>
                        )}

                        {/* Code + Generate */}
                        <div>
                            <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">Codigo</label>
                            <div className="flex gap-2">
                                <input
                                    value={modal.data.code}
                                    onChange={e => setModal({ ...modal, data: { ...modal.data, code: e.target.value.toUpperCase() } })}
                                    placeholder="CODIGO"
                                    className="ds-input flex-1 font-mono"
                                />
                                <button
                                    onClick={() => setModal({ ...modal, data: { ...modal.data, code: generateCode() } })}
                                    className="px-3 py-2 bg-ds-raised hover:bg-ds-raised text-ds-text text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                                >
                                    Generar
                                </button>
                            </div>
                        </div>

                        {/* Type + Value */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">Tipo</label>
                                <select
                                    value={modal.data.discountType}
                                    onChange={e => setModal({ ...modal, data: { ...modal.data, discountType: e.target.value } })}
                                    className="ds-input w-full"
                                >
                                    <option value="percentage">Porcentaje (%)</option>
                                    <option value="fixed_amount">Monto fijo ($)</option>
                                    <option value="bonus_coins">Bonus coins (+coins)</option>
                                </select>
                            </div>
                            <FormField
                                label={modal.data.discountType === 'percentage' ? 'Porcentaje (%)' : modal.data.discountType === 'bonus_coins' ? 'Coins extra' : 'Monto USD ($)'}
                                type="number"
                                value={modal.data.discountValue}
                                onChange={v => setModal({ ...modal, data: { ...modal.data, discountValue: parseFloat(v) || 0 } })}
                            />
                        </div>

                        {/* Max uses */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Max usos total (vacio = ilimitado)" type="number" value={modal.data.maxUses ?? ''} onChange={v => setModal({ ...modal, data: { ...modal.data, maxUses: v ? parseInt(v) : null } })} />
                            <FormField label="Max usos por usuario" type="number" value={modal.data.maxUsesPerUser} onChange={v => setModal({ ...modal, data: { ...modal.data, maxUsesPerUser: parseInt(v) || 1 } })} />
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">Fecha inicio (opcional)</label>
                                <input
                                    type="datetime-local"
                                    value={modal.data.startsAt ? new Date(modal.data.startsAt).toISOString().slice(0, 16) : ''}
                                    onChange={e => setModal({ ...modal, data: { ...modal.data, startsAt: e.target.value || null } })}
                                    className="ds-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">Fecha expiracion (opcional)</label>
                                <input
                                    type="datetime-local"
                                    value={modal.data.expiresAt ? new Date(modal.data.expiresAt).toISOString().slice(0, 16) : ''}
                                    onChange={e => setModal({ ...modal, data: { ...modal.data, expiresAt: e.target.value || null } })}
                                    className="ds-input w-full"
                                />
                            </div>
                        </div>

                        {/* Assigned user */}
                        <div className="relative">
                            <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">Asignar a usuario (vacio = publico)</label>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <input
                                        value={userSearch || (modal.data.assignedUserId ? `Usuario #${modal.data.assignedUserId}` : '')}
                                        onChange={e => { handleUserSearch(e.target.value); if (!e.target.value) setModal({ ...modal, data: { ...modal.data, assignedUserId: null } }); }}
                                        onBlur={() => setTimeout(() => setShowUserSuggestions(false), 200)}
                                        placeholder="Buscar usuario..."
                                        className="ds-input w-full"
                                    />
                                    {showUserSuggestions && userSuggestions.length > 0 && (
                                        <div className="absolute z-50 top-full mt-1 w-full bg-ds-surface border border-ds-border rounded-lg max-h-36 overflow-y-auto">
                                            {userSuggestions.map((u: any) => (
                                                <button
                                                    key={u.id}
                                                    onClick={() => {
                                                        setModal({ ...modal, data: { ...modal.data, assignedUserId: u.id } });
                                                        setUserSearch(u.displayName || u.login);
                                                        setShowUserSuggestions(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ds-raised text-left text-sm"
                                                >
                                                    <span className="font-medium text-ds-text">{u.displayName || u.login}</span>
                                                    <span className="text-xs text-ds-soft">#{u.id}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {modal.data.assignedUserId && (
                                    <button onClick={() => { setModal({ ...modal, data: { ...modal.data, assignedUserId: null } }); setUserSearch(''); }} className="px-3 py-2 bg-ds-danger-solid/10 text-ds-danger rounded-lg text-xs font-bold">
                                        Quitar
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Applicable package */}
                        <div>
                            <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">Paquete aplicable</label>
                            <select
                                value={modal.data.applicablePackageId ?? ''}
                                onChange={e => setModal({ ...modal, data: { ...modal.data, applicablePackageId: e.target.value ? parseInt(e.target.value) : null } })}
                                className="ds-input w-full"
                            >
                                <option value="">Todos los paquetes</option>
                                {packages.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} — {p.coins} coins (${p.priceUsd})</option>
                                ))}
                            </select>
                        </div>

                        {/* Min purchase */}
                        <FormField label="Compra minima USD (0 = sin minimo)" type="number" value={modal.data.minPurchaseUsd} onChange={v => setModal({ ...modal, data: { ...modal.data, minPurchaseUsd: parseFloat(v) || 0 } })} />

                        {/* Combinable */}
                        <FormCheckbox label="Combinable con bonus de primera compra" checked={modal.data.combinableWithFirstPurchase} onChange={v => setModal({ ...modal, data: { ...modal.data, combinableWithFirstPurchase: v } })} />

                        {/* Preview */}
                        <div className="p-3 bg-ds-bg rounded-lg text-xs text-ds-soft">
                            <p className="font-bold mb-1">Vista previa:</p>
                            <p>
                                Codigo: <span className="font-mono text-ds-text">{modal.data.code || '---'}</span>
                                {' · '}
                                {modal.data.discountType === 'percentage' && `${modal.data.discountValue}% de descuento`}
                                {modal.data.discountType === 'fixed_amount' && `$${modal.data.discountValue} de descuento`}
                                {modal.data.discountType === 'bonus_coins' && `+${modal.data.discountValue} coins extra`}
                                {' · '}
                                {modal.data.assignedUserId ? 'Privado' : 'Publico'}
                                {' · '}
                                {modal.data.applicablePackageId ? `Solo paquete #${modal.data.applicablePackageId}` : 'Todos los paquetes'}
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => { setModal(null); setSaveError(null); }} className="px-4 py-2 bg-ds-bg text-ds-soft rounded-lg text-sm font-bold">Cancelar</button>
                            <button onClick={handleSave} disabled={saving} className="ds-btn ds-btn--primary">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab() {
    const [search, setSearch] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userDetails, setUserDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [actionAmount, setActionAmount] = useState('');
    const [actionDesc, setActionDesc] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState<any>(null);

    const doSearch = (q: string) => {
        setSearch(q);
        if (searchTimeout) clearTimeout(searchTimeout);
        if (q.length < 2) { setSuggestions([]); return; }
        const t = setTimeout(() => {
            api.get(`/coins/search-users?q=${encodeURIComponent(q)}`).then(r => setSuggestions(r.data)).catch(() => {});
        }, 300);
        setSearchTimeout(t);
    };

    const selectUser = async (user: any) => {
        setSelectedUser(user);
        setSuggestions([]);
        setSearch(user.displayName || user.login || '');
        setLoadingDetails(true);
        try {
            const r = await api.get(`/admin/coins/user/${user.id}`);
            setUserDetails(r.data);
        } catch {
            setUserDetails(null);
        }
        setLoadingDetails(false);
    };

    const giveCoins = async () => {
        if (!selectedUser || !actionAmount) return;
        setActionLoading(true);
        try {
            await api.post('/admin/coins/give', { userId: selectedUser.id, amount: parseInt(actionAmount), description: actionDesc || 'Admin give' });
            await selectUser(selectedUser);
            setActionAmount('');
            setActionDesc('');
        } catch (e: any) { alert(e.response?.data?.error || 'Error'); }
        setActionLoading(false);
    };

    const removeCoins = async () => {
        if (!selectedUser || !actionAmount) return;
        setActionLoading(true);
        try {
            await api.post('/admin/coins/remove', { userId: selectedUser.id, amount: parseInt(actionAmount), description: actionDesc || 'Admin remove' });
            await selectUser(selectedUser);
            setActionAmount('');
            setActionDesc('');
        } catch (e: any) { alert(e.response?.data?.error || 'Error'); }
        setActionLoading(false);
    };

    const changeStatus = async (status: string) => {
        if (!selectedUser) return;
        if (!window.confirm(`Cambiar estado a "${status}"?`)) return;
        try {
            await api.post(`/admin/coins/user/${selectedUser.id}/status`, { status });
            await selectUser(selectedUser);
        } catch (e: any) { alert(e.response?.data?.error || 'Error'); }
    };

    return (
        <div className="space-y-6">
            {/* Search */}
            <div className="relative">
                <div className="flex items-center gap-2 bg-ds-surface border border-ds-border rounded-lg px-4 py-2">
                    <Search className="w-4 h-4 text-ds-soft" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => doSearch(e.target.value)}
                        placeholder="Buscar usuario por nombre..."
                        className="flex-1 bg-transparent text-sm text-ds-text focus:outline-none placeholder-ds-soft"
                    />
                </div>
                {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-ds-surface border border-ds-border rounded-lg z-20 overflow-hidden">
                        {suggestions.map(u => (
                            <button
                                key={u.id}
                                onClick={() => selectUser(u)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ds-bg transition-colors text-left"
                            >
                                {u.profileImage && <img src={u.profileImage} className="w-8 h-8 rounded-full" alt="" />}
                                <div>
                                    <p className="text-sm font-bold text-ds-text">{u.displayName || u.login}</p>
                                    {u.discordUsername && <p className="text-xs text-ds-soft">Discord: {u.discordUsername}</p>}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* User Details */}
            {loadingDetails && <LoadingSpinner />}
            {userDetails && selectedUser && !loadingDetails && (
                <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        {selectedUser.profileImage && <img src={selectedUser.profileImage} className="w-12 h-12 rounded-full" alt="" />}
                        <div>
                            <h3 className="text-lg font-black text-ds-text">{selectedUser.displayName || selectedUser.login}</h3>
                            <p className="text-xs text-ds-soft">ID: {selectedUser.id}</p>
                        </div>
                        <div className="ml-auto">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                userDetails.economyStatus === 'normal' ? 'bg-ds-accent/10 text-ds-ok' :
                                userDetails.economyStatus === 'flagged' ? 'bg-ds-warn/10 text-ds-warn' :
                                'bg-ds-danger-solid/10 text-ds-danger'
                            }`}>
                                {userDetails.economyStatus}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatMini label="Balance" value={formatNumber(userDetails.balance)} />
                        <StatMini label="Total ganado" value={formatNumber(userDetails.totalEarned)} />
                        <StatMini label="Total gastado" value={formatNumber(userDetails.totalSpent)} />
                        <StatMini label="Primera compra" value={userDetails.firstPurchaseAt ? formatDate(userDetails.firstPurchaseAt) : 'Nunca'} />
                    </div>

                    {/* Actions */}
                    <div className="border-t border-ds-border pt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField label="Cantidad" type="number" value={actionAmount} onChange={setActionAmount} placeholder="100" />
                            <FormField label="Descripcion" value={actionDesc} onChange={setActionDesc} placeholder="Razon..." />
                            <div className="flex items-end gap-2">
                                <button onClick={giveCoins} disabled={actionLoading || !actionAmount} className="ds-btn ds-btn--primary">
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Dar
                                </button>
                                <button onClick={removeCoins} disabled={actionLoading || !actionAmount} className="ds-btn ds-btn--danger">
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Quitar
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-ds-soft mb-2 uppercase">Cambiar estado</label>
                            <div className="flex gap-2">
                                {['normal', 'flagged', 'banned_economy'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => changeStatus(s)}
                                        disabled={userDetails.economyStatus === s}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-30 ${
                                            s === 'normal' ? 'bg-ds-accent/10 text-ds-ok hover:bg-ds-accent/20' :
                                            s === 'flagged' ? 'bg-ds-warn/10 text-ds-warn hover:bg-ds-warn/20' :
                                            'bg-ds-danger-solid/10 text-ds-danger hover:bg-ds-danger-solid/20'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Audit Tab ──────────────────────────────────────────────────────────────

function AuditTab() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterType, setFilterType] = useState('');
    const [filterUserId, setFilterUserId] = useState('');

    const load = useCallback((p: number) => {
        setLoading(true);
        const params = new URLSearchParams({ page: p.toString() });
        if (filterType) params.set('type', filterType);
        if (filterUserId) params.set('userId', filterUserId);
        api.get(`/admin/coins/transactions?${params}`).then(r => {
            setTransactions(r.data.items);
            setTotalPages(r.data.totalPages);
            setPage(r.data.page);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [filterType, filterUserId]);

    useEffect(() => { load(1); }, [load]);

    const types = ['purchase', 'admin_give', 'admin_remove', 'transfer_in', 'transfer_out', 'marketplace_buy', 'referral_bonus'];

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="ds-input"
                >
                    <option value="">Todos los tipos</option>
                    {types.map(t => <option key={t} value={t}>{TYPE_BADGES[t]?.label || t}</option>)}
                </select>
                <input
                    type="text"
                    value={filterUserId}
                    onChange={e => setFilterUserId(e.target.value)}
                    placeholder="User ID..."
                    className="ds-input w-40"
                />
                <button onClick={() => load(1)} className="ds-btn ds-btn--primary">
                    <Search className="w-4 h-4" /> Filtrar
                </button>
            </div>

            {loading ? <LoadingSpinner /> : (
                <>
                    <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-ds-border">
                                        <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Fecha</th>
                                        <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Usuario</th>
                                        <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Tipo</th>
                                        <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Monto</th>
                                        <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Balance</th>
                                        <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Descripcion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(t => {
                                        const badge = TYPE_BADGES[t.type] || { label: t.type, color: 'bg-ds-faint/20 text-ds-soft border-ds-border/30', icon: null };
                                        return (
                                            <tr key={t.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                                <td className="px-4 py-3 text-xs text-ds-soft">{formatDate(t.createdAt)}</td>
                                                <td className="px-4 py-3 text-ds-text font-medium text-xs">{t.userName}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${badge.color}`}>
                                                        {badge.icon} {badge.label}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 text-right font-bold ${t.amount >= 0 ? 'text-ds-ok' : 'text-ds-danger'}`}>
                                                    {t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right text-ds-soft">{t.balanceAfter.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-xs text-ds-soft max-w-[200px] truncate">{t.description || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                    {transactions.length === 0 && (
                                        <tr><td colSpan={6} className="px-4 py-8 text-center text-ds-soft">No hay transacciones</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3">
                            <button onClick={() => load(page - 1)} disabled={page <= 1} className="p-2 bg-ds-surface border border-ds-border rounded-lg disabled:opacity-30">
                                <ChevronLeft className="w-4 h-4 text-ds-soft" />
                            </button>
                            <span className="text-sm text-ds-soft">Pagina {page} de {totalPages}</span>
                            <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="p-2 bg-ds-surface border border-ds-border rounded-lg disabled:opacity-30">
                                <ChevronRight className="w-4 h-4 text-ds-soft" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Referrals Tab ──────────────────────────────────────────────────────────

function ReferralsTab() {
    const [referrals, setReferrals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        api.get('/admin/coins/referrals').then(r => { setReferrals(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const reject = async (id: number) => {
        if (!window.confirm('Rechazar este referido?')) return;
        try {
            await api.post(`/admin/coins/referrals/${id}/reject`);
            load();
        } catch (e: any) { alert(e.response?.data?.error || 'Error'); }
    };

    if (loading) return <LoadingSpinner />;

    const statusColors: Record<string, string> = {
        pending: 'bg-ds-warn/10 text-ds-warn',
        completed: 'bg-ds-accent/10 text-ds-ok',
        rejected: 'bg-ds-danger-solid/10 text-ds-danger',
    };

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-ds-border">
                            <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Referidor</th>
                            <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Referido</th>
                            <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Codigo</th>
                            <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Estado</th>
                            <th className="text-right px-4 py-3 text-ds-soft font-bold text-xs uppercase">Bonus</th>
                            <th className="text-left px-4 py-3 text-ds-soft font-bold text-xs uppercase">Fecha</th>
                            <th className="text-center px-4 py-3 text-ds-soft font-bold text-xs uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {referrals.map(r => (
                            <tr key={r.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg">
                                <td className="px-4 py-3 text-ds-text font-medium">{r.referrerName}</td>
                                <td className="px-4 py-3 text-ds-text font-medium">{r.referredName}</td>
                                <td className="px-4 py-3 font-mono text-ds-soft text-xs">{r.referralCode}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColors[r.status] || 'bg-ds-faint/10 text-ds-soft'}`}>
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-ds-warn font-bold">
                                    {r.bonusGivenToReferrer > 0 ? `${r.bonusGivenToReferrer}/${r.bonusGivenToReferred}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-xs text-ds-soft">{formatDate(r.createdAt)}</td>
                                <td className="px-4 py-3 text-center">
                                    {r.status === 'pending' && (
                                        <button onClick={() => reject(r.id)} className="p-1.5 hover:bg-ds-danger-solid/10 rounded-lg transition-colors" title="Rechazar">
                                            <X className="w-4 h-4 text-ds-danger" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {referrals.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-ds-soft">No hay referidos</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Settings Tab ───────────────────────────────────────────────────────────

function SettingsTab() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        api.get('/admin/coins/settings').then(r => { setSettings(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await api.put('/admin/coins/settings', settings);
            setMessage({ type: 'success', text: 'Configuracion guardada correctamente' });
        } catch (e: any) {
            setMessage({ type: 'error', text: e.response?.data?.error || 'Error al guardar' });
        }
        setSaving(false);
    };

    if (loading) return <LoadingSpinner />;
    if (!settings) return <p className="text-ds-soft text-center py-8">No se pudo cargar la configuracion</p>;

    const update = (key: string, value: any) => setSettings({ ...settings, [key]: value });

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {message && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                    message.type === 'success' ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-danger/10 text-ds-danger '
                }`}>
                    {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            <div>
                <h3 className="text-lg font-black text-ds-text mb-4">General</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Nombre moneda" value={settings.currencyName} onChange={v => update('currencyName', v)} />
                    <FormField label="Icono moneda" value={settings.currencyIcon} onChange={v => update('currencyIcon', v)} />
                    <FormCheckbox label="Sistema habilitado" checked={settings.enabled} onChange={v => update('enabled', v)} />
                </div>
            </div>

            <div className="border-t border-ds-border pt-6">
                <h3 className="text-lg font-black text-ds-text mb-4">Transferencias</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Max coins por dia" type="number" value={settings.maxTransferPerDay} onChange={v => update('maxTransferPerDay', parseInt(v) || 0)} />
                    <FormField label="Max transferencias por dia" type="number" value={settings.maxTransfersPerDay} onChange={v => update('maxTransfersPerDay', parseInt(v) || 0)} />
                    <FormField label="Minimo por transferencia" type="number" value={settings.minTransferAmount} onChange={v => update('minTransferAmount', parseInt(v) || 0)} />
                    <FormField label="Edad minima para transferir (dias)" type="number" value={settings.minAccountAgeToTransferDays} onChange={v => update('minAccountAgeToTransferDays', parseInt(v) || 0)} />
                    <FormField label="Edad minima para recibir (dias)" type="number" value={settings.minAccountAgeToReceiveDays} onChange={v => update('minAccountAgeToReceiveDays', parseInt(v) || 0)} />
                </div>
            </div>

            <div className="border-t border-ds-border pt-6">
                <h3 className="text-lg font-black text-ds-text mb-4">Referidos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Max referidos por usuario" type="number" value={settings.maxReferralsPerUser ?? ''} onChange={v => update('maxReferralsPerUser', v ? parseInt(v) : null)} />
                    <FormField label="Bonus referidor" type="number" value={settings.referralBonusReferrer} onChange={v => update('referralBonusReferrer', parseInt(v) || 0)} />
                    <FormField label="Bonus referido" type="number" value={settings.referralBonusReferred} onChange={v => update('referralBonusReferred', parseInt(v) || 0)} />
                    <FormField label="Dias minimos actividad" type="number" value={settings.referralMinActivityDays} onChange={v => update('referralMinActivityDays', parseInt(v) || 0)} />
                </div>
            </div>

            <div className="border-t border-ds-border pt-6">
                <h3 className="text-lg font-black text-ds-text mb-4">Compras</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Bonus primera compra (%)" type="number" value={settings.firstPurchaseBonusPercent} onChange={v => update('firstPurchaseBonusPercent', parseInt(v) || 0)} />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-ds-border">
                <button onClick={handleSave} disabled={saving} className="ds-btn ds-btn--primary">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar configuracion
                </button>
            </div>
        </div>
    );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
        </div>
    );
}

function StatMini({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-3 bg-ds-bg rounded-lg">
            <p className="text-[10px] font-bold text-ds-soft mb-1 uppercase">{label}</p>
            <p className="text-lg font-black text-ds-text">{value}</p>
        </div>
    );
}

function FormField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: any; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <div>
            <label className="block text-xs font-bold text-ds-soft mb-1 uppercase">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="ds-input w-full"
            />
        </div>
    );
}

function FormCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer py-2">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded border-ds-border text-ds-accent-text focus:ring-ds-accent" />
            <span className="text-sm text-ds-text">{label}</span>
        </label>
    );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ds-input/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-ds-text">{title}</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-ds-raised rounded-lg transition-colors">
                        <X className="w-5 h-5 text-ds-soft" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminEconomy() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');

    const renderTab = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardTab />;
            case 'packages':  return <PackagesTab />;
            case 'discounts': return <DiscountsTab />;
            case 'users':     return <UsersTab />;
            case 'audit':     return <AuditTab />;
            case 'referrals': return <ReferralsTab />;
            case 'settings':  return <SettingsTab />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/admin')} className="p-2 hover:bg-ds-raised rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-ds-soft" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-ds-text">Economia</h1>
                    <p className="text-ds-soft mt-1">Gestiona DecaCoins, paquetes, cupones, referidos y usuarios</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                <div className="flex flex-wrap gap-2">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={activeTab === tab.id ? 'ds-btn ds-btn--primary whitespace-nowrap' : 'ds-btn ds-btn--secondary whitespace-nowrap'}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div>
                {renderTab()}
            </div>
        </div>
    );
}
