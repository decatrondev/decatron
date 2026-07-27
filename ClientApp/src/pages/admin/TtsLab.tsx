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
    x_low:  { label: 'Muy baja', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    low:    { label: 'Baja',     className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    medium: { label: 'Media',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    high:   { label: 'Alta',     className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
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

    const card = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                    Laboratorio de voces
                </h1>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Piper corre en este servidor y no cuesta por carácter, solo CPU. Aquí se compara
                    con Polly para decidir si puede sustituir al nivel gratuito.
                </p>
            </div>

            {!available && (
                <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                    <p className="text-sm font-bold text-red-700 dark:text-red-300">
                        Piper no está instalado o no se encuentran las voces en el servidor.
                    </p>
                </div>
            )}

            {/* Entrada */}
            <div className={card}>
                {/* Filtro por idioma: sin esto cada prueba genera las 23 voces en serie */}
                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide block mb-2">
                    Idioma
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                    {families.map(f => (
                        <button
                            key={f}
                            onClick={() => changeLang(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                lang === f
                                    ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white border-transparent'
                                    : 'bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300'
                            }`}
                        >
                            {LANG_LABEL[f] ?? f} ({voices.filter(v => v.language.startsWith(f)).length})
                        </button>
                    ))}
                    <button
                        onClick={() => setLang('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            lang === 'all'
                                ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white border-transparent'
                                : 'bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300'
                        }`}
                    >
                        Todas ({voices.length})
                    </button>
                </div>

                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide block mb-2">
                    Texto de prueba
                </label>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />

                <div className="flex items-center justify-between gap-4 flex-wrap mt-3">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            {text.length} caracteres · se generarán {selectedVoices.length} de {voices.length} voces
                        </span>
                        <label className="flex items-center gap-2 text-xs text-[#1e293b] dark:text-[#f8fafc] cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includePolly}
                                onChange={e => setIncludePolly(e.target.checked)}
                                className="accent-blue-600"
                            />
                            Comparar con Polly <span className="text-[#94a3b8]">(gasta créditos de verdad)</span>
                        </label>
                    </div>

                    <button
                        onClick={run}
                        disabled={running || !available || !text.trim() || selectedVoices.length === 0}
                        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {running ? 'Generando…' : 'Generar con todas las voces'}
                    </button>
                </div>
            </div>

            {/* Resultados */}
            {results.length > 0 && (
                <div className={card}>
                    <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                        <h2 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Resultados</h2>
                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            {chars} caracteres · {results.length} voces · {(totalMs / 1000).toFixed(1)} s en total
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide border-b border-[#e2e8f0] dark:border-[#374151]">
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
                                    const q = QUALITY_LABEL[meta?.quality ?? ''] ?? { label: meta?.quality ?? '—', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };

                                    return (
                                        <tr key={r.voice} className="border-b border-[#f1f5f9] dark:border-[#262626]">
                                            <td className="py-3 pr-4">
                                                <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                    {meta?.speaker ?? r.voice}
                                                </div>
                                                <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                    {meta?.language} · modelo {meta?.modelSizeMb} MB
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${q.className}`}>
                                                    {q.label}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-[#1e293b] dark:text-[#f8fafc]">
                                                {r.fromCache
                                                    ? <span className="text-green-600 dark:text-green-400 font-bold">caché</span>
                                                    : `${r.generationMs} ms`}
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={`font-bold ${
                                                    r.realtimeFactor === 0 ? 'text-[#94a3b8]'
                                                    : r.realtimeFactor < 0.5 ? 'text-green-600 dark:text-green-400'
                                                    : r.realtimeFactor < 1 ? 'text-yellow-600 dark:text-yellow-500'
                                                    : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                    {r.realtimeFactor ? `${r.realtimeFactor}×` : '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-[#64748b] dark:text-[#94a3b8]">
                                                {r.audioSeconds}s
                                            </td>
                                            <td className="py-3 pr-4 text-[#64748b] dark:text-[#94a3b8]">
                                                {r.sizeKb} KB
                                            </td>
                                            <td className="py-3">
                                                {r.success && r.url
                                                    ? <audio controls preload="none" src={r.url} className="h-8 max-w-[220px]" />
                                                    : <span className="text-xs text-red-600 dark:text-red-400">{r.error ?? 'falló'}</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-4">
                        <strong>Factor</strong>: tiempo de generación dividido por la duración del audio.
                        Por debajo de 1 va más rápido que tiempo real, que es lo que hace falta para
                        que una alerta no se retrase. Las voces se generan en serie, no en paralelo,
                        para no saturar los 4 núcleos que este servidor comparte con el bot.
                    </p>
                </div>
            )}

            {/* Comparativa con Polly */}
            {polly && (
                <div className={`${card} border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20`}>
                    <h2 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-3">
                        Polly, para comparar
                    </h2>
                    <div className="flex items-center gap-6 flex-wrap">
                        <div>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Voz</p>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{polly.voice}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Generación</p>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                {polly.fromCache ? 'caché' : `${polly.generationMs} ms`}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Coste</p>
                            <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                {polly.creditsCost} créditos
                                <span className="text-xs font-normal text-[#64748b] dark:text-[#94a3b8]"> · Piper: 0</span>
                            </p>
                        </div>
                        {polly.url && <audio controls preload="none" src={polly.url} className="h-8 max-w-[220px]" />}
                    </div>
                </div>
            )}
        </div>
    );
}
