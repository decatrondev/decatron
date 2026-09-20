/**
 * Pestaña Cuentas: cuentas de juego de la PERSONA (no del canal). Vincular,
 * verificar (icono de invocador en Riot), renombrar, rango manual, borrar.
 */
import React, { useMemo, useState } from 'react';
import { Plus, ShieldCheck, ShieldAlert, Trash2, Loader2, Pencil, Check, X } from 'lucide-react';
import { Card, SectionTitle, Label, SubLabel, TextInput, SelectInput, NumberInput } from '../../now-playing-extension/components/ui/SharedUI';
import { CatalogEntry, LinkedAccount, TierLimits, gameOverlaysApi, errorMessage } from '../api';
import { GAME_IDS, GAME_NAMES, GameId, RANK_CATALOG, formatTier } from '../types';

const RIOT_REGIONS = [
    { value: 'la1', label: 'LAN (la1)' }, { value: 'la2', label: 'LAS (la2)' }, { value: 'na1', label: 'NA (na1)' },
    { value: 'br1', label: 'BR (br1)' }, { value: 'euw1', label: 'EUW (euw1)' }, { value: 'eun1', label: 'EUNE (eun1)' },
    { value: 'kr', label: 'KR' }, { value: 'jp1', label: 'JP (jp1)' }, { value: 'oc1', label: 'OCE (oc1)' }, { value: 'tr1', label: 'TR (tr1)' }, { value: 'ru', label: 'RU' },
];

interface Props {
    accounts: LinkedAccount[];
    catalog: CatalogEntry[];
    limits: TierLimits;
    onChanged: () => Promise<void>;
}

