import { AlertTriangle, Check, Copy } from 'lucide-react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../../../components/wheel/visualConfig';
import type { Tab, WheelSummary } from '../model';
import { CARD } from '../ui';

/** A donde lleva cada tarjeta de "siguientes pasos", segun el modo de la rueda. */
const NEXT_STEPS: Record<'prizes' | 'raffle', readonly Tab[]> = {
    prizes: ['segments', 'credits', 'limits', 'commands', 'messages', 'look', 'canvas', 'test', 'deliveries'],
    raffle: ['raffle', 'commands', 'messages', 'look', 'canvas', 'history'],
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-4">
            <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-ds-accent text-ds-on-accent font-black flex items-center justify-center text-sm 3xl:text-base">{n}</span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-ds-text text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-ds-soft space-y-2">{children}</div>
            </div>
        </div>
    );
}

/**
 * La pestana que abre por defecto: que es la rueda, como ponerla en OBS y a donde ir
 * despues. Cambia segun el modo (Premios o Sorteo). Es el equivalente de la Guia de
 * Song Request.
 */
export function GuideTab({ wheel, overlayUrl, copied, hasLayout, onCopy, onNavigate, t }: {
    wheel: WheelSummary;
    overlayUrl: string;
    copied: boolean;
    /** La rueda tiene lienzo propio (coordenadas fijas a 1920x1080). */
    hasLayout: boolean;
    onCopy: () => void;
    onNavigate: (tab: Tab) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const mode = wheel.mode === 'raffle' ? 'raffle' : 'prizes';

    return (
        <div className="space-y-4">
            {!wheel.isEnabled && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-ds-warn/40 bg-ds-warn/10 text-ds-warn text-sm 3xl:text-base">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>{t('wheel.guide.offWarning')}</div>
                </div>
            )}

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.guide.title')}</h2>
                    <p className="text-xs 3xl:text-sm text-ds-soft mt-0.5">{t(`wheel.guide.${mode}.description`)}</p>
                </div>

                <div className="p-5 space-y-6">
                    <Step n={1} title={t('wheel.guide.step1Title')}>
                        <p>{t(`wheel.guide.${mode}.what`)}</p>
                    </Step>

                    <Step n={2} title={t('wheel.guide.step2Title')}>
                        <p>{t('wheel.guide.step2Body')}</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 min-w-0 px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-xs 3xl:text-sm text-ds-text truncate">
                                {overlayUrl}
                            </code>
                            <button
                                onClick={onCopy}
                                className="p-2 bg-ds-bg hover:bg-ds-raised border border-ds-border rounded-lg transition-colors"
                                aria-label={t('wheel.overlayUrl.copy')}
                            >
                                {copied ? <Check className="w-4 h-4 text-ds-ok" /> : <Copy className="w-4 h-4 text-ds-soft" />}
                            </button>
                        </div>
                    </Step>

                    <Step n={3} title={t('wheel.guide.step3Title')}>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>{t('wheel.guide.obs1')}</li>
                            <li>{t('wheel.guide.obs2')}</li>
                            <li>{t('wheel.guide.obs3', { width: CANVAS_WIDTH, height: CANVAS_HEIGHT })}</li>
                            <li>{t('wheel.guide.obs4')}</li>
                        </ol>
                        <p className={hasLayout ? 'text-ds-warn/90' : ''}>
                            {hasLayout
                                ? t('wheel.canvas.obsSize', { width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
                                : t('wheel.guide.obsAuto', { width: CANVAS_WIDTH, height: CANVAS_HEIGHT })}
                        </p>
                    </Step>

                    <Step n={4} title={t('wheel.guide.step4Title')}>
                        <p>{t(`wheel.guide.${mode}.test`)}</p>
                    </Step>
                </div>
            </section>

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.guide.nextTitle')}</h2>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                    {NEXT_STEPS[mode].map(key => (
                        <button
                            key={key}
                            onClick={() => onNavigate(key)}
                            className="text-left p-3 rounded-lg bg-ds-bg hover:bg-ds-raised border border-ds-border hover:border-ds-accent/60 transition-colors"
                        >
                            <p className="text-sm 3xl:text-base font-bold text-ds-text">{t(`wheel.tabs.${key}`)}</p>
                            <p className="text-xs 3xl:text-sm text-ds-soft mt-0.5">{t(`wheel.guide.go.${key}`)}</p>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
