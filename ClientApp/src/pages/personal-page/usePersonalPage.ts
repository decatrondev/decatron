import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import type { PersonalPageContent, PlatformInfo } from './shared';

// Estado del panel de la página personal: lo que devuelve el servidor y el borrador que se edita en pantalla.

export interface PanelPage {
    id: number;
    handle: string;
    draft: PersonalPageContent;
    published: boolean;
    publishedAt: string | null;
    hasUnpublishedChanges: boolean;
    status: 'active' | 'hidden';
    hiddenReason: string;
    needsNewHandle: boolean;
    canChangeHandle: boolean;
    nextHandleChange: string | null;
    revision: number;
}

export interface PanelData {
    page: PanelPage | null;
    suggestedHandle: string | null;
    channel: { login: string; displayName: string; photoUrl: string } | null;
    publicOpen: boolean;
    platforms: PlatformInfo[];
    fonts: string[];
    templates: string[];
    limits: { handleMin: number; handleMax: number; displayName: number; bio: number; title: number; links: number; url: number };
}

export interface ApiError { code: string; details: string[] }

export function errorOf(err: unknown): ApiError {
    const e = err as { response?: { status?: number; data?: { code?: string; details?: string[] } } };
    const code = e?.response?.data?.code ?? (e?.response?.status === 403 ? 'forbidden' : 'failed');
    return { code, details: e?.response?.data?.details ?? [] };
}

export function usePersonalPage() {
    const [data, setData] = useState<PanelData | null>(null);
    const [draft, setDraft] = useState<PersonalPageContent | null>(null);
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    // Última revisión conocida: las acciones seguidas (guardar y luego subir la foto) no pueden leer un estado viejo
    const revision = useRef(0);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/personal-page');
            setData(res.data);
            revision.current = res.data.page?.revision ?? 0;
            setDraft(res.data.page?.draft ?? null);
            setDirty(false);
            setLoadError(null);
        } catch (err) {
            setLoadError(errorOf(err).code);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const applyPage = useCallback((page: PanelPage, keepDraft = false) => {
        revision.current = page.revision;
        setData(d => d ? { ...d, page } : d);
        if (!keepDraft) { setDraft(page.draft); setDirty(false); }
    }, []);

    const edit = useCallback((patch: Partial<PersonalPageContent>) => {
        setDraft(d => d ? { ...d, ...patch } : d);
        setDirty(true);
    }, []);

    /** Corre una acción del servidor que devuelve la página; devuelve el error (o null si salió bien). */
    const run = useCallback(async (fn: () => Promise<{ data: { page: PanelPage } & Record<string, unknown> }>, keepDraft = false) => {
        setBusy(true);
        try {
            const res = await fn();
            applyPage(res.data.page, keepDraft);
            return { error: null as ApiError | null, data: res.data };
        } catch (err) {
            return { error: errorOf(err), data: null };
        } finally {
            setBusy(false);
        }
    }, [applyPage]);

    const page = data?.page ?? null;

    return {
        data, page, draft, dirty, loading, busy, loadError, load, edit, setDirty,
        create: (handle: string) => run(() => api.post('/personal-page', { handle })),
        saveDraft: () => run(() => api.put('/personal-page/draft', { content: draft, revision: revision.current })),
        publish: () => run(() => api.post('/personal-page/publish', { revision: revision.current })),
        discard: () => run(() => api.post('/personal-page/discard', { revision: revision.current })),
        changeHandle: (handle: string) => run(() => api.put('/personal-page/handle', { handle, revision: revision.current }), true),
        uploadAvatar: async (file: File) => {
            // La foto se guarda en el borrador del servidor: primero se guarda lo que haya en pantalla para no pisarlo
            if (dirty) {
                const saved = await run(() => api.put('/personal-page/draft', { content: draft, revision: revision.current }));
                if (saved.error) return saved;
            }
            const form = new FormData();
            form.append('file', file);
            form.append('revision', String(revision.current));
            return run(() => api.post('/personal-page/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
        },
    };
}

export type PersonalPageState = ReturnType<typeof usePersonalPage>;
