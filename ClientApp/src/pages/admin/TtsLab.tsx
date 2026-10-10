import { useEffect, useState } from 'react';
import api from '../../services/api';

/**
 * Laboratorio de voces (solo dueño).
 *
 * Compara Piper —auto-alojado, sin coste por carácter— con Polly, en calidad, tiempo y
 * dinero. Existe para decidir con datos si Piper puede sustituir al nivel gratuito, que
 * hoy depende de la voz del navegador y no funciona dentro de OBS.
 */

interface PiperVoice {
    id: string;
    language: string;
    speaker: string;
    quality: string;
    modelSizeMb: number;
}

interface PiperResult {
    voice: string;
    success: boolean;
    url?: string;
    generationMs: number;
    audioSeconds: number;
    realtimeFactor: number;
    sizeKb: number;
    fromCache: boolean;
    error?: string;
}

interface PollyResult {
    voice: string;
    success: boolean;
    url?: string;
    generationMs: number;
    fromCache: boolean;
    creditsCost: number;
}

const QUALITY_LABEL: Record<string, { label: string; className: string }> = {
    x_low: { label: 'Muy baja', className: 'bg-ds-danger/10 text-ds-danger ' },
    low: { label: 'Baja', className: 'bg-ds-warn/10 text-ds-warn ' },
    medium: { label: 'Media', className: 'bg-ds-accent/10 text-ds-accent-text ' },
    high: { label: 'Alta', className: 'bg-ds-ok/10 text-ds-ok ' },
};

/** Frase de ejemplo por idioma: probar voces inglesas con texto español no dice nada. */
const SAMPLE_TEXT: Record<string, string> = {
    es: '¡Gracias PixiPNJ por los cien bits! Eres increíble.',
    en: 'Thanks PixiPNJ for the one hundred bits! You are amazing.',
    pt: 'Obrigado PixiPNJ pelos cem bits! Você é incrível.',
    fr: 'Merci PixiPNJ pour les cent bits ! Tu es incroyable.',
    de: 'Danke PixiPNJ für die hundert Bits! Du bist unglaublich.',
    it: 'Grazie PixiPNJ per i cento bit! Sei incredibile.',
};

const LANG_LABEL: Record<string, string> = {
    es: 'Español', en: 'Inglés', pt: 'Portugués',
    fr: 'Francés', de: 'Alemán', it: 'Italiano',
};

const DEFAULT_TEXT = SAMPLE_TEXT.es;

