import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

const ROWS: Array<[string, string]> = [
    ['1 – 9', 'audio'], ['0', 'mute'], ['L', 'layout'], ['C', 'chat'], ['F', 'fullscreen'], ['A  /', 'add'], ['N', 'notify'], ['?', 'help'],
];

/** Ayuda de atajos de teclado del Multi-view. */
export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation('multiview');
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
            <div role="dialog" aria-modal="true" aria-label={t('shortcuts.title')} onMouseDown={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-lg border border-pub-border bg-pub-raised p-4 shadow-2xl 3xl:max-w-md">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-bold text-white">{t('shortcuts.title')}</h2>
                    <button type="button" onClick={onClose} aria-label={t('shortcuts.close')} className="rounded p-1 text-[#a1a1aa] hover:text-white"><X className="h-4 w-4" /></button>
                </div>
                <dl className="space-y-1.5 text-sm">
                    {ROWS.map(([keys, id]) => (
                        <div key={id} className="flex items-center justify-between gap-4">
                            <dt className="text-[#d4d4d8]">{t(`shortcuts.${id}`)}</dt>
                            <dd><kbd className="rounded border border-pub-border bg-pub-surface px-2 py-0.5 font-mono text-xs text-white">{keys}</kbd></dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-3 text-xs text-[#71717a]">{t('shortcuts.note')}</p>
            </div>
        </div>
    );
}
