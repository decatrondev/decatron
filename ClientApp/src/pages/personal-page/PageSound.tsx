import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gateVars } from './AgeGate';
import type { PersonalPageContent, PersonalPageSound } from './shared';

// Sonidos de la página personal (subfase 5.4): el de entrada suena una vez al pasar la puerta «Entrar» y el de los botones
// (opcional) al tocar redes y enlaces. Siempre hay un botón para silenciar; se recuerda en ese navegador.

const MUTE_KEY = 'decatron:pp-muted';

function readMuted(): boolean {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function usePageSound(sound: PersonalPageSound | null | undefined) {
    const [muted, setMuted] = useState(readMuted);
    const [enabled, setEnabled] = useState(false);
    const entry = useRef<HTMLAudioElement | null>(null);
    const click = useRef<HTMLAudioElement | null>(null);
    const volume = Math.max(0, Math.min(100, sound?.volume ?? 70)) / 100;

    useEffect(() => {
        entry.current = sound?.entryUrl ? new Audio(sound.entryUrl) : null;
        click.current = sound?.clickEnabled && sound.clickUrl ? new Audio(sound.clickUrl) : null;
        for (const a of [entry.current, click.current]) if (a) { a.preload = 'auto'; a.volume = volume; }
        return () => { entry.current?.pause(); click.current?.pause(); };
    }, [sound?.entryUrl, sound?.clickUrl, sound?.clickEnabled, volume]);

    const play = (a: HTMLAudioElement | null) => {
        if (!a) return;
        a.currentTime = 0;
        a.play().catch(() => undefined);
    };

    /** Llamar desde el toque en «Entrar» (el navegador solo deja sonar dentro de un gesto del visitante). */
    const start = useCallback((withSound: boolean) => {
        // Lo que elige en la puerta manda (y queda recordado para el botón de silenciar)
        setEnabled(true);
        setMuted(!withSound);
        try { localStorage.setItem(MUTE_KEY, withSound ? '0' : '1'); } catch { /* sin storage */ }
        if (withSound) play(entry.current);
    }, []);

    const playClick = useCallback(() => { if (enabled && !muted) play(click.current); }, [enabled, muted]);

    const toggleMute = useCallback(() => {
        setMuted(m => {
            const next = !m;
            try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* sin storage */ }
            if (next) { entry.current?.pause(); click.current?.pause(); }
            return next;
        });
    }, []);

    return { muted, start, playClick, toggleMute };
}

/** Botón fijo para silenciar o volver a activar el sonido. */
export function MuteButton({ content, muted, onToggle }: { content: PersonalPageContent; muted: boolean; onToggle: () => void }) {
    const { t } = useTranslation('personal-page');
    return (
        <button type="button" onClick={onToggle} aria-pressed={muted} aria-label={muted ? t('sound.unmute') : t('sound.mute')} title={muted ? t('sound.unmute') : t('sound.mute')}
            style={{ ...gateVars(content), position: 'fixed', right: 16, bottom: 16, zIndex: 55, width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--ag-line)',
                background: 'var(--ag-panel)', color: 'var(--ag-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                {muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
            </svg>
        </button>
    );
}