export default function TtsLab() {
    const [voices, setVoices] = useState<PiperVoice[]>([]);
    const [available, setAvailable] = useState(true);
    const [text, setText] = useState(DEFAULT_TEXT);
    const [includePolly, setIncludePolly] = useState(false);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<PiperResult[]>([]);
    const [polly, setPolly] = useState<PollyResult | null>(null);
    const [totalMs, setTotalMs] = useState(0);
    const [chars, setChars] = useState(0);
    // Con 23 voces instaladas, generarlas todas en cada prueba son ~25 s en serie
    const [lang, setLang] = useState('es');

    useEffect(() => {
        api.get('/admin/tts-lab/voices')
            .then(res => {
                if (res.data?.success) {
                    setVoices(res.data.voices ?? []);
                    setAvailable(res.data.available);
                }
            })
            .catch(() => setAvailable(false));
    }, []);

    // Familias de idioma presentes, deducidas de "es_ES", "en_US"…
    const families = Array.from(new Set(voices.map(v => v.language.split('_')[0]))).sort();
    const selectedVoices = lang === 'all'
        ? voices
        : voices.filter(v => v.language.startsWith(lang));

    /** Al cambiar de idioma, la frase de ejemplo cambia con él si no la has tocado. */
    const changeLang = (next: string) => {
        setLang(next);
        const isSample = Object.values(SAMPLE_TEXT).includes(text.trim());
        if (isSample && SAMPLE_TEXT[next]) setText(SAMPLE_TEXT[next]);
    };

    const run = async () => {
        setRunning(true);
        setResults([]);
        setPolly(null);
        try {
            const res = await api.post('/admin/tts-lab/synthesize', {
                text,
                includePolly,
                voices: selectedVoices.map(v => v.id),
            });
            if (res.data?.success) {
                setResults(res.data.results ?? []);
                setPolly(res.data.polly ?? null);
                setTotalMs(res.data.totalMs ?? 0);
                setChars(res.data.chars ?? 0);
            }
        } catch { /* el error ya se ve por la tabla vacía */ }
        finally { setRunning(false); }
    };

    const voiceMeta = (id: string) => voices.find(v => v.id === id);

    const card = 'rounded-lg border border-ds-border bg-ds-surface p-6 ';

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-black text-ds-text">
                    Laboratorio de voces
                </h1>
                <p className="text-sm text-ds-soft mt-1">
                    Piper corre en este servidor y no cuesta por carácter, solo CPU. Aquí se compara
                    con Polly para decidir si puede sustituir al nivel gratuito.
                </p>
            </div>

            {!available && (
                <div className="rounded-lg border border-ds-danger/40 bg-ds-danger/10 p-4">
                    <p className="text-sm font-bold text-ds-danger">
                        Piper no está instalado o no se encuentran las voces en el servidor.
                    </p>
                </div>
            )}

            {/* Entrada */}
            <div className={card}>
                {/* Filtro por idioma: sin esto cada prueba genera las 23 voces en serie */}
                <label className="text-xs font-bold text-ds-soft uppercase tracking-wide block mb-2">
                    Idioma
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                    {families.map(f => (
                        <button
                            key={f}
                            onClick={() => changeLang(f)}
                            className={lang === f ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                        >
                            {LANG_LABEL[f] ?? f} ({voices.filter(v => v.language.startsWith(f)).length})
                        </button>
                    ))}
                    <button
                        onClick={() => setLang('all')}
                        className={lang === 'all' ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                    >
                        Todas ({voices.length})
                    </button>
                </div>

                <label className="text-xs font-bold text-ds-soft uppercase tracking-wide block mb-2">
                    Texto de prueba
                </label>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="ds-input w-full"
                />

                <div className="flex items-center justify-between gap-4 flex-wrap mt-3">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-xs text-ds-soft">
                            {text.length} caracteres · se generarán {selectedVoices.length} de {voices.length} voces
                        </span>
                        <label className="flex items-center gap-2 text-xs text-ds-text cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includePolly}
                                onChange={e => setIncludePolly(e.target.checked)}
                                className="accent-ds-accent"
                            />
                            Comparar con Polly <span className="text-ds-soft">(gasta créditos de verdad)</span>
                        </label>
                    </div>

                    <button
                        onClick={run}
                        disabled={running || !available || !text.trim() || selectedVoices.length === 0}
                        className="ds-btn ds-btn--primary"
                    >
                        {running ? 'Generando…' : 'Generar con todas las voces'}
                    </button>
                </div>
            </div>

            {/* Resultados */}
            {results.length > 0 && (
                <div className={card}>
                    <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                        <h2 className="text-lg font-black text-ds-text">Resultados</h2>
                        <span className="text-xs text-ds-soft">
                            {chars} caracteres · {results.length} voces · {(totalMs / 1000).toFixed(1)} s en total
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold text-ds-soft uppercase tracking-wide border-b border-ds-border">
                                    <th className="pb-2 pr-4">Voz</th>
                                    <th className="pb-2 pr-4">Calidad</th>
                                    <th className="pb-2 pr-4">Generación</th>
                                    <th className="pb-2 pr-4" title="Tiempo de generación dividido por la duración del audio. Menos de 1 = más rápido que tiempo real.">
                                        Factor
                                    </th>
                                    <th className="pb-2 pr-4">Audio</th>
                                    <th className="pb-2 pr-4">Peso</th>
                                    <th className="pb-2">Escuchar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map(r => {
                                    const meta = voiceMeta(r.voice);
                                    const q = QUALITY_LABEL[meta?.quality ?? ''] ?? { label: meta?.quality ?? '—', className: 'bg-ds-bg text-ds-soft ' };

                                    return (
                                        <tr key={r.voice} className="border-b border-ds-border">
                                            <td className="py-3 pr-4">
                                                <div className="font-bold text-ds-text">
                                                    {meta?.speaker ?? r.voice}
                                                </div>
                                                <div className="text-xs text-ds-soft">
                                                    {meta?.language} · modelo {meta?.modelSizeMb} MB
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${q.className}`}>
                                                    {q.label}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-ds-text">
                                                {r.fromCache
                                                    ? <span className="text-ds-ok font-bold">caché</span>
                                                    : `${r.generationMs} ms`}
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={`font-bold ${
                                                    r.realtimeFactor === 0 ? 'text-ds-soft'
                                                    : r.realtimeFactor < 0.5 ? 'text-ds-ok '
                                                    : r.realtimeFactor < 1 ? 'text-ds-warn '
                                                    : 'text-ds-danger '
                                                }`}>
                                                    {r.realtimeFactor ? `${r.realtimeFactor}×` : '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-ds-soft">
                                                {r.audioSeconds}s
                                            </td>
                                            <td className="py-3 pr-4 text-ds-soft">
                                                {r.sizeKb} KB
                                            </td>
                                            <td className="py-3">
                                                {r.success && r.url
                                                    ? <audio controls preload="none" src={r.url} className="h-8 max-w-[220px]" />
                                                    : <span className="text-xs text-ds-danger">{r.error ?? 'falló'}</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-xs text-ds-soft mt-4">
                        <strong>Factor</strong>: tiempo de generación dividido por la duración del audio.
                        Por debajo de 1 va más rápido que tiempo real, que es lo que hace falta para
                        que una alerta no se retrase. Las voces se generan en serie, no en paralelo,
                        para no saturar los 4 núcleos que este servidor comparte con el bot.
                    </p>
                </div>
            )}

            {/* Comparativa con Polly */}
            {polly && (
                <div className={`${card} border-ds-accent bg-ds-accent/10 `}>
                    <h2 className="text-lg font-black text-ds-text mb-3">
                        Polly, para comparar
                    </h2>
                    <div className="flex items-center gap-6 flex-wrap">
                        <div>
                            <p className="text-xs text-ds-soft">Voz</p>
                            <p className="font-bold text-ds-text">{polly.voice}</p>
                        </div>
                        <div>
                            <p className="text-xs text-ds-soft">Generación</p>
                            <p className="font-bold text-ds-text">
                                {polly.fromCache ? 'caché' : `${polly.generationMs} ms`}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-ds-soft">Coste</p>
                            <p className="font-bold text-ds-text">
                                {polly.creditsCost} créditos
                                <span className="text-xs font-normal text-ds-soft"> · Piper: 0</span>
                            </p>
                        </div>
                        {polly.url && <audio controls preload="none" src={polly.url} className="h-8 max-w-[220px]" />}
                    </div>
                </div>
            )}
        </div>
    );
}
