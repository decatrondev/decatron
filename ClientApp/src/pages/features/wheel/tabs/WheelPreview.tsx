import { type WheelVisual } from '../../../../components/wheel/visualConfig';
import WheelCelebration from '../../../../components/wheel/WheelCelebration';
import { presentationOf } from '../../../../components/wheel/presentations';
import { type Segment } from '../model';
import { ALTO_PREVIEW } from '../ui';

/**
 * La misma rueda que verá el streamer en OBS, dibujada acá para que pueda ajustar
 * colores y textos sin tener que ir a mirar la escena.
 */
export function WheelPreview({ segments, visual, celebNonce, t }: {
    segments: Segment[];
    visual: WheelVisual;
    /** Cada incremento reproduce la celebracion sobre el preview. */
    celebNonce: number;
    t: any;
}) {
    const visibles = segments.filter(s => s.isEnabled);

    // Con menos de dos gajos no hay rueda que dibujar, pero desaparecer sin decir
    // nada deja un hueco mudo justo donde el streamer espera ver su rueda — y en una
    // rueda recien creada, que nace sin gajos, ese es el primer estado que ve.
    if (visibles.length < 2) {
        return (
            <div className="rounded-xl border border-dashed border-[#374151] p-6 text-center">
                <p className="text-xs text-[#94a3b8]">{t('wheel.look.previewNeedsSegments')}</p>
            </div>
        );
    }

    const pres = presentationOf(visual);

    return (
        <div
            className="relative rounded-xl border border-[#374151] p-4 flex justify-center overflow-hidden"
            // El fondo del preview imita el del overlay. Con fondo transparente se
            // muestra un tablero de ajedrez, que es como se ve en OBS: pintarlo de
            // gris haria creer que la rueda trae un fondo que no tiene.
            style={visual.background === 'transparent'
                ? {
                    backgroundColor: '#1B1C1D',
                    backgroundImage:
                        'linear-gradient(45deg, #262626 25%, transparent 25%, transparent 75%, #262626 75%),' +
                        'linear-gradient(45deg, #262626 25%, transparent 25%, transparent 75%, #262626 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 8px 8px',
                }
                : { background: visual.background }}
        >
            {/* La MISMA presentacion que dibuja el overlay, en reposo: si el preview
                usara su propia copia, mostraria algo distinto de lo que va a salir en
                pantalla, que es justo lo que un preview no puede permitirse. La forma
                del lienzo tambien sale de ella, asi que una tira horizontal se
                previsualiza como tira sin tocar nada de aca. */}
            <div
                className="relative"
                // El preview CRECE con la columna en vez de quedarse clavado: ocupa el
                // ancho disponible y el alto sale de la proporcion. El tope se pone en
                // el ancho (`alto maximo x proporcion`) y no en el alto, porque asi la
                // forma la sigue mandando la presentacion: un carrete no estira la
                // columna y una tira no sale deformada al toparse con el maximo.
                style={{
                    aspectRatio: String(pres.aspect),
                    width: '100%',
                    maxWidth: `${(ALTO_PREVIEW * pres.aspect).toFixed(1)}px`,
                    marginInline: 'auto',
                }}
            >
                <pres.Component
                    segments={visibles.map(sg => ({ id: sg.id, label: sg.label || '—', color: sg.color, icon: sg.icon }))}
                    visual={visual}
                    spin={null}
                    phase="idle"
                    onSound={() => { }}
                    onFinished={() => { }}
                />
            </div>

            {/* El mismo componente que el overlay, en el mismo alto relativo: lo que se
                ve aca al pulsar "probar" es la celebracion de verdad, encogida. */}
            <WheelCelebration visual={visual} nonce={celebNonce} seconds={3} />
        </div>
    );
}
