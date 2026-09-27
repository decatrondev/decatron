import { useEffect, useState } from 'react';
import { Loader2, ImageOff, X } from 'lucide-react';
import api from '../../services/api';

// Capturas y justificantes de torneos: son privados, se piden a la API con la
// sesion (un <img src> no manda el token), y se muestran como miniatura que se
// agranda al tocarla. Ver .dev/torneos/15-fortnite.md F4.

function useAuthBlob(url: string) {
    const [src, setSrc] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let objectUrl: string | null = null;
        let cancelled = false;
        setSrc(null);
        setFailed(false);
        api.get(url, { responseType: 'blob' })
            .then((res) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(res.data);
                setSrc(objectUrl);
            })
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url]);

    return { src, failed };
}

export default function AuthImage({ url, alt, className = 'w-16 h-10' }: { url: string; alt: string; className?: string }) {
    const { src, failed } = useAuthBlob(url);
    const [open, setOpen] = useState(false);

    if (failed) {
        return (
            <span className={`${className} inline-flex items-center justify-center rounded bg-black/20 text-[#94a3b8]`} title="No se pudo cargar">
                <ImageOff className="w-4 h-4" />
            </span>
        );
    }
    if (!src) {
        return (
            <span className={`${className} inline-flex items-center justify-center rounded bg-black/20`}>
                <Loader2 className="w-4 h-4 animate-spin text-[#94a3b8]" />
            </span>
        );
    }

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={`${className} rounded overflow-hidden flex-shrink-0 hover:ring-2 ring-[#2563eb]`} title="Ver en grande">
                <img src={src} alt={alt} className="w-full h-full object-cover" />
            </button>
            {open && (
                <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
                    <button type="button" className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setOpen(false)}>
                        <X className="w-5 h-5" />
                    </button>
                    <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded" onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </>
    );
}
