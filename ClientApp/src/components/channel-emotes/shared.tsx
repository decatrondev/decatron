import { useEffect, useState } from 'react';

// Piezas comunes de los emotes propios (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 3): el panel del streamer y la página pública.

export type EmoteStatus = 'pending' | 'approved' | 'hidden' | 'rejected' | 'removed';

export interface EmoteDto {
    id: number;
    name: string;
    status: EmoteStatus;
    animated: boolean;
    zeroWidth: boolean;
    width: number;
    height: number;
    bytes: number;
    uploadedBy: string;
    uploadedById?: number;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    reason?: string | null;
    createdAt?: string;
    reports?: number;
    urls: { x1: string; x2: string; x4: string };
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_TYPES = 'image/png,image/gif,image/webp,image/jpeg';

/** "Mi Emote 2.png" → "MiEmote2": un nombre válido a partir del archivo (el usuario lo ajusta si quiere) */
export function nameFromFile(filename: string): string {
    const base = filename.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]+/g, '');
    const cleaned = /^[A-Za-z]/.test(base) ? base : base.replace(/^[^A-Za-z]+/, '');
    return cleaned.slice(0, 25);
}

export const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,24}$/;

/** El texto de error de la API (clave en `emotes:errors`) de una respuesta fallida de axios */
export function errorCodeOf(e: unknown): string {
    const data = (e as { response?: { data?: { error?: string } } })?.response?.data;
    return data?.error || 'server_error';
}

/** Una vista previa del archivo elegido, liberada al cambiar o al salir */
export function useObjectUrl(file: File | null): string | null {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!file) { setUrl(null); return; }
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [file]);
    return url;
}

const BACKGROUNDS = {
    light: '#ffffff',
    dark: '#18181b',
    checker: 'repeating-conic-gradient(#d4d4d8 0% 25%, #f4f4f5 0% 50%) 50% / 12px 12px',
};

/** La imagen de un emote sobre el fondo que se pida: así se ve cómo queda en un chat claro y en uno oscuro */
export function EmoteThumb({ src, name, height = 40, bg = 'checker', className = '' }: { src: string; name: string; height?: number; bg?: keyof typeof BACKGROUNDS; className?: string }) {
    return (
        <span className={`inline-flex items-center justify-center rounded-lg ${className}`} style={{ background: BACKGROUNDS[bg], minWidth: height + 16, padding: 8 }}>
            <img src={src} alt={name} loading="lazy" style={{ display: 'block', height, width: 'auto', maxWidth: height * 4 }} />
        </span>
    );
}

export function formatBytes(n: number): string {
    return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Sube un emote como formulario (archivo, nombre y "encima del anterior") */
export function buildUploadForm(file: File, name: string, zeroWidth: boolean): FormData {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    form.append('zeroWidth', zeroWidth ? 'true' : 'false');
    return form;
}
