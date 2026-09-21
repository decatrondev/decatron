import React, { useEffect, useState } from 'react';
import { FileText, Check, Loader2, Eye, Pencil, Sparkles } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';

// Plantillas de arranque — texto propio, no una copia de ningun sitio de referencia.
// El organizador las edita o las borra libremente, son solo un punto de partida para
// no encontrarse con la pestaña vacia.
function generalTemplate(edition: TournamentEdition): string {
    return `# Normas generales — ${edition.name}

## Calendario
Inicio y cierre del torneo segun las fechas configuradas en la edicion. Sin limite de partidas jugadas por dia, salvo lo que se indique para los puestos de arriba de la tabla mas adelante.

## Juego limpio
- Todas las partidas se juegan en directo, con camara activada.
- Prohibido jugar fuera de stream con las cuentas del torneo.
- Prohibido el coaching dentro de la partida.
- Prohibido usar el directo de otro participante para tomar decisiones dentro de tu propia partida (streamsniping). La informacion publica del matchmaking si esta permitida.

## Stream
- Obligatorio publicar los VODs de las partidas del torneo.
- Prohibido el modo streamer mientras dure tu participacion.

## Contacto
Cualquier duda o reporte de incumplimiento se canaliza por Discord.
`;
}

function punishmentsTemplate(edition: TournamentEdition): string {
    return `# Normas de ${edition.shellItemName}s — ${edition.name}

## Que es esto
Un sistema de castigos aleatorios que se activan jugando: cuanto mejor te va, mas probable que te toque cargar con uno — y podes lanzarselo a otro participante.

## Como se consiguen
Jugando bien: rachas de victorias, partidas muy buenas, KDA alto. El detalle exacto de que dispara cada ${edition.shellItemName.toLowerCase()} lo ves en el panel de Castigos.

## Como se lanzan
- Tenes que tener al menos una ${edition.shellItemName.toLowerCase()} en el inventario.
- No se puede lanzar en los minutos siguientes a terminar una partida.
- Cuanto mas arriba estes en la tabla, mas facil es que te llegue una — y mas rapido podes recibir otra despues de cumplir la anterior.
- Existe una probabilidad de que el lanzamiento rebote y te toque a vos en cambio: es mas baja cuanto mejor este posicionado quien la tira.

## Cumplimiento
El staff marca manualmente cuando un castigo se dio por cumplido. Si jugas ignorando un castigo pendiente, se considera incumplimiento de las normas generales.

## ${edition.aegisMechanicName}
Ademas existe un factor de suerte que puede darte el doble de LP en una victoria o dejarte en cero en una derrota, sin previo aviso — es parte del juego, no se puede activar ni desactivar manualmente.
`;
}

// Milestone 1 — Normas. Ver .dev/torneos/09-panel-admin-backend.md #4.
// v1: markdown simple (negrita **texto**, listas con "- ", saltos de linea), sin
// libreria de editor rich-text — ver .dev/torneos/ESTADO.md #5 item 8.

interface RuleDoc {
    id: number;
    contentMarkdown: string;
    version: number;
    updatedAt: string;
}

function renderMarkdown(text: string): string {
    return text
        .split('\n')
        .map((line) => {
            if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
            if (line.startsWith('# ')) return `<h2>${line.slice(2)}</h2>`;
            if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
            return line ? `<p>${line}</p>` : '<br/>';
        })
        .join('')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(<li>.*?<\/li>)+/g, (match) => `<ul>${match}</ul>`);
}

export default function RulesPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [general, setGeneral] = useState<RuleDoc | null>(null);
    const [punishments, setPunishments] = useState<RuleDoc | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeType, setActiveType] = useState<'general' | 'punishments'>('general');

    const load = async (editionId: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/rules`);
            setGeneral(res.data.general || null);
            setPunishments(res.data.punishments || null);
        } catch (err) {
            console.error('Error cargando normas', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (edition) load(edition.id);
    }, [edition?.id]);

    if (!edition) {
        return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    }

    return (
        <div className="space-y-4 4xl:space-y-6">
            <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2563eb]" /> Normas — {edition.name}
            </h2>

            <div className="flex gap-1.5">
                <button
                    onClick={() => setActiveType('general')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold ${activeType === 'general' ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white' : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}
                >
                    Normas generales
                </button>
                <button
                    onClick={() => setActiveType('punishments')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold ${activeType === 'punishments' ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white' : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}
                >
                    Normas de {edition.shellItemName}s
                </button>
            </div>

            {loading ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : (
                <RuleEditor
                    key={activeType}
                    edition={edition}
                    type={activeType}
                    doc={activeType === 'general' ? general : punishments}
                    onSaved={() => load(edition.id)}
                />
            )}
        </div>
    );
}

function RuleEditor({
    edition,
    type,
    doc,
    onSaved,
}: {
    edition: TournamentEdition;
    type: 'general' | 'punishments';
    doc: RuleDoc | null;
    onSaved: () => void;
}) {
    const editionId = edition.id;
    const [content, setContent] = useState(doc?.contentMarkdown || '');
    const [preview, setPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setContent(doc?.contentMarkdown || '');
        setSaved(false);
    }, [doc?.id, type]);

    const useTemplate = () => {
        if (content && !window.confirm('Ya hay texto cargado — reemplazarlo con la plantilla?')) return;
        setContent(type === 'general' ? generalTemplate(edition) : punishmentsTemplate(edition));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await api.put(`/admin/tournament/editions/${editionId}/rules`, { type, contentMarkdown: content });
            setSaved(true);
            onSaved();
        } catch (err) {
            console.error('Error guardando normas', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                    Markdown simple: <code># Titulo</code>, <code>## Subtitulo</code>, <code>**negrita**</code>, líneas con <code>- </code> para listas.
                    {doc && ` Version ${doc.version}.`}
                </p>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={useTemplate}
                        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                    >
                        <Sparkles className="w-3.5 h-3.5" /> Usar plantilla
                    </button>
                    <button
                        onClick={() => setPreview((v) => !v)}
                        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                    >
                        {preview ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {preview ? 'Editar' : 'Vista previa'}
                    </button>
                </div>
            </div>

            {preview ? (
                <div
                    className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm min-h-[200px] prose-sm [&_h2]:font-black [&_h2]:text-lg [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) || '<p class="text-[#64748b] dark:text-[#94a3b8]">Sin contenido todavia.</p>' }}
                />
            ) : (
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={14}
                    placeholder={
                        type === 'general'
                            ? '# Normas del torneo\n\nCalendario, partidas, juego limpio...'
                            : `# Normas de ${type}\n\nCooldowns, reverse, inventario...`
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm font-mono"
                />
            )}

            <div className="flex items-center gap-2">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d] disabled:opacity-50 flex items-center gap-1.5"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar
                </button>
                {saved && <span className="text-sm text-[#2563eb]">Guardado</span>}
            </div>
        </div>
    );
}
