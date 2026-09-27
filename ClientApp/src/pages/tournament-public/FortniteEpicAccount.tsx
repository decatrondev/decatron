import React, { useState } from 'react';
import { Loader2, ShieldCheck, AlertTriangle, Plus } from 'lucide-react';
import api from '../../services/api';

// Cuenta de Epic del jugador en torneos de Fortnite (.dev/torneos/15-fortnite.md F1).
// Se elige entre las cuentas de Fortnite que la persona ya vinculo (Settings o Game
// Overlays) o se vincula una nueva aca mismo con el nombre de Epic. Mientras Epic
// no apruebe el inicio de sesion oficial, las cuentas quedan "sin verificar" y el
// organizador lo ve marcado (decision 27-09-2026).

export interface EpicAccountOption {
    id: number;
    name: string;
    verified: boolean;
}

const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg border border-[#232C42] bg-[#0F1729] text-[#EDF0F7] text-sm';

function UnverifiedNote() {
    return (
        <p className="text-[11px] text-[#7C8AA6] flex items-start gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-[#E8B04B] flex-shrink-0 mt-px" />
            Por ahora las cuentas de Epic quedan sin verificar: el organizador lo ve marcado. Pronto se podrá verificar con el inicio de sesión de Epic.
        </p>
    );
}

// Formulario corto para vincular una cuenta de Fortnite por nombre de Epic.
function LinkEpicAccountForm({ onLinked, onCancel }: { onLinked: (id: number) => void; onCancel?: () => void }) {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleLink = async () => {
        if (!name.trim()) return;
        setSaving(true);
        setError('');
        try {
            const res = await api.post('/me/game-accounts', { game: 'fortnite', name: name.trim() });
            onLinked(res.data.account.id);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo vincular la cuenta');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-wider text-[#7C8AA6]">Tu nombre de Epic (el que se ve en Fortnite)</label>
            <div className="flex items-center gap-2">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleLink();
                        }
                    }}
                    className={inputClass + ' mt-0'}
                    placeholder="Nombre de Epic"
                />
                <button
                    type="button"
                    onClick={handleLink}
                    disabled={saving || !name.trim()}
                    className="px-4 py-2 rounded-lg bg-[#3ED6C4] text-[#0B1120] font-bold text-sm hover:bg-[#5EE8D8] disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Vincular
                </button>
                {onCancel && (
                    <button type="button" onClick={onCancel} className="text-xs text-[#7C8AA6] hover:text-[#EDF0F7] flex-shrink-0">
                        Cancelar
                    </button>
                )}
            </div>
            {error && <p className="text-sm text-[#E8677A]">{error}</p>}
        </div>
    );
}

/**
 * Selector para el formulario de inscripcion: elige una cuenta vinculada o vincula
 * una nueva. `onAccountsChanged` recarga el estado del panel para traer la nueva.
 */
export function EpicAccountSelect({
    accounts,
    value,
    onChange,
    onAccountsChanged,
}: {
    accounts: EpicAccountOption[];
    value: number | null;
    onChange: (id: number) => void;
    onAccountsChanged: () => void;
}) {
    const [linking, setLinking] = useState(accounts.length === 0);

    const handleLinked = (id: number) => {
        onChange(id);
        setLinking(false);
        onAccountsChanged();
    };

    return (
        <div className="space-y-2">
            {accounts.length > 0 && !linking && (
                <div>
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#7C8AA6]">Cuenta de Epic</label>
                    <select value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} required className={inputClass}>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                                {a.verified ? ' (verificada)' : ''}
                            </option>
                        ))}
                    </select>
                    <button type="button" onClick={() => setLinking(true)} className="mt-1.5 text-xs text-[#3ED6C4] hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Vincular otra cuenta
                    </button>
                </div>
            )}
            {linking && <LinkEpicAccountForm onLinked={handleLinked} onCancel={accounts.length > 0 ? () => setLinking(false) : undefined} />}
            <UnverifiedNote />
        </div>
    );
}

/**
 * Ya inscrito: muestra la cuenta de Epic de la inscripcion y deja cambiarla por
 * otra vinculada (o vincular una nueva).
 */
export function EpicAccountCard({
    channelName,
    editionSlug,
    current,
    verified,
    accounts,
    onChanged,
}: {
    channelName: string;
    editionSlug: string;
    current: string | null;
    verified: boolean;
    accounts: EpicAccountOption[];
    onChanged: () => void;
}) {
    const [editing, setEditing] = useState(!current);
    const [selected, setSelected] = useState<number | null>(accounts[0]?.id ?? null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const save = async (id: number | null) => {
        if (id == null) return;
        setSaving(true);
        setError('');
        try {
            await api.post(`/me/tournament/${channelName}/${editionSlug}/epic-account`, { gameAccountId: id });
            setEditing(false);
            onChanged();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo cambiar la cuenta');
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="space-y-3">
            <h2 className="font-display font-bold flex items-center gap-2">
                Cuenta de Epic para este torneo
                {current && verified && <ShieldCheck className="w-4 h-4 text-[#3ED6C4]" />}
            </h2>

            {current && !editing ? (
                <div className="p-4 rounded-lg border border-[#232C42] bg-[#0F1729] flex items-center justify-between gap-3">
                    <div>
                        <p className="font-mono text-sm text-[#EDF0F7]">{current}</p>
                        <p className="text-[11px] text-[#7C8AA6]">{verified ? 'Verificada con Epic' : 'Sin verificar'}</p>
                    </div>
                    <button type="button" onClick={() => setEditing(true)} className="text-xs text-[#3ED6C4] hover:underline flex-shrink-0">
                        Cambiar
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    <EpicAccountSelect accounts={accounts} value={selected} onChange={setSelected} onAccountsChanged={onChanged} />
                    {accounts.length > 0 && (
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => save(selected)}
                                disabled={saving || selected == null}
                                className="px-4 py-2 rounded-lg bg-[#3ED6C4] text-[#0B1120] font-bold text-sm hover:bg-[#5EE8D8] disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Usar esta cuenta
                            </button>
                            {current && (
                                <button type="button" onClick={() => setEditing(false)} className="text-xs text-[#7C8AA6] hover:text-[#EDF0F7]">
                                    Cancelar
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
            {error && <p className="text-sm text-[#E8677A]">{error}</p>}
        </section>
    );
}

export default EpicAccountSelect;
