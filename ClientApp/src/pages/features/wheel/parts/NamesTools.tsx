import { useRef, useState } from 'react';
import { ChevronDown, Copy, Download, Upload } from 'lucide-react';
import { copyText, downloadText } from '../namesIO';
import { FIELD } from '../ui';

/** Botones de cabecera compartidos por la lista de gajos y el pool del Sorteo. */
export const TOOL_BTN =
    'px-3 py-1.5 text-sm bg-[#262626] hover:bg-[#333] disabled:opacity-40 border border-[#374151] text-[#f8fafc] rounded-lg flex items-center gap-1.5 font-medium transition-colors';

/**
 * Exportar: copiar al portapapeles o bajar un .csv. Es un `<details>` y no un menu con estado
 * propio: abre y cierra solo, se maneja con teclado y no necesita escuchar clics de fuera.
 */
export function ExportMenu({ text, filename, disabled, t }: {
    text: () => string;
    filename: string;
    disabled?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const ref = useRef<HTMLDetailsElement>(null);
    const [copiado, setCopiado] = useState<'ok' | 'fail' | null>(null);
    const cerrar = () => ref.current?.removeAttribute('open');

    return (
        <details ref={ref} className="relative">
            <summary
                className={`${TOOL_BTN} list-none cursor-pointer [&::-webkit-details-marker]:hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
            >
                <Download className="w-4 h-4" />
                {t('wheel.io.export')}
                <ChevronDown className="w-3.5 h-3.5 text-[#94a3b8]" />
            </summary>
            <div className="absolute right-0 mt-1 z-20 w-56 rounded-lg border border-[#374151] bg-[#1B1C1D] shadow-xl p-1">
                <button
                    onClick={async () => { setCopiado((await copyText(text())) ? 'ok' : 'fail'); cerrar(); window.setTimeout(() => setCopiado(null), 2500); }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-[#f8fafc] hover:bg-[#262626] flex items-center gap-2"
                >
                    <Copy className="w-4 h-4 text-[#94a3b8]" />{t('wheel.io.copy')}
                </button>
                <button
                    onClick={() => { downloadText(filename, text()); cerrar(); }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-[#f8fafc] hover:bg-[#262626] flex items-center gap-2"
                >
                    <Download className="w-4 h-4 text-[#94a3b8]" />{t('wheel.io.download')}
                </button>
            </div>
            {copiado && (
                <span role="status" className={`absolute right-0 top-full mt-1 text-xs whitespace-nowrap ${copiado === 'ok' ? 'text-green-300' : 'text-red-300'}`}>
                    {copiado === 'ok' ? t('wheel.io.copied') : t('wheel.io.copyFailed')}
                </span>
            )}
        </details>
    );
}

/** El boton que abre el panel de importar. */
export function ImportButton({ open, onClick, disabled, t }: {
    open: boolean; onClick: () => void; disabled?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    return (
        <button onClick={onClick} disabled={disabled} aria-expanded={open} className={`${TOOL_BTN} ${open ? '!border-blue-500/60 !bg-blue-500/10' : ''}`}>
            <Upload className="w-4 h-4" />{t('wheel.io.import')}
        </button>
    );
}

/**
 * El panel de importar: pegar la lista (o abrir un .txt/.csv), ver cuantos se van a crear y
 * confirmar. Nada se guarda hasta que el streamer pulsa Guardar en la cabecera (gajos) o
 * hasta confirmar aqui (inscritos del Sorteo, que se dan de alta uno a uno por la API).
 */
export function ImportPanel({ help, placeholder, summary, warning, applyLabel, canApply, busy, onApply, onClose, children, text, onText, t }: {
    help: string;
    placeholder: string;
    summary: string;
    warning?: string | null;
    applyLabel: string;
    canApply: boolean;
    busy?: boolean;
    onApply: () => void;
    onClose: () => void;
    children?: React.ReactNode;
    text: string;
    onText: (v: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const fileRef = useRef<HTMLInputElement>(null);

    return (
        <div className="px-5 py-4 border-b border-[#374151] bg-[#161617] space-y-3">
            <p className="text-sm text-[#94a3b8] max-w-2xl">{help}</p>
            <textarea
                value={text}
                onChange={e => onText(e.target.value)}
                placeholder={placeholder}
                rows={6}
                className={`${FIELD} w-full font-mono text-sm resize-y min-h-[8rem]`}
            />
            <input
                ref={fileRef} type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden"
                onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) onText(await f.text());
                    e.target.value = '';
                }}
            />
            {children}
            <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => fileRef.current?.click()} className={TOOL_BTN}>
                    <Upload className="w-4 h-4" />{t('wheel.io.openFile')}
                </button>
                <span className="text-sm text-[#cbd5e1]" role="status">{summary}</span>
                <div className="flex gap-2 ml-auto">
                    <button onClick={onClose} className={TOOL_BTN}>{t('wheel.io.cancel')}</button>
                    <button
                        onClick={onApply}
                        disabled={!canApply || busy}
                        className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-bold transition-colors"
                    >
                        {applyLabel}
                    </button>
                </div>
            </div>
            {warning && <p className="text-sm text-amber-300">{warning}</p>}
        </div>
    );
}