export const AccountsTab: React.FC<Props> = ({ accounts, catalog, limits, onChanged }) => {
    const [game, setGame] = useState<GameId>('lol');
    const [name, setName] = useState('');
    const [tag, setTag] = useState('');
    const [region, setRegion] = useState('la2');
    const [displayName, setDisplayName] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const entry = useMemo(() => catalog.find(c => c.game === game), [catalog, game]);
    const isRiot = entry?.provider === 'riot' && entry.hasApi;
    const countForGame = accounts.filter(a => a.game === game).length;
    const atLimit = countForGame >= limits.maxAccountsPerGame;

    const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000); };

    const link = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try {
            const res = await gameOverlaysApi.link({ game, name: name.trim(), tag: isRiot ? tag.trim() : undefined, region: isRiot ? region : undefined, displayName: displayName.trim() || undefined });
            if (!res.success) { flash('err', res.message || 'No se pudo vincular'); return; }
            setName(''); setTag(''); setDisplayName('');
            flash('ok', res.account?.verificationPending ? 'Cuenta agregada — falta verificarla (ver abajo)' : 'Cuenta vinculada');
            await onChanged();
        } catch (e) { flash('err', errorMessage(e)); }
        finally { setBusy(false); }
    };

    const grouped = GAME_IDS.map(g => ({ game: g, list: accounts.filter(a => a.game === g) })).filter(x => x.list.length > 0);

    return (
        <div className="space-y-6">
            <Card>
                <SectionTitle>Vincular una cuenta</SectionTitle>
                <SubLabel>Las cuentas son tuyas (de la persona), no del canal: sirven para Twitch y Kick. Tu plan permite {limits.maxAccountsPerGame} por juego.</SubLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <Label>Juego</Label>
                        <SelectInput value={game} onChange={v => setGame(v as GameId)} options={GAME_IDS.map(g => ({ value: g, label: `${GAME_NAMES[g]}${catalog.find(c => c.game === g)?.hasApi ? '' : ' (rango manual)'}` }))} />
                    </div>
                    <div>
                        <Label>Nombre visible (opcional)</Label>
                        <TextInput value={displayName} onChange={setDisplayName} placeholder="Main, Smurf, EUW…" />
                    </div>
                    <div>
                        <Label>{isRiot ? 'Riot ID (nombre)' : 'Nombre en el juego'}</Label>
                        <TextInput value={name} onChange={setName} placeholder={isRiot ? 'anthonydeca' : 'Tu nick'} />
                    </div>
                    {isRiot && (
                        <>
                            <div>
                                <Label>Tag (sin #)</Label>
                                <TextInput value={tag} onChange={setTag} placeholder="LAS" />
                            </div>
                            <div>
                                <Label>Región</Label>
                                <SelectInput value={region} onChange={setRegion} options={RIOT_REGIONS} />
                            </div>
                        </>
                    )}
                </div>
                {!entry?.hasApi && (
                    <p className="text-xs text-amber-400/90 mt-3">
                        {GAME_NAMES[game]} todavía no tiene API conectada: el rango lo fijas a mano en la cuenta (abajo) o con <code>!setrango</code> en el chat.
                    </p>
                )}
                <div className="flex items-center gap-3 mt-4">
                    <button onClick={link} disabled={busy || atLimit || !name.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Vincular
                    </button>
                    {atLimit && <span className="text-xs text-[#94a3b8]">Llegaste al máximo de {limits.maxAccountsPerGame} cuenta(s) para {GAME_NAMES[game]}. <a href="/supporters" className="text-blue-400 underline">Ver planes</a></span>}
                    {msg && <span className={`text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</span>}
                </div>
            </Card>

            {grouped.length === 0 && (
                <Card><p className="text-sm text-[#94a3b8]">Todavía no tienes cuentas vinculadas.</p></Card>
            )}

            {grouped.map(({ game: g, list }) => (
                <Card key={g}>
                    <SectionTitle>{GAME_NAMES[g]} <span className="text-[#6b7280] font-normal text-sm">({list.length}/{limits.maxAccountsPerGame})</span></SectionTitle>
                    <div className="space-y-3 mt-3">
                        {list.map(a => <AccountRow key={a.id} account={a} onChanged={onChanged} />)}
                    </div>
                </Card>
            ))}
        </div>
    );
};

const AccountRow: React.FC<{ account: LinkedAccount; onChanged: () => Promise<void> }> = ({ account: a, onChanged }) => {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(a.displayName);
    const [rankTier, setRankTier] = useState(a.manualRank?.tier ?? RANK_CATALOG[a.game][0].tier);
    const [rankDiv, setRankDiv] = useState(a.manualRank?.division ?? '');
    const [rankPts, setRankPts] = useState<number>(a.manualRank?.points ?? 0);
    const catalog = RANK_CATALOG[a.game];
    const divisions = catalog.find(c => c.tier === rankTier)?.divisions ?? [];
    const showManual = !a.hasApi || a.provider === 'manual';

    const run = async (fn: () => Promise<any>, okMsg?: string) => {
        setBusy(true); setMsg(null);
        try { const r = await fn(); if (r && r.success === false) setMsg(r.message); else { if (okMsg) setMsg(okMsg); await onChanged(); } }
        catch (e) { setMsg(errorMessage(e)); }
        finally { setBusy(false); }
    };

    return (
        <div className="rounded-lg border border-[#374151] bg-[#111214] p-3">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                    {editing ? (
                        <div className="flex items-center gap-2">
                            <TextInput value={displayName} onChange={setDisplayName} placeholder="Nombre visible" />
                            <button className="p-1.5 rounded bg-green-700 text-white" onClick={() => run(() => gameOverlaysApi.updateAccount(a.id, { displayName }), 'Guardado').then(() => setEditing(false))}><Check className="w-4 h-4" /></button>
                            <button className="p-1.5 rounded bg-[#374151] text-white" onClick={() => { setEditing(false); setDisplayName(a.displayName); }}><X className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#f8fafc]">{a.displayName}</span>
                            <button className="text-[#6b7280] hover:text-white" onClick={() => setEditing(true)} title="Renombrar"><Pencil className="w-3.5 h-3.5" /></button>
                        </div>
                    )}
                    <div className="text-xs text-[#94a3b8]">{a.fullName}{a.region ? ` · ${a.region.toUpperCase()}` : ''} · {a.provider === 'manual' ? 'manual' : a.provider}</div>
                </div>

                {a.verified ? (
                    <span className="text-xs text-green-400 flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Verificada</span>
                ) : (
                    <span className="text-xs text-amber-400 flex items-center gap-1"><ShieldAlert className="w-4 h-4" /> Sin verificar</span>
                )}

                <button disabled={busy} onClick={() => { if (confirm(`¿Quitar ${a.fullName}?`)) run(() => gameOverlaysApi.deleteAccount(a.id)); }} className="p-2 rounded-lg text-[#94a3b8] hover:text-red-400 hover:bg-red-900/20" title="Quitar">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {a.verificationPending && (
                <div className="mt-3 p-3 rounded-lg bg-amber-900/20 border border-amber-500/20 text-sm text-amber-200">
                    <p>Para verificar que es tu cuenta: en el cliente de League, cambia tu <b>ícono de invocador</b> al ícono <b>#{a.verificationChallengeIconId}</b> (los primeros de la lista, sin costo), guarda, y pulsa verificar.</p>
                    <div className="flex items-center gap-3 mt-2">
                        <button disabled={busy} onClick={() => run(() => gameOverlaysApi.verify(a.id), 'Cuenta verificada')} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1">
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />} Verificar ahora
                        </button>
                        {msg && <span className="text-xs">{msg}</span>}
                    </div>
                </div>
            )}

            {showManual && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                        <Label>Rango manual</Label>
                        <SelectInput value={rankTier} onChange={v => { setRankTier(v); setRankDiv(''); }} options={catalog.map(c => ({ value: c.tier, label: c.label }))} />
                    </div>
                    <div>
                        <Label>División</Label>
                        <SelectInput value={rankDiv} onChange={setRankDiv} options={[{ value: '', label: '—' }, ...divisions.map(d => ({ value: d, label: d }))]} />
                    </div>
                    <div>
                        <Label>Puntos</Label>
                        <NumberInput value={rankPts} onChange={setRankPts} min={0} max={99999} />
                    </div>
                    <div className="flex gap-2">
                        <button disabled={busy} onClick={() => run(() => gameOverlaysApi.updateAccount(a.id, { manualRank: { tier: rankTier, division: rankDiv || null, points: rankPts } }), 'Rango guardado')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">Guardar rango</button>
                        {a.manualRank && <button disabled={busy} onClick={() => run(() => gameOverlaysApi.updateAccount(a.id, { clearManualRank: true }), 'Rango borrado')} className="px-3 py-2 bg-[#374151] text-white rounded-lg text-xs">Quitar</button>}
                    </div>
                    {a.manualRank && <div className="md:col-span-4 text-xs text-[#94a3b8]">Actual: {formatTier(a.manualRank.tier)} {a.manualRank.division ?? ''} {a.manualRank.points ? `· ${a.manualRank.points} pts` : ''}</div>}
                </div>
            )}
            {msg && !a.verificationPending && <div className="text-xs text-[#94a3b8] mt-2">{msg}</div>}
        </div>
    );
};
