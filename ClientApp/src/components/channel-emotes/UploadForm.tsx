import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, NAME_PATTERN, formatBytes, nameFromFile, useObjectUrl } from './shared';

interface Props {
    /** Devuelve null si salió bien o la clave del error (en `emotes:errors`) */
    onSubmit: (file: File, name: string, zeroWidth: boolean) => Promise<string | null>;
    /** Solo quien administra el canal decide "encima del anterior" */
    allowZeroWidth?: boolean;
    /** Estilo de la página pública (oscuro) o del panel */
    tone?: 'panel' | 'public';
    disabledReason?: string | null;
}

/** Subir un emote: elegir o arrastrar el archivo, ver cómo se ve en pequeño sobre claro y oscuro, y ponerle nombre */
export default function UploadForm({ onSubmit, allowZeroWidth = false, tone = 'panel', disabledReason = null }: Props) {
    const { t } = useTranslation('emotes');
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [zeroWidth, setZeroWidth] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [drag, setDrag] = useState(false);
    const preview = useObjectUrl(file);

    const pick = (f: File | null | undefined) => {
        setDone(false);
        if (!f) return;
        if (f.size > MAX_UPLOAD_BYTES) { setFile(null); setError('too_large'); return; }
        setError(null);
        setFile(f);
        setName(prev => prev || nameFromFile(f.name));
    };

    const nameOk = NAME_PATTERN.test(name);

    const submit = async () => {
        if (!file || !nameOk || busy) return;
        setBusy(true);
        setError(null);
        const err = await onSubmit(file, name, allowZeroWidth && zeroWidth);
        setBusy(false);
        if (err) { setError(err); return; }
        setDone(true);
        setFile(null);
        setName('');
        setZeroWidth(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const dark = tone === 'public';
    const box = dark ? 'border-pub-border bg-pub-surface text-[#d4d4d8]' : 'border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc]';
    const muted = dark ? 'text-[#a1a1aa]' : 'text-[#64748b] dark:text-[#94a3b8]';
    const input = dark
        ? 'bg-pub-bg border border-pub-border text-white focus:border-pub-accent/60'
        : 'bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-[#2563eb]/40';
    const accent = dark ? 'bg-pub-accent hover:bg-pub-accent-hover text-white' : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white';

    return (
        <div className={`rounded-2xl border p-5 3xl:p-6 space-y-5 ${box}`}>
            {disabledReason && <p className={`text-sm 3xl:text-base ${muted}`}>{disabledReason}</p>}

            <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${drag ? (dark ? 'border-pub-accent' : 'border-[#2563eb]') : (dark ? 'border-[#3f3f46]' : 'border-[#cbd5e1] dark:border-[#4b5563]')}`}
            >
                <Upload className={`w-8 h-8 mx-auto mb-2 ${muted}`} />
                <p className="font-semibold text-sm 3xl:text-base">{file ? file.name : t('upload.drop')}</p>
                <p className={`text-xs 3xl:text-sm mt-1 ${muted}`}>{file ? formatBytes(file.size) : t('upload.hint')}</p>
                <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={e => pick(e.target.files?.[0])} />
            </div>

            {preview && (
                <div>
                    <p className={`text-xs 3xl:text-sm font-bold uppercase mb-2 ${muted}`}>{t('upload.preview')}</p>
                    <div className="flex flex-wrap gap-3">
                        {(['#171b24', '#ffffff'] as const).map(bg => (
                            <div key={bg} className="flex items-end gap-3 rounded-xl p-3" style={{ background: bg }}>
                                {[28, 56, 112].map(h => <img key={h} src={preview} alt="" style={{ height: h, width: 'auto', maxWidth: h * 4 }} />)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={`block text-xs 3xl:text-sm font-bold uppercase mb-1 ${muted}`}>{t('upload.name')}</label>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 25))}
                        placeholder="MiEmote"
                        className={`w-full px-3 py-2 rounded-lg text-sm 3xl:text-base focus:outline-none ${input}`}
                    />
                    <p className={`text-xs 3xl:text-sm mt-1 ${name && !nameOk ? 'text-red-500' : muted}`}>{t('upload.nameHint')}</p>
                </div>
                {allowZeroWidth && (
                    <label className="flex items-start gap-3 cursor-pointer select-none self-end pb-1">
                        <input type="checkbox" checked={zeroWidth} onChange={e => setZeroWidth(e.target.checked)} className="mt-1 w-4 h-4" />
                        <span>
                            <span className="block text-sm 3xl:text-base font-semibold">{t('upload.zeroWidth')}</span>
                            <span className={`block text-xs 3xl:text-sm ${muted}`}>{t('upload.zeroWidthHint')}</span>
                        </span>
                    </label>
                )}
            </div>

            {error && <p className="text-sm 3xl:text-base font-semibold text-red-500">{t(`errors.${error}`, { defaultValue: t('errors.server_error') })}</p>}
            {done && <p className="text-sm 3xl:text-base font-semibold text-green-500">{t('upload.done')}</p>}

            <button
                type="button"
                onClick={submit}
                disabled={!file || !nameOk || busy || !!disabledReason}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm 3xl:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${accent}`}
            >
                {busy ? t('upload.uploading') : t('upload.submit')}
            </button>
        </div>
    );
}
