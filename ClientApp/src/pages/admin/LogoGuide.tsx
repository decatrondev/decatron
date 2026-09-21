import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Palette, Check, Copy, Download, RotateCcw, ChevronRight } from 'lucide-react';
import api from '../../services/api';

// Herramienta interna de un solo uso: elegir la mascota del bot y armar los
// 7 prompts derivados (master, wordmark, lockup, favicon, avatar, hero) sin
// tener que copiar a mano el mismo texto siete veces. Vive en /admin porque
// solo lo usa el dueño del sistema — no es una feature para streamers.

interface Direction {
    key: 'A' | 'B';
    label: string;
    short: string;
    full: string;
}

const DIRECTIONS: Direction[] = [
    {
        key: 'A',
        label: 'Dirección A — nace de las gemas',
        short: 'Un personaje amigable con cuerpo de cristal/gema facetada, como una gema viviente — facetas geométricas pero silueta suave y aproximable.',
        full: 'A cute, friendly mascot character for a tech streaming-bot brand called "Decatron". The creature\'s body is made of faceted crystal/gem material, like a small living gemstone — sharp geometric facets on the body but a soft, rounded, approachable silhouette overall (think a friendly crystal golem, not a weapon or a threat). Body color is near-black deep charcoal (#0B0D12), with an inner glow and faceted highlights in electric blue (#2563eb) shining through the crystal like energy pulsing inside it. Large simple expressive eyes, glowing blue, no pupils needed — just soft luminous shapes, friendly and alert expression. No mouth, or a tiny simple line if needed. Small stubby limbs or none at all (a rounded gem-body floating slightly works too). Flat vector illustration style with clean geometric shapes, minimal soft gradient only on the glowing parts, crisp vector edges everywhere else — professional tech-brand quality, not a cartoon sticker. Centered, isolated on a plain white background, square 1:1 composition, front-facing three-quarter view, full body visible.'
    },
    {
        key: 'B',
        label: 'Dirección B — criatura propia',
        short: 'Una criatura original, ni robot ni gema, con silueta propia tipo blob — suave y tierna pero claramente digital.',
        full: 'A cute, friendly original creature mascot for a tech streaming-bot brand called "Decatron" — not a robot, not a gemstone, an independent character with its own simple biological-feeling silhouette (think a small blob-like or rounded companion creature, soft and huggable but clearly digital/tech in nature). Body color is near-black deep charcoal (#0B0D12) with smooth matte flat shading. Circuit-like or energy-vein thin lines in electric blue (#2563eb) run subtly across the body like veins of light, and the same blue glows from large simple expressive eyes with a friendly, alert expression. No mouth, or a tiny simple line if needed. Small simple limbs, rounded paws or none. Flat vector illustration style, clean geometric shapes, minimal soft gradient only on the glowing blue parts, crisp vector edges everywhere else — professional tech-brand quality, not a cartoon sticker. Centered, isolated on a plain white background, square 1:1 composition, front-facing three-quarter view, full body visible.'
    }
];

const NEGATIVE = 'No photorealism, no 3D render, no heavy drop shadows, no textured/painted brushwork, no extra colors outside the near-black and electric blue palette (except white background), no text baked into the mascot images, no watermark, no signature, no busy background clutter, no gradient mesh noise, no low resolution, no blurry edges, no asymmetric or messy linework.';

interface StepDef {
    id: string;
    label: string;
}

const STEPS: StepDef[] = [
    { id: 'direction', label: 'Elegir dirección' },
    { id: 'master', label: 'Personaje en 4K' },
    { id: 'wordmark', label: 'Wordmark' },
    { id: 'lockup', label: 'Lockup para el hero' },
    { id: 'favicon', label: 'Favicon' },
    { id: 'avatar', label: 'Avatar de chat' },
    { id: 'hero', label: 'Hero de la landing' },
    { id: 'done', label: 'Listo' }
];

const STORAGE_KEY = 'decatron-admin-logo-guide-v1';

interface PersistedState {
    currentIndex: number;
    completed: string[];
    directionKey: 'A' | 'B' | null;
    description: string | null;
}

function loadState(): PersistedState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore
    }
    return { currentIndex: 0, completed: [], directionKey: null, description: null };
}

