import { useEffect, useState } from 'react';
import { Inbox, Plus, Save, Trash2, Settings, Search } from 'lucide-react';
import api from '../../services/api';
import {
    DsRoot, Button, IconButton, Field, Input, Textarea, Select, Switch, Checkbox, Tabs, Segmented, Card, Badge, Alert,
    Progress, Spinner, Eyebrow, Table, Modal, Toast, Empty,
} from '../../components/ds';
import type { DsTheme } from '../../components/ds/tokens';
import { getActiveDesign } from '../../design/runtime';
import DesignEditor from './DesignEditor';
import { highlightCode } from '../commands/scripting/grammar';
import TabIcon from '../../components/dashboard/TabIcon';

/**
 * Guía de estilo viva (solo dueño). Fase 0 del sistema de diseño: SIN conectar a ninguna página ni a la base de datos.
 * Muestra cada componente de `components/ds` en todos sus estados, en claro y oscuro. Plan: .dev/plans/SISTEMA_DE_DISENO_PLAN.md
 */

const SECTIONS = [
    ['principios', 'Principios'], ['colores', 'Colores y contraste'], ['tipografia', 'Tipografía'], ['botones', 'Botones'],
    ['campos', 'Campos'], ['seleccion', 'Selección'], ['navegacion', 'Pestañas'], ['tarjetas', 'Tarjetas y etiquetas'],
    ['avisos', 'Avisos'], ['tabla', 'Tabla'], ['modal', 'Modal y avisos emergentes'], ['estados', 'Vacío y cargando'], ['ambiente', 'Ambiente'], ['codigo', 'Código y pestañas'],
] as const;

