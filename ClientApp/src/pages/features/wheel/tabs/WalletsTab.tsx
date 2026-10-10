import { useState } from 'react';
import { Search } from 'lucide-react';
import { type ViewerWallet } from '../model';
import { CARD, FIELD } from '../ui';

/// La pestana Billeteras: el saldo de creditos de cada espectador, editable.
///
/// Las billeteras son del CANAL y no de la rueda — el espectador aporta una vez y
/// gasta donde quiera — asi que esta tabla no cambia al cambiar de rueda.
export function WalletsTab({ wallets, search, onSearch, onApply, onSetCredits, t }: {
    wallets: ViewerWallet[];
    search: string;
    onSearch: (s: string) => void;
    onApply: () => void;
    onSetCredits: (viewer: string, credits: number) => void;
    t: any;
}) {
    const [editando, setEditando] = useState<string | null>(null);
    const [valor, setValor] = useState('');

    return (
        <section className={CARD}>
            <div className="px-5 py-4 border-b border-ds-border">
                <h2 className="font-bold text-ds-text">{t('wheel.wallets.title')}</h2>
                <p className="text-xs text-ds-soft mt-0.5">{t('wheel.wallets.help')}</p>
            </div>

            <div className="px-5 py-4 border-b border-ds-border flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                    <Search className="w-4 h-4 text-ds-soft absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onApply()}
                        placeholder={t('wheel.wallets.searchPlaceholder')}
                        className={`${FIELD} w-full pl-9`}
                    />
                </div>
                <button onClick={onApply} className="ds-btn ds-btn--secondary">
                    {t('wheel.wallets.search')}
                </button>
            </div>

            {wallets.length === 0 ? (
                <p className="px-5 py-8 text-sm text-ds-soft text-center">{t('wheel.wallets.empty')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-ds-soft border-b border-ds-border">
                                <th className="px-5 py-2 font-medium">{t('wheel.wallets.colViewer')}</th>
                                <th className="px-3 py-2 font-medium text-right">{t('wheel.wallets.colCredits')}</th>
                                <th className="px-3 py-2 font-medium text-right">{t('wheel.wallets.colLifetime')}</th>
                                <th className="px-3 py-2 font-medium">{t('wheel.wallets.colLastActivity')}</th>
                                <th className="px-5 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {wallets.map(w => (
                                <tr key={w.viewer} className="border-b border-ds-border last:border-0">
                                    <td className="px-5 py-2 text-ds-text">@{w.viewer}</td>
                                    <td className="px-3 py-2 text-right">
                                        {editando === w.viewer ? (
                                            <input
                                                type="number" min={0} autoFocus
                                                value={valor}
                                                onChange={e => setValor(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { onSetCredits(w.viewer, Math.max(0, Number(valor) || 0)); setEditando(null); }
                                                    if (e.key === 'Escape') setEditando(null);
                                                }}
                                                className={`${FIELD} w-24 text-right`}
                                            />
                                        ) : (
                                            <span className="text-ds-text font-medium tabular-nums">{w.credits}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-ds-soft tabular-nums">{w.lifetimeCredits}</td>
                                    <td className="px-3 py-2 text-ds-soft whitespace-nowrap">
                                        {new Date(w.lastActivityAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-5 py-2 text-right">
                                        {editando === w.viewer ? (
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => { onSetCredits(w.viewer, Math.max(0, Number(valor) || 0)); setEditando(null); }}
                                                    className="text-xs text-ds-ok hover:text-ds-ok"
                                                >
                                                    {t('wheel.wallets.save')}
                                                </button>
                                                <button onClick={() => setEditando(null)} className="text-xs text-ds-soft hover:text-ds-soft">
                                                    {t('wheel.wallets.cancel')}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditando(w.viewer); setValor(String(w.credits)); }}
                                                className="text-xs text-ds-soft hover:text-ds-text"
                                            >
                                                {t('wheel.wallets.edit')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="px-5 py-3 border-t border-ds-border text-xs text-ds-soft">
                {t('wheel.wallets.lifetimeNote')}
            </p>
        </section>
    );
}