function promptFor(stepId: string, desc: string): string {
    switch (stepId) {
        case 'master':
            return `${desc}\n\nUltra high resolution, 4K, clean production-ready vector illustration, perfectly centered, generous padding around the character, plain white background, no text, no watermark, no shadow on the ground.`;
        case 'wordmark':
            return 'Wordmark logotype design for the text "DECATRON", geometric sans-serif typography, tech and futuristic feel, precise straight lines and sharp angular terminals, slightly condensed letterforms, all uppercase, strong and confident weight (semi-bold to bold), excellent legibility at small sizes. Color: near-black (#0B0D12) with the letters "T" and "R" or a single accent stroke/underline in electric blue (#2563eb) to tie it to the brand color. Flat vector, no gradients except a subtle glow if used on a dark background. Provide on a plain white background, no other elements, no tagline, no icon — typography only.';
        case 'lockup':
            return `Logo lockup combining ${desc} positioned to the left, with the wordmark "DECATRON" in bold geometric sans-serif typography to the right, same near-black (#0B0D12) body/text color with electric blue (#2563eb) glow accents tying the two together. Clean horizontal lockup, generous spacing between mascot and text, both vertically centered and aligned. Flat vector illustration style with subtle glow depth on the blue accents only. Isolated on a plain white background, no tagline, no extra decoration, production-ready brand lockup, ultra high resolution.`;
        case 'favicon':
            return `Extremely simplified icon version of ${desc}, reduced to the absolute minimum shapes needed to stay recognizable at 16x16 pixels: the overall silhouette, the two glowing eyes, and one strong color block. Body in near-black (#0B0D12), eyes and one accent shape in electric blue (#2563eb). No fine details, no thin lines, no gradients, bold flat shapes only, thick enough strokes to survive downscaling. Square 1:1 composition, centered, tight crop with minimal padding, plain white or transparent background, vector icon style like an app icon.`;
        case 'avatar':
            return `${desc}, head-and-shoulders close-up crop, friendly expression clearly visible, composed to fill a circular frame with the character's face as the focal point, slight padding so nothing important gets cut off by the circular mask. Body near-black (#0B0D12), glowing blue (#2563eb) eyes and accents, flat vector style with subtle glow depth. Centered, square 1:1 canvas (will be cropped to a circle by the platform), plain white or solid dark background for contrast, high resolution, no text.`;
        case 'hero':
            return `Wide hero illustration for a streaming-bot product website. ${desc} as the main character, in a dynamic confident pose (floating, mid-action, or looking directly at viewer), surrounded by subtle floating UI/tech elements suggesting a streaming dashboard — soft glowing chat bubbles, small geometric icons, faint circuit-like light trails — all in the same near-black (#0B0D12) and electric blue (#2563eb) palette, low visual noise, lots of negative space around the character so the website's own text can overlay comfortably on one side. Flat vector illustration style with soft glow depth on blue elements, dark background (near-black #0B0D12) with the character and accents glowing blue against it, cinematic and premium feeling, ultra high resolution, wide 16:9 composition, no text, no logo wordmark baked in.`;
        default:
            return '';
    }
}