function lum(hex: string) {
    const c = hex.replace('#', '').match(/.{2}/g)!.map(h => parseInt(h, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function Block({ id, eyebrow, title, note, children }: { id: string; eyebrow: string; title: string; note?: string; children: React.ReactNode }) {
    return (
        <section id={id} style={{ scrollMarginTop: 80, padding: '40px 0', borderTop: '1px solid var(--ds-border)' }}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="ds-h2">{title}</h2>
            {note && <p className="ds-card-text" style={{ margin: '8px 0 0', maxWidth: 680 }}>{note}</p>}
            <div style={{ marginTop: 24, display: 'grid', gap: 24 }}>{children}</div>
        </section>
    );
}
const Row = ({ label, children }: { label?: string; children: React.ReactNode }) => (
    <div>
        {label && <p style={{ font: '500 12px var(--ds-font-mono)', color: 'var(--ds-soft)', margin: '0 0 10px' }}>{label}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</div>
    </div>
);

export default function DesignGuide() {
    const [access, setAccess] = useState<'loading' | 'ok' | 'no'>('loading');
    const [theme, setTheme] = useState<DsTheme>('dark');
    const [tab, setTab] = useState('uno');
    const [seg, setSeg] = useState('mes');
    const [sw, setSw] = useState(true);
    const [loadingBtn, setLoadingBtn] = useState(false);
    const [mode, setMode] = useState<'guia' | 'editor'>('guia');

    useEffect(() => {
        api.get('/admin/decatron-ai/check-owner').then(r => setAccess(r.data?.isOwner === true ? 'ok' : 'no')).catch(() => setAccess('no'));
    }, []);

    if (access === 'loading') return <p style={{ padding: 32 }}>...</p>;
    if (access === 'no') return <p style={{ padding: 32 }}>Esta guía es solo para el dueño del sistema.</p>;

    const design = getActiveDesign();
    const c = design.colors[theme];
    const DS_SHAPE = design.shape;
    const pairs: [string, string, string][] = [
        ['Texto sobre fondo', c.text, c.bg], ['Texto sobre superficie', c.text, c.surface], ['Texto de apoyo sobre superficie', c.soft, c.surface],
        ['Texto tenue sobre fondo', c.faint, c.bg], ['Azul (texto) sobre superficie', c.accentText, c.surface], ['Texto del botón principal', c.onAccent, c.accent],
        ['Botón principal al pasar el mouse', c.onAccent, c.accentHover], ['Estado correcto sobre superficie', c.ok, c.surface],
        ['Aviso sobre superficie', c.warn, c.surface], ['Error sobre superficie', c.danger, c.surface],
    ];

    if (mode === 'editor') return <DsRoot theme={theme}><DesignEditor onClose={() => setMode('guia')} /></DsRoot>;

    return (
        <DsRoot theme={theme} className="" >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 220px) minmax(0, 1fr)', gap: 32, padding: '24px 32px 80px', maxWidth: 1400, margin: '0 auto' }}>
                <aside style={{ position: 'sticky', top: 16, alignSelf: 'start', display: 'grid', gap: 2 }}>
                    <p className="ds-eyebrow" style={{ marginBottom: 12 }}>guía de estilo</p>
                    {SECTIONS.map(([id, label]) => (
                        <a key={id} href={`#${id}`} style={{ padding: '6px 10px', fontSize: 14, color: 'var(--ds-soft)', borderLeft: '2px solid var(--ds-border)', textDecoration: 'none' }}>{label}</a>
                    ))}
                </aside>

                <main>
                    <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                            <Eyebrow>sistema de diseño</Eyebrow>
                            <h1 className="ds-h1">Guía de estilo</h1>
                            <p className="ds-card-text" style={{ marginTop: 8, maxWidth: 640 }}>
                                Referencia de todos los componentes y sus estados, con los valores que están publicados hoy. Para cambiarlos usa «Editar valores».
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><Button variant="secondary" onClick={() => setMode('editor')}>Editar valores</Button><Segmented items={[{ id: 'dark', label: 'Oscuro' }, { id: 'light', label: 'Claro' }]} value={theme} onChange={v => setTheme(v as DsTheme)} /></div>
                    </header>

                    <Block id="principios" eyebrow="reglas" title="Principios" note="Lo que no cambia en ninguna pantalla.">
                        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                            {[
                                ['Un solo botón', 'Tres alturas fijas (32, 40 y 48 px), un radio y un peso de letra. Nadie escribe un botón a mano.'],
                                ['Un solo azul', 'El azul solo marca lo que se puede tocar o está activo. Todo lo demás es grafito.'],
                                ['Estados con significado', 'Verde, ámbar y rojo solo para estados (correcto, aviso, error). Nunca decorativos.'],
                                ['Siempre accesible', 'Foco visible en todo, contraste AA en texto y estados desactivados reconocibles.'],
                            ].map(([t, d]) => <Card key={t}><p className="ds-card-title">{t}</p><p className="ds-card-text">{d}</p></Card>)}
                        </div>
                    </Block>

                    <Block id="colores" eyebrow="valores" title="Colores y contraste" note="Los valores salen de tokens.ts. La tabla calcula el contraste real: 4.5 o más cumple AA para texto normal.">
                        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                            {Object.entries(c).map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius)', background: 'var(--ds-surface)' }}>
                                    <span style={{ width: 32, height: 32, borderRadius: 4, background: v, border: '1px solid var(--ds-border)', flex: 'none' }} />
                                    <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{k}</p><p style={{ margin: 0, fontSize: 12, fontFamily: 'var(--ds-font-mono)', color: 'var(--ds-soft)' }}>{v}</p></div>
                                </div>
                            ))}
                        </div>
                        <Table head={['Par', 'Contraste', 'AA']} rows={pairs.map(([n, a, b]) => {
                            const r = ratio(a, b);
                            return [n, r.toFixed(2), r >= 4.5 ? <Badge tone="ok">cumple</Badge> : r >= 3 ? <Badge tone="warn">solo texto grande</Badge> : <Badge tone="danger">no cumple</Badge>];
                        })} />
                    </Block>

                    <Block id="tipografia" eyebrow="texto" title="Tipografía" note="Onest para interfaz y titulares, JetBrains Mono para etiquetas y datos.">
                        <Card>
                            <p className="ds-h1" style={{ fontSize: 44 }}>Tu bot, en cada chat</p>
                            <p className="ds-h2" style={{ marginTop: 12 }}>Título de sección</p>
                            <p className="ds-card-title" style={{ marginTop: 12 }}>Título de tarjeta</p>
                            <p className="ds-card-text" style={{ maxWidth: 560 }}>Texto de párrafo para leer con comodidad: línea corta, altura de línea generosa y un gris de apoyo que sigue cumpliendo el contraste.</p>
                            <p className="ds-eyebrow" style={{ marginTop: 16 }}>etiqueta en mono</p>
                        </Card>
                    </Block>

                    <Block id="botones" eyebrow="componente" title="Botones" note="Cuatro variantes, tres tamaños. El mismo botón en toda la web.">
                        <Table
                            head={['Tamaño', 'Altura', 'Relleno lateral', 'Letra', 'Radio', 'Peso']}
                            rows={(['sm', 'md', 'lg'] as const).map(s => [s.toUpperCase(), `${DS_SHAPE.sizes[s].height} px`, `${DS_SHAPE.sizes[s].padX} px`, `${DS_SHAPE.sizes[s].font} px`, `${DS_SHAPE.radius} px`, String(DS_SHAPE.weight)])}
                        />
                        {(['primary', 'secondary', 'ghost', 'danger'] as const).map(v => (
                            <Row key={v} label={`${v} · pequeño, mediano, grande`}>
                                <Button variant={v} size="sm">Guardar</Button><Button variant={v}>Guardar</Button><Button variant={v} size="lg">Guardar</Button>
                                <Button variant={v} icon={<Save />}>Con icono</Button>
                            </Row>
                        ))}
                        <Row label="estados del botón principal (los forzados solo sirven para verlos)">
                            <Button>Normal</Button><Button force="hover">Hover</Button><Button force="focus">Foco</Button><Button force="active">Pulsado</Button>
                            <Button disabled>Desactivado</Button><Button loading>Cargando</Button>
                        </Row>
                        <Row label="estados del botón secundario">
                            <Button variant="secondary">Normal</Button><Button variant="secondary" force="hover">Hover</Button><Button variant="secondary" force="focus">Foco</Button>
                            <Button variant="secondary" force="active">Pulsado</Button><Button variant="secondary" disabled>Desactivado</Button><Button variant="secondary" loading>Cargando</Button>
                        </Row>
                        <Row label="botón con acción real (cargando 2 segundos)">
                            <Button loading={loadingBtn} onClick={() => { setLoadingBtn(true); setTimeout(() => setLoadingBtn(false), 2000); }} icon={<Save />}>Probar carga</Button>
                        </Row>
                        <Row label="botones de icono (la etiqueta accesible es obligatoria)">
                            <IconButton label="Buscar" icon={<Search />} size="sm" /><IconButton label="Ajustes" icon={<Settings />} />
                            <IconButton label="Añadir" icon={<Plus />} variant="secondary" size="lg" /><IconButton label="Eliminar" icon={<Trash2 />} variant="danger" />
                        </Row>
                        <div style={{ maxWidth: 360 }}><Button block size="lg">Botón de ancho completo</Button></div>
                    </Block>

                    <Block id="campos" eyebrow="componente" title="Campos" note="Misma altura que los botones del mismo tamaño.">
                        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                            <Field label="Normal" hint="Texto de ayuda"><Input placeholder="Escribe aquí" /></Field>
                            <Field label="Hover"><Input placeholder="Pasa el mouse" force="hover" /></Field>
                            <Field label="Foco"><Input placeholder="Con foco" force="focus" /></Field>
                            <Field label="Con error" error="Este campo es obligatorio"><Input error placeholder="Obligatorio" /></Field>
                            <Field label="Desactivado"><Input disabled placeholder="No editable" /></Field>
                            <Field label="Selector"><Select defaultValue="b"><option value="a">Opción A</option><option value="b">Opción B</option></Select></Field>
                        </div>
                        <div style={{ maxWidth: 520 }}><Field label="Área de texto" hint="Hasta 255 caracteres"><Textarea placeholder="Escribe un mensaje" /></Field></div>
                    </Block>

                    <Block id="seleccion" eyebrow="componente" title="Selección" note="Interruptor para activar o desactivar al instante; casilla y radio para formularios.">
                        <Row label="interruptor"><Switch checked={sw} onChange={setSw} label="Activar" /><Switch checked={false} label="Apagado" /><Switch checked disabled label="Desactivado" /></Row>
                        <Row label="casilla y radio"><Checkbox label="Casilla" defaultChecked /><Checkbox label="Sin marcar" /><Checkbox label="Desactivada" disabled /><Checkbox radio name="r" label="Radio A" defaultChecked /><Checkbox radio name="r" label="Radio B" /></Row>
                    </Block>

                    <Block id="navegacion" eyebrow="componente" title="Pestañas" note="Pestañas subrayadas para secciones; selector segmentado para cambiar de vista o periodo.">
                        <Tabs value={tab} onChange={setTab} items={[{ id: 'uno', label: 'Resumen' }, { id: 'dos', label: 'Comandos' }, { id: 'tres', label: 'Overlays' }]} />
                        <Row label="selector segmentado"><Segmented value={seg} onChange={setSeg} items={[{ id: 'mes', label: 'Mensual' }, { id: 'perm', label: 'Permanente' }]} /></Row>
                    </Block>

                    <Block id="tarjetas" eyebrow="componente" title="Tarjetas y etiquetas" note="Un solo estilo de tarjeta. Las etiquetas son neutras; el color solo indica estado.">
                        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                            <Card><p className="ds-card-title">Tarjeta</p><p className="ds-card-text">Contenido con borde y superficie.</p></Card>
                            <Card variant="raised"><p className="ds-card-title">Destacada</p><p className="ds-card-text">Un nivel por encima de la base.</p></Card>
                            <Card interactive><p className="ds-card-title">Interactiva</p><p className="ds-card-text">El borde se acerca al azul al pasar el mouse.</p></Card>
                            <Card interactive force="hover"><p className="ds-card-title">Interactiva (hover)</p><p className="ds-card-text">Estado forzado para verlo.</p></Card>
                        </div>
                        <Row label="etiquetas"><Badge>Neutra</Badge><Badge tone="accent">Activa</Badge><Badge tone="ok">Correcto</Badge><Badge tone="warn">Aviso</Badge><Badge tone="danger">Error</Badge></Row>
                    </Block>

                    <Block id="avisos" eyebrow="componente" title="Avisos" note="Borde completo y tenue del color del estado, un tinte mínimo de fondo y el color solo en el icono. Sin barra lateral.">
                        <div style={{ display: 'grid', gap: 10, maxWidth: 640 }}>
                            <Alert tone="info" title="Información">Los cambios se aplican en unos segundos.</Alert>
                            <Alert tone="ok" title="Guardado">La configuración se guardó correctamente.</Alert>
                            <Alert tone="warn" title="Atención">Este canal no tiene el permiso necesario.</Alert>
                            <Alert tone="danger" title="No se pudo guardar">Revisa los campos marcados e inténtalo de nuevo.</Alert>
                        </div>
                    </Block>

                    <Block id="tabla" eyebrow="componente" title="Tabla">
                        <Table head={['Comando', 'Quién puede usarlo', 'Estado']} rows={[
                            ['!so', 'Moderadores', <Badge tone="ok">Activo</Badge>], ['!ruleta', 'Todos', <Badge tone="ok">Activo</Badge>], ['!ia', 'Suscriptores', <Badge>Apagado</Badge>],
                        ]} />
                    </Block>

                    <Block id="modal" eyebrow="componente" title="Modal y avisos emergentes" note="Son las únicas piezas con sombra, porque flotan sobre el contenido.">
                        <Modal title="¿Eliminar el comando?" actions={<><Button variant="ghost">Cancelar</Button><Button variant="danger" icon={<Trash2 />}>Eliminar</Button></>}>
                            Esta acción no se puede deshacer. El comando dejará de responder en el chat.
                        </Modal>
                        <Row><Toast>Cambios guardados</Toast><Toast tone="danger">No se pudo guardar</Toast></Row>
                    </Block>

                    <Block id="estados" eyebrow="componente" title="Vacío y cargando">
                        <div style={{ maxWidth: 520 }}><Empty icon={<Inbox />} title="Aún no hay comandos" action={<Button icon={<Plus />}>Crear comando</Button>}>Crea el primero y aparecerá aquí.</Empty></div>
                        <Row label="cargando y progreso"><Spinner /><div style={{ width: 240 }}><Progress value={58} /></div></Row>
                    </Block>

                    <Block id="ambiente" eyebrow="fondo" title="Ambiente" note="Cuadrícula azul tenue más un resplandor suave. Va en lo público y en las docs; el dashboard puede quedar plano.">
                        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                            <div style={{ position: 'relative', height: 200, border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius-lg)', overflow: 'hidden' }}>
                                <div className="ds-ambient" /><p style={{ position: 'relative', padding: 16, margin: 0, fontWeight: 700 }}>Con ambiente</p>
                            </div>
                            <div style={{ position: 'relative', height: 200, border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius-lg)', overflow: 'hidden' }}>
                                <div className="ds-ambient ds-ambient--off" /><p style={{ position: 'relative', padding: 16, margin: 0, fontWeight: 700 }}>Plano</p>
                            </div>
                        </div>
                    </Block>
                    <Block id="codigo" eyebrow="componente" title="Código y pestañas" note="El resaltado del editor de scripts lee tres variables editables (palabras clave y funciones, textos y $(variables), números). Las pestañas de configuración usan iconos de línea que heredan el color, nunca emojis.">
                        <Card>
                            <pre className="ds-code" style={{ margin: 0, padding: 16, background: 'var(--ds-input)', border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius)', fontFamily: 'var(--ds-font-mono)', fontSize: 13, color: 'var(--ds-text)', overflowX: 'auto' }}
                                dangerouslySetInnerHTML={{ __html: highlightCode('set suerte = roll(1, 100)\n\nwhen $(suerte) >= 90 then\n    send "Tienes $(suerte)% de suerte"\nend') }} />
                        </Card>
                        <Row label="barra de pestañas de configuración">
                            {[['📚', 'Guía', true], ['⚙️', 'Básico', false], ['🎨', 'Tema', false], ['🔔', 'Alertas', false]].map(([e, l, on]) => (
                                <button key={String(l)} type="button" className={on ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}><TabIcon emoji={String(e)} />{String(l)}</button>
                            ))}
                        </Row>
                    </Block>
                </main>
            </div>
        </DsRoot>
    );
}
