import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, Tag, Percent, DollarSign } from 'lucide-react';
import type { DiscountCode } from '../types';
import { CARD, INPUT, LABEL, EMPTY_CODE } from '../constants';
import { Toggle } from '../shared';
import api from '../../../../services/api';

export function CodesTab() {
    const [codes, setCodes] = useState<DiscountCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_CODE });
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadCodes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<DiscountCode[]>('/supporters/discount-codes');
            setCodes(res.data);
        } catch {
            setCodes([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCodes(); }, [loadCodes]);

    const handleCreate = async () => {
        if (!form.code.trim()) return;
        setSaving(true);
        setSaveMsg(null);
        try {
            await api.post('/supporters/discount-codes', form);
            setSaveMsg({ type: 'success', text: '✅ Código creado' });
            setForm({ ...EMPTY_CODE });
            setShowForm(false);
            loadCodes();
        } catch {
            setSaveMsg({ type: 'error', text: '❌ Error al crear el código' });
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(null), 4000);
        }
    };

    const handleToggle = async (code: DiscountCode) => {
        try {
            await api.patch(`/supporters/discount-codes/${code.id}`, { active: !code.active });
            setCodes(cs => cs.map(c => c.id === code.id ? { ...c, active: !c.active } : c));
        } catch { /* silent */ }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar este código?')) return;
        try {
            await api.delete(`/supporters/discount-codes/${id}`);
            setCodes(cs => cs.filter(c => c.id !== id));
        } catch { /* silent */ }
    };

    const TIER_OPTIONS_LOCAL = [
        { value: 'all', label: 'Todos los tiers' },
        { value: 'supporter', label: '⚡ Supporter' },
        { value: 'premium', label: '💎 Premium' },
        { value: 'fundador', label: '🌟 Fundador' },
    ];

    const discountLabel = (c: DiscountCode) =>
        c.discountType === 'percent' ? `${c.discountValue}%` : `$${c.discountValue}`;

    const tierLabel = (t: string) => TIER_OPTIONS_LOCAL.find(o => o.value === t)?.label ?? t;

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-black text-ds-text text-lg">Códigos de descuento</h3>
                    <p className="text-sm text-ds-soft mt-0.5">
                        Los usuarios los ingresan al momento del pago
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {saveMsg && (
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                            saveMsg.type === 'success'
                                ? 'bg-ds-ok/10 text-ds-ok '
                                : 'bg-ds-danger/10 text-ds-danger '
                        }`}>{saveMsg.text}</span>
                    )}
                    <button
                        onClick={() => { setShowForm(!showForm); setForm({ ...EMPTY_CODE }); }}
                        className="ds-btn ds-btn--primary"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo código
                    </button>
                </div>
            </div>

            {/* Create form */}
            {showForm && (
                <div className={`${CARD} border-2 border-ds-accent`}>
                    <h4 className="font-black text-ds-text mb-5 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-ds-accent-text" />
                        Nuevo código de descuento
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        {/* Code */}
                        <div>
                            <label className={`${LABEL} block mb-1.5`}>Código</label>
                            <input
                                type="text"
                                value={form.code}
                                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                                className={`${INPUT} font-mono uppercase`}
                                placeholder="DECATRON2024"
                                maxLength={30}
                            />
                        </div>

                        {/* Applies to */}
                        <div>
                            <label className={`${LABEL} block mb-1.5`}>Aplica a</label>
                            <select
                                value={form.appliesTo}
                                onChange={e => setForm(f => ({ ...f, appliesTo: e.target.value as DiscountCode['appliesTo'] }))}
                                className={INPUT}
                            >
                                {TIER_OPTIONS_LOCAL.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Discount type + value */}
                        <div>
                            <label className={`${LABEL} block mb-1.5`}>Tipo de descuento</label>
                            <div className="flex gap-2">
                                <div className="flex rounded-lg border border-ds-border overflow-hidden shrink-0">
                                    <button
                                        onClick={() => setForm(f => ({ ...f, discountType: 'percent' }))}
                                        className={form.discountType === 'percent' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                                    >
                                        <Percent className="w-3.5 h-3.5" />
                                        %
                                    </button>
                                    <button
                                        onClick={() => setForm(f => ({ ...f, discountType: 'fixed' }))}
                                        className={form.discountType === 'fixed' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                                    >
                                        <DollarSign className="w-3.5 h-3.5" />
                                        USD
                                    </button>
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    max={form.discountType === 'percent' ? 100 : undefined}
                                    value={form.discountValue}
                                    onChange={e => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))}
                                    className={INPUT}
                                    placeholder={form.discountType === 'percent' ? '10' : '5'}
                                />
                            </div>
                        </div>

                        {/* Max uses */}
                        <div>
                            <label className={`${LABEL} block mb-1.5`}>Usos máximos</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    value={form.maxUses ?? ''}
                                    onChange={e => setForm(f => ({ ...f, maxUses: e.target.value ? Number(e.target.value) : null }))}
                                    className={INPUT}
                                    placeholder="Ilimitado"
                                />
                                {form.maxUses !== null && (
                                    <button
                                        onClick={() => setForm(f => ({ ...f, maxUses: null }))}
                                        className="text-xs text-ds-soft hover:text-ds-danger whitespace-nowrap"
                                    >
                                        ∞ Quitar límite
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Expires at */}
                        <div>
                            <label className={`${LABEL} block mb-1.5`}>Vigencia hasta</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={form.expiresAt ?? ''}
                                    onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value || null }))}
                                    className={INPUT}
                                />
                                {form.expiresAt && (
                                    <button
                                        onClick={() => setForm(f => ({ ...f, expiresAt: null }))}
                                        className="text-xs text-ds-soft hover:text-ds-danger whitespace-nowrap"
                                    >
                                        Sin fecha
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Active */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={LABEL}>Activo al crear</p>
                                <p className="text-xs text-ds-soft">Desactívalo para guardarlo sin publicar</p>
                            </div>
                            <Toggle value={form.active} onChange={() => setForm(f => ({ ...f, active: !f.active }))} />
                        </div>
                    </div>

                    {/* Preview */}
                    {form.code && (
                        <div className="bg-ds-bg rounded-lg px-4 py-3 border border-ds-border mb-4">
                            <p className="text-xs text-ds-soft mb-1">Vista previa</p>
                            <p className="text-sm font-bold text-ds-text">
                                Código <span className="font-mono bg-ds-raised px-1.5 py-0.5 rounded">{form.code}</span>{' '}
                                — {discountLabel({ ...form, id: 0, usedCount: 0, createdAt: '' } as DiscountCode)} de descuento{' '}
                                en {tierLabel(form.appliesTo)}{' '}
                                {form.maxUses ? `· Máx. ${form.maxUses} usos` : '· Usos ilimitados'}{' '}
                                {form.expiresAt ? `· Vence ${new Date(form.expiresAt).toLocaleDateString('es-ES')}` : '· Sin fecha límite'}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={handleCreate}
                            disabled={saving || !form.code.trim()}
                            className="ds-btn ds-btn--primary ds-btn--lg flex-1"
                        >
                            <Check className="w-4 h-4" />
                            {saving ? 'Creando...' : 'Crear código'}
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            className="ds-btn ds-btn--secondary ds-btn--lg"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Codes table */}
            <div className="bg-ds-surface border border-ds-border rounded-lg overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                            <div className="text-4xl mb-3">🎟️</div>
                            <p className="text-ds-soft font-semibold text-sm">Cargando códigos...</p>
                        </div>
                    </div>
                ) : codes.length === 0 ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                            <div className="text-5xl mb-3">🎟️</div>
                            <p className="font-bold text-ds-soft">Sin códigos de descuento</p>
                            <p className="text-sm text-ds-soft mt-1">Crea el primero con el botón de arriba</p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-ds-border bg-ds-bg">
                                    <th className="text-left px-5 py-3 text-xs font-bold text-ds-soft uppercase tracking-wide">Código</th>
                                    <th className="text-center px-5 py-3 text-xs font-bold text-ds-soft uppercase tracking-wide">Descuento</th>
                                    <th className="text-center px-5 py-3 text-xs font-bold text-ds-soft uppercase tracking-wide hidden sm:table-cell">Aplica a</th>
                                    <th className="text-center px-5 py-3 text-xs font-bold text-ds-soft uppercase tracking-wide hidden md:table-cell">Usos</th>
                                    <th className="text-center px-5 py-3 text-xs font-bold text-ds-soft uppercase tracking-wide hidden lg:table-cell">Vence</th>
                                    <th className="text-center px-5 py-3 text-xs font-bold text-ds-soft uppercase tracking-wide">Estado</th>
                                    <th className="text-right px-5 py-3 text-xs font-bold text-ds-soft uppercase tracking-wide">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {codes.map(c => (
                                    <tr key={c.id} className="border-b border-ds-border last:border-0 hover:bg-ds-bg transition-colors">
                                        <td className="px-5 py-4">
                                            <span className="font-mono font-black text-sm text-ds-text bg-ds-bg px-2 py-1 rounded-lg border border-ds-border">
                                                {c.code}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`font-black text-sm px-2.5 py-1 rounded-full ${
                                                c.discountType === 'percent'
                                                    ? 'bg-ds-accent/10 text-ds-accent-text '
                                                    : 'bg-ds-ok/10 text-ds-ok '
                                            }`}>
                                                {discountLabel(c)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center hidden sm:table-cell">
                                            <span className="text-sm text-ds-soft">{tierLabel(c.appliesTo)}</span>
                                        </td>
                                        <td className="px-5 py-4 text-center hidden md:table-cell">
                                            <span className="text-sm text-ds-text font-semibold">
                                                {c.usedCount}
                                                {c.maxUses ? ` / ${c.maxUses}` : ' / ∞'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center hidden lg:table-cell">
                                            <span className="text-sm text-ds-soft">
                                                {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('es-ES') : '∞'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <button onClick={() => handleToggle(c)}>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                    c.active
                                                        ? 'bg-ds-ok/10 text-ds-ok '
                                                        : 'bg-ds-bg text-ds-soft'
                                                }`}>
                                                    {c.active ? '✅ Activo' : '⏸ Inactivo'}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(c.id)}
                                                className="p-2 text-ds-soft hover:text-ds-danger transition-colors rounded-lg hover:bg-ds-danger/10"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