function CopyBlock({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const doCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    return (
        <div className="relative bg-[#0B0D12] rounded-xl p-5 mb-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[#D8E4FF] pr-24">
                {text}
            </pre>
            <button
                onClick={doCopy}
                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors ${
                    copied
                        ? 'border-green-500 text-green-400'
                        : 'border-[#2A3142] text-[#8A93A6] hover:border-[#7DA6FF] hover:text-[#7DA6FF]'
                }`}
            >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
            </button>
        </div>
    );
}

function NegativePrompt() {
    return (
        <details className="mb-4">
            <summary className="cursor-pointer text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">
                Negative prompt (aplica a todos los pasos)
            </summary>
            <CopyBlock text={NEGATIVE} />
        </details>
    );
}

function Hint({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8] my-4">
            {children}
        </div>
    );
}

export default function LogoGuide() {
    const navigate = useNavigate();
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [state, setState] = useState<PersistedState>(loadState);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/admin/decatron-ai/check-owner');
                if (res.data.isOwner) {
                    setIsOwner(true);
                } else {
                    navigate('/dashboard');
                }
            } catch {
                navigate('/dashboard');
            } finally {
                setLoading(false);
            }
        })();
    }, [navigate]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            // ignore
        }
    }, [state]);

    const goTo = (index: number) => setState(s => ({ ...s, currentIndex: index }));

    const markDoneAndAdvance = useCallback(() => {
        setState(s => {
            const id = STEPS[s.currentIndex].id;
            const completed = s.completed.includes(id) ? s.completed : [...s.completed, id];
            const currentIndex = Math.min(s.currentIndex + 1, STEPS.length - 1);
            return { ...s, completed, currentIndex };
        });
    }, []);

    const chooseDirection = (key: 'A' | 'B') => {
        const dir = DIRECTIONS.find(d => d.key === key)!;
        setState(s => ({ ...s, directionKey: key, description: dir.full }));
    };

    const description = state.description || '[Todavía no elegiste una dirección en el paso 1 — volvé y elegí A o B primero.]';

    const downloadAll = () => {
        const parts = [
            'PROMPTS FINALES — DECATRON',
            `Direccion elegida: ${state.directionKey ? DIRECTIONS.find(d => d.key === state.directionKey)!.label : 'sin elegir'}`,
            '',
            '== PERSONAJE MAESTRO (4K) ==', promptFor('master', description),
            '', '== WORDMARK ==', promptFor('wordmark', description),
            '', '== LOCKUP PARA EL HERO ==', promptFor('lockup', description),
            '', '== FAVICON ==', promptFor('favicon', description),
            '', '== AVATAR DE CHAT ==', promptFor('avatar', description),
            '', '== HERO DE LA LANDING ==', promptFor('hero', description),
            '', '== NEGATIVE PROMPT (aplica a todos) ==', NEGATIVE
        ];
        const blob = new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'decatron-logo-prompts-finales.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563eb]"></div>
            </div>
        );
    }

    if (!isOwner) return null;

    const step = STEPS[state.currentIndex];
    const stepNum = state.currentIndex + 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/admin')} className="p-2 hover:bg-[#f8fafc] dark:hover:bg-[#262626] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                    <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                </button>
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Palette className="w-7 h-7 text-[#2563eb]" />
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Logo de Decatron</h1>
                    </div>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">Elegís, copiás, generás afuera, volvés y seguís — 8 pasos.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
                {/* Nav de pasos */}
                <nav className="space-y-1 lg:sticky lg:top-6">
                    {STEPS.map((s, i) => {
                        const isCurrent = i === state.currentIndex;
                        const isDone = state.completed.includes(s.id);
                        return (
                            <button
                                key={s.id}
                                onClick={() => goTo(i)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                                    isCurrent
                                        ? 'bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] font-bold text-[#1e293b] dark:text-[#f8fafc]'
                                        : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                                    isDone
                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-600 dark:text-green-400'
                                        : isCurrent
                                            ? 'bg-[#2563eb] border-[#2563eb] text-white'
                                            : 'border-[#e2e8f0] dark:border-[#374151] text-[#94a3b8]'
                                }`}>
                                    {isDone ? <Check className="w-3 h-3" /> : i + 1}
                                </span>
                                {s.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Panel principal */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] min-h-[420px]">
                    <p className="font-mono text-xs uppercase tracking-wider text-[#2563eb] mb-2">Paso {stepNum} de {STEPS.length}</p>

                    {step.id === 'direction' && (
                        <>
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-3">Elegí la dirección del personaje</h2>
                            <p className="text-[#64748b] dark:text-[#94a3b8] max-w-2xl mb-6">
                                Generá los dos afuera si querés, y cuando tengas uno que te convenza más, marcalo acá — queda guardado como la descripción base para los otros seis prompts.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {DIRECTIONS.map(d => (
                                    <div key={d.key} className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl p-5 flex flex-col gap-3">
                                        <h3 className="font-black text-sm text-[#1e293b] dark:text-[#f8fafc]">{d.label}</h3>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] flex-1">{d.short}</p>
                                        <CopyBlock text={d.full} />
                                        <button
                                            onClick={() => chooseDirection(d.key)}
                                            className={`self-start px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                                                state.directionKey === d.key
                                                    ? 'bg-[#2563eb] text-white'
                                                    : 'bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:border-[#2563eb]'
                                            }`}
                                        >
                                            {state.directionKey === d.key ? 'Elegida ✓' : 'Elegir esta'}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {state.directionKey && (
                                <>
                                    <p className="text-xs font-mono uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-2">
                                        Descripción base (editable — se usa en los pasos 4 a 7)
                                    </p>
                                    <textarea
                                        className="w-full min-h-[140px] font-mono text-xs leading-relaxed p-4 rounded-xl bg-[#0B0D12] text-[#D8E4FF] mb-4"
                                        value={state.description || ''}
                                        onChange={e => setState(s => ({ ...s, description: e.target.value }))}
                                    />
                                </>
                            )}

                            <NegativePrompt />

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={markDoneAndAdvance}
                                    disabled={!state.directionKey}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-colors"
                                >
                                    Confirmar dirección y continuar <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    )}

                    {step.id !== 'direction' && step.id !== 'done' && (
                        <>
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-3">
                                {step.id === 'master' && 'Personaje maestro, en 4K'}
                                {step.id === 'wordmark' && 'Wordmark — el nombre en texto'}
                                {step.id === 'lockup' && 'Lockup combinado, para el hero'}
                                {step.id === 'favicon' && 'Favicon — versión mínima'}
                                {step.id === 'avatar' && 'Avatar de chat'}
                                {step.id === 'hero' && 'Hero de la landing'}
                            </h2>
                            <p className="text-[#64748b] dark:text-[#94a3b8] max-w-2xl mb-6">
                                {step.id === 'master' && 'Pegá esto en tu IA de imágenes y generá hasta que salga una versión que te convenza. Esa imagen es tu referencia oficial para todo lo demás.'}
                                {step.id === 'wordmark' && 'No depende del personaje — es la tipografía del nombre "DECATRON" sola.'}
                                {step.id === 'lockup' && 'El personaje y el wordmark juntos, en una composición horizontal.'}
                                {step.id === 'favicon' && 'Reducida a lo esencial para que se lea bien a 16-32px.'}
                                {step.id === 'avatar' && 'Para Twitch, Kick y Discord — se recorta en círculo, la cara centrada.'}
                                {step.id === 'hero' && 'La escena grande para decatron.net, con espacio para que el texto del sitio se superponga.'}
                            </p>

                            <CopyBlock text={promptFor(step.id, description)} />
                            <NegativePrompt />

                            {step.id === 'master' && (
                                <>
                                    <Hint><span><strong className="text-[#1e293b] dark:text-[#f8fafc]">Tip Midjourney:</strong> agregá <code>--ar 1:1 --style raw --v 6</code> al final.</span></Hint>
                                    <Hint><span><strong className="text-[#1e293b] dark:text-[#f8fafc]">Guardá esta imagen</strong> — en los próximos pasos la subís como referencia para que el personaje no varíe de un formato a otro.</span></Hint>
                                </>
                            )}
                            {(step.id === 'lockup' || step.id === 'favicon' || step.id === 'avatar') && (
                                <Hint>Si tu herramienta soporta imagen de referencia, subí el resultado del paso 2 antes de generar este.</Hint>
                            )}
                            {step.id === 'hero' && (
                                <Hint><span><strong className="text-[#1e293b] dark:text-[#f8fafc]">Tip Midjourney:</strong> agregá <code>--ar 16:9 --style raw --v 6</code>.</span></Hint>
                            )}

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => goTo(Math.max(0, state.currentIndex - 1))}
                                    className="px-4 py-2.5 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg font-bold text-sm text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={markDoneAndAdvance}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors"
                                >
                                    {step.id === 'hero' ? 'Ya lo generé, terminar' : 'Ya lo generé, continuar'} <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    )}

                    {step.id === 'done' && (
                        <>
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-3">Listo — tenés las siete piezas</h2>
                            <p className="text-[#64748b] dark:text-[#94a3b8] max-w-2xl mb-6">
                                Repasá qué generaste. Si algo no te convenció, volvé al paso con el riel de la izquierda y regenerá solo esa pieza.
                            </p>
                            <ul className="space-y-2 mb-6">
                                {STEPS.filter(s => s.id !== 'direction' && s.id !== 'done').map(s => {
                                    const done = state.completed.includes(s.id);
                                    return (
                                        <li key={s.id} className="flex items-center justify-between px-4 py-2.5 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm">
                                            <span className="text-[#1e293b] dark:text-[#f8fafc]">{s.label}</span>
                                            <span className={`font-mono text-xs font-bold ${done ? 'text-green-600 dark:text-green-400' : 'text-[#94a3b8]'}`}>
                                                {done ? 'Generado' : 'Pendiente'}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>

                            <Hint>
                                <span><strong className="text-[#1e293b] dark:text-[#f8fafc]">Para que las siete piezas se sientan la misma marca:</strong> subí la imagen del paso 2 como referencia al generar cada una de las demás, en vez de confiar solo en el texto.</span>
                            </Hint>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => goTo(Math.max(0, state.currentIndex - 1))}
                                    className="px-4 py-2.5 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg font-bold text-sm text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={downloadAll}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors"
                                >
                                    <Download className="w-4 h-4" /> Descargar los 7 prompts (.txt)
                                </button>
                                <button
                                    onClick={() => setState({ currentIndex: 0, completed: [], directionKey: null, description: null })}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg font-bold text-sm text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4" /> Empezar de nuevo
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
