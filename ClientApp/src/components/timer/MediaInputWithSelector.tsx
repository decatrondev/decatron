import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import MediaSelector from './MediaSelector';

interface MediaInputWithSelectorProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder?: string;
    allowedTypes?: string[];
    className?: string;
}

export default function MediaInputWithSelector({
    value,
    onChange,
    label,
    placeholder,
    allowedTypes,
    className = ''
}: MediaInputWithSelectorProps) {
    const [isSelectingMedia, setIsSelectingMedia] = useState(false);

    const handleMediaSelect = (fileUrl: string, fileName: string) => {
        onChange(fileUrl);
        setIsSelectingMedia(false);
    };

    return (
        <div className={className}>
            <label className="text-xs font-bold text-ds-soft block mb-2">
                {label}
            </label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder || "URL o ruta del archivo"}
                    className="flex-1 px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text"
                />
                <button
                    type="button"
                    onClick={() => setIsSelectingMedia(true)}
                    className="px-4 py-2 bg-ds-accent/10 text-ds-accent-text rounded-lg hover:bg-ds-accent/10 transition-colors flex items-center gap-2 font-semibold"
                    title="Elegir de la galería"
                >
                    <FolderOpen className="w-4 h-4" />
                    <span className="hidden sm:inline">Galería</span>
                </button>
            </div>

            <MediaSelector
                isOpen={isSelectingMedia}
                onClose={() => setIsSelectingMedia(false)}
                onSelect={handleMediaSelect}
                allowedTypes={allowedTypes}
                currentUrl={value}
            />
        </div>
    );
}
