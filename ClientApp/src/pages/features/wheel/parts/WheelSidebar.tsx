import { Check, Copy, CopyPlus, Trash2 } from 'lucide-react';
import { CANVAS_HEIGHT, CANVAS_WIDTH, type WheelVisual } from '../../../../components/wheel/visualConfig';
import type { Segment, WheelSummary } from '../model';
import { WheelPreview } from '../tabs/WheelPreview';
import { FIELD, Toggle } from '../ui';

/** La columna derecha: nombre y encendido, preview del overlay y la URL para OBS. */
export function WheelSidebar({
    wheel, wheels, segments, visual, celebNonce, saving, confirmDelete, copied, overlayUrl,
    onRename, onRenameCommit, onToggleEnabled, onDuplicate, onAskDelete, onCancelDelete, onDelete, onSlug, onCopy, t,
}: {
    wheel: WheelSummary;
    wheels: WheelSummary[];
    segments: Segment[];
    visual: WheelVisual;
    celebNonce: number;
    saving: boolean;
    confirmDelete: boolean;
    copied: boolean;
    overlayUrl: string;
    /** Escribiendo: solo cambia lo que se ve en el campo. */
    onRename: (name: string) => void;
    /** Al salir del campo: guarda el nombre en el servidor. */
    onRenameCommit: (name: string) => void;
    onToggleEnabled: (enabled: boolean) => void;
    onDuplicate: () => void;
    onAskDelete: () => void;
    onCancelDelete: () => void;
    onDelete: () => void;
    onSlug: (slug: string) => void;
    onCopy: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    return (
        <aside className="space-y-4 min-w-0 lg:sticky lg:top-4 xl:top-8">
            {/* El nombre de la rueda. Hasta ahora se creaba con un nombre por
                defecto y no habia forma de cambiarlo: con varias ruedas por
                canal, el selector de arriba mostraba varias "Mi rueda". */}
            <div className="bg-[#1B1C1D] rounded-xl border border-[#374151] p-4 space-y-2">
                <h3 className="font-bold text-[#f8fafc] text-sm">{t('wheel.nameTitle')}</h3>
                <input
                    type="text"
                    maxLength={80}
                    value={wheel.name}
                    onChange={e => onRename(e.target.value)}
                    onBlur={e => {
                        const nombre = e.target.value.trim();
                        if (!nombre || nombre === wheels.find(w => w.id === wheel.id)?.name) return;
                        onRenameCommit(nombre);
                    }}
                    className={`${FIELD} w-full`}
                />
                {/* El slug NO sigue al nombre a proposito: es la URL que el
                    streamer ya pego en su escena de OBS, y cambiarla sola le
                    romperia el overlay sin avisar. */}
                <p className="text-xs text-[#64748b]">{t('wheel.nameHelp')}</p>

                {/* Encendido/apagado. Es lo que consume el cupo del tier, asi
                    que sin este control el streamer no podria gestionar sus
                    ruedas: no tendria como apagar una para encender otra. */}
                <div className="flex items-center justify-between pt-2 border-t border-[#374151]">
                    <div>
                        <p className="text-sm font-medium text-[#f8fafc]">{t('wheel.enabled')}</p>
                        <p className="text-xs text-[#64748b]">{t('wheel.enabledHelp')}</p>
                    </div>
                    <Toggle on={wheel.isEnabled} onChange={onToggleEnabled} />
                </div>

                <div className="pt-2 border-t border-[#374151]">
                    {confirmDelete ? (
                        <div className="space-y-2">
                            <p className="text-xs text-red-300">{t('wheel.deleteConfirm', { name: wheel.name })}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={onDelete}
                                    disabled={saving}
                                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors"
                                >
                                    {t('wheel.deleteYes')}
                                </button>
                                <button
                                    onClick={onCancelDelete}
                                    className="flex-1 px-3 py-2 bg-[#262626] border border-[#374151] text-[#f8fafc] rounded-lg text-sm font-medium hover:bg-[#333] transition-colors"
                                >
                                    {t('wheel.deleteNo')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={onDuplicate}
                                disabled={saving}
                                className="w-full px-3 py-2 mb-1 text-sm bg-[#262626] hover:bg-[#333] disabled:opacity-50 border border-[#374151] text-[#f8fafc] rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <CopyPlus className="w-4 h-4" />
                                {t('wheel.duplicate')}
                            </button>
                            <button
                                onClick={onAskDelete}
                                className="w-full px-3 py-2 text-sm text-[#64748b] hover:text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {t('wheel.delete')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <WheelPreview segments={segments} visual={visual} celebNonce={celebNonce} t={t} />

            <div className="bg-[#1B1C1D] rounded-xl border border-[#374151] p-4 space-y-2">
                <h3 className="font-bold text-[#f8fafc] text-sm">{t('wheel.overlayUrl.title')}</h3>
                <p className="text-xs text-[#94a3b8]">{t('wheel.overlayUrl.help')}</p>
                {/* El slug se edita ACA, junto a la URL que forma, y no en
                    el bloque del nombre: cambiarlo rompe la escena de OBS
                    que el streamer ya guardo, asi que tiene que ver la URL
                    mientras lo toca. */}
                <div className="flex items-center gap-2 pb-1">
                    <span className="text-xs text-[#64748b] shrink-0">{t('wheel.slugLabel')}</span>
                    <input
                        defaultValue={wheel.slug}
                        key={wheel.slug}
                        onBlur={e => onSlug(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className={`${FIELD} flex-1 text-xs`}
                    />
                </div>
                <p className="text-xs text-amber-300/80">{t('wheel.slugWarning')}</p>

                <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-[#262626] border border-[#374151] rounded-lg text-xs text-[#cbd5e1] truncate">
                        {overlayUrl}
                    </code>
                    <button
                        onClick={onCopy}
                        className="p-2 bg-[#262626] hover:bg-[#333] border border-[#374151] rounded-lg transition-colors"
                        aria-label={t('wheel.overlayUrl.copy')}
                    >
                        {copied
                            ? <Check className="w-4 h-4 text-green-400" />
                            : <Copy className="w-4 h-4 text-[#94a3b8]" />}
                    </button>
                </div>

                {/* Solo cuando hay lienzo. Con el reparto automatico la rueda se
                    acomoda a cualquier tamano de fuente y decirlo seria pedirle al
                    streamer que arregle algo que no pasa; con coordenadas fijas, es la
                    unica forma de que se entere antes de verlo corrido en un directo. */}
                {visual.layout && (
                    <p className="text-xs text-amber-300/80">
                        {t('wheel.canvas.obsSize', { width: CANVAS_WIDTH, height: CANVAS_HEIGHT })}
                    </p>
                )}
            </div>
        </aside>
    );
}
