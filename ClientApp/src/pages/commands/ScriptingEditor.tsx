import {
    Save, ArrowLeft, Code, AlertCircle, CheckCircle, FileCode, BookOpen,
    Terminal, Lightbulb, Play, Trash2, Undo2, Redo2, Eye, ChevronRight,
    ChevronDown, Copy, Sparkles, Zap, GraduationCap, Wand2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import '../../styles/prism-custom.css';

// Definir gramática personalizada para nuestro lenguaje de scripting
languages.decatronscript = {
    'keyword': /\b(set|when|then|end|send)\b/,
    'function': /\b(roll|pick|count)\b/,
    'variable': /\$\([^)]+\)/,
    'string': /(["'])(?:(?!\1)[^\\\r\n]|\\.)*\1/,
    'number': /\b\d+\b/,
    'operator': /[+\-*/<>=!]+|==|!=|>=|<=/,
    'punctuation': /[{}[\];(),.:]/
};

interface ValidationResult {
    isValid: boolean;
    errorMessage?: string;
    errorLine?: number;
}

interface PreviewResult {
    success: boolean;
    output: string;
    errorLine?: number;
}

interface HistoryState {
    content: string;
    cursorPosition: number;
}

interface Example {
    title: string;
    description: string;
    code: string;
    category: 'basic' | 'intermediate' | 'advanced';
    icon: LucideIcon;
}

interface ApiError {
    response?: {
        data?: {
            message?: string;
        };
    };
}

interface AutocompleteSuggestion {
    text: string;
    displayText: string;
    description: string;
    type: 'keyword' | 'function' | 'variable' | 'snippet';
}

export default function ScriptingEditor() {
    const { t } = useTranslation('commands');
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const [loading, setLoading] = useState(!!id);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [testing, setTesting] = useState(false);
    const [commandName, setCommandName] = useState('');
    const [scriptContent, setScriptContent] = useState('');
    const [restriction, setRestriction] = useState('all'); // all, mod, vip, sub
    const [isActive, setIsActive] = useState(true);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [showExamples, setShowExamples] = useState(true);
    const [showDocs, setShowDocs] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<'basic' | 'intermediate' | 'advanced' | 'all'>('all');
    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [currentLine, setCurrentLine] = useState(0);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteOptions, setAutocompleteOptions] = useState<AutocompleteSuggestion[]>([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isEditMode = !!id;

    useEffect(() => {
        if (id && !permissionsLoading && hasMinimumLevel('commands')) {
            loadScript();
        } else if (!id) {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, permissionsLoading]);

    const loadScript = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/scripts/${id}`);
            setCommandName(res.data.commandName);
            setScriptContent(res.data.scriptContent);
            setRestriction(res.data.restriction || 'all');
            setIsActive(res.data.isActive);
            addToHistory(res.data.scriptContent);
        } catch (err) {
            console.error('Error loading script:', err);
            alert(t('scripting.messages.loadError'));
            navigate('/commands/scripting');
        } finally {
            setLoading(false);
        }
    };

    const addToHistory = (content: string) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({
            content,
            cursorPosition: textareaRef.current?.selectionStart || 0
        });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setScriptContent(history[historyIndex - 1].content);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setScriptContent(history[historyIndex + 1].content);
        }
    };

    const handleScriptChange = (newContent: string) => {
        setScriptContent(newContent);
        setValidationResult(null);
        setPreviewResult(null);
        addToHistory(newContent);
    };

    const validateScript = async () => {
        if (!scriptContent.trim()) {
            setValidationResult({ isValid: false, errorMessage: t('scripting.messages.scriptRequired') });
            return false;
        }

        try {
            setValidating(true);
            const res = await api.post('/scripts/validate', { scriptContent });
            setValidationResult(res.data.data);
            return res.data.data.isValid;
        } catch {
            setValidationResult({ isValid: false, errorMessage: t('scripting.messages.validationError') });
            return false;
        } finally {
            setValidating(false);
        }
    };

    const testScript = async () => {
        if (!scriptContent.trim()) {
            setPreviewResult({ success: false, output: t('scripting.messages.scriptRequired') });
            return;
        }

        try {
            setTesting(true);
            const res = await api.post('/scripts/preview', {
                scriptContent,
                commandName: commandName || 'test'
            });
            setPreviewResult(res.data.data);
        } catch {
            setPreviewResult({ success: false, output: t('scripting.messages.testError') });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!commandName.trim()) {
            alert(t('scripting.messages.fieldRequired'));
            return;
        }

        if (!scriptContent.trim()) {
            alert(t('scripting.messages.scriptRequired'));
            return;
        }

        const isValid = await validateScript();
        if (!isValid) {
            alert(t('scripting.messages.validationError'));
            return;
        }

        try {
            setSaving(true);
            if (isEditMode) {
                await api.put(`/scripts/${id}`, { scriptContent, restriction, isActive });
                alert(t('scripting.messages.updateSuccess'));
            } else {
                await api.post('/scripts', { commandName: commandName.trim(), scriptContent, restriction, isActive });
                alert(t('scripting.messages.createSuccess'));
            }
            navigate('/commands/scripting');
        } catch (error) {
            const err = error as ApiError;
            const message = err.response?.data?.message || t('scripting.messages.saveError');
            alert(message);
        } finally {
            setSaving(false);
        }
    };

    const insertText = (text: string) => {
        const textarea = document.getElementById('code-editor') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = scriptContent.substring(0, start) + text + scriptContent.substring(end);

        handleScriptChange(newContent);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
    };

    const insertTemplate = (template: string) => {
        const templates: { [key: string]: string } = {
            dice: 'set resultado = roll(1, 6)\nsend "🎲 $(user) lanzó un dado y obtuvo: $(resultado)"',
            pick: 'set opciones = "pizza, hamburguesa, tacos, sushi"\nset eleccion = pick($(opciones))\nsend "🍽️ $(user), te recomiendo: $(eleccion)"',
            counter: 'set veces = count()\nsend "🔢 Este comando se ha usado $(veces) veces"',
            conditional: 'set numero = roll(1, 10)\nwhen $(numero) >= 8 then\n    send "🎉 ¡Excelente! Obtuviste $(numero)"\nend\nwhen $(numero) < 8 then\n    send "😅 Obtuviste $(numero)"\nend'
        };

        if (templates[template]) {
            insertText(templates[template]);
        }
    };

    // Actualizar línea actual cuando cambia la posición del cursor
    const handleCursorChange = () => {
        const textarea = document.getElementById('code-editor') as HTMLTextAreaElement;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = scriptContent.substring(0, cursorPos);
        const lineNumber = textBeforeCursor.split('\n').length;
        setCurrentLine(lineNumber);

        // Detectar autocomplete
        checkAutocomplete();
    };

    // Auto-complete - Sugerencias al escribir
    const checkAutocomplete = () => {
        const textarea = document.getElementById('code-editor') as HTMLTextAreaElement;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = scriptContent.substring(0, cursorPos);
        const currentLineText = textBeforeCursor.split('\n').pop() || '';
        const lastWord = currentLineText.split(/\s/).pop() || '';

        if (lastWord.length < 2) {
            setShowAutocomplete(false);
            return;
        }

        const suggestions: AutocompleteSuggestion[] = [];

        // Keywords
        const keywords = ['set', 'when', 'then', 'end', 'send'];
        keywords.forEach(kw => {
            if (kw.startsWith(lastWord.toLowerCase())) {
                suggestions.push({
                    text: kw,
                    displayText: kw,
                    description: t('scripting.editor.exampleBasic'),
                    type: 'keyword'
                });
            }
        });

        // Functions
        const functions = [
            { name: 'roll(1, 6)', desc: t('scripting.editor.exampleBasic') },
            { name: 'pick("a, b")', desc: t('scripting.editor.exampleBasic') },
            { name: 'count()', desc: t('scripting.editor.exampleCounters') }
        ];
        functions.forEach(fn => {
            if (fn.name.startsWith(lastWord.toLowerCase())) {
                suggestions.push({
                    text: fn.name,
                    displayText: fn.name,
                    description: fn.desc,
                    type: 'function'
                });
            }
        });

        // Variables
        const vars = ['$(user)', '$(channel)', '$(game)', '$(uptime)', '$(ruser)', '$(touser)'];
        vars.forEach(v => {
            if (v.startsWith(lastWord)) {
                suggestions.push({
                    text: v,
                    displayText: v,
                    description: t('scripting.editor.exampleVariables'),
                    type: 'variable'
                });
            }
        });

        if (suggestions.length > 0) {
            setAutocompleteOptions(suggestions);
            setSelectedSuggestionIndex(0);
            setShowAutocomplete(true);

            // Calcular posición del autocomplete
            const lineHeight = 24;
            setAutocompletePosition({
                top: (currentLine - 1) * lineHeight + 60,
                left: 60
            });
        } else {
            setShowAutocomplete(false);
        }
    };

    // Insertar sugerencia de autocomplete
    const insertSuggestion = (suggestion: AutocompleteSuggestion) => {
        const textarea = document.getElementById('code-editor') as HTMLTextAreaElement;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = scriptContent.substring(0, cursorPos);
        const currentLineText = textBeforeCursor.split('\n').pop() || '';
        const lastWord = currentLineText.split(/\s/).pop() || '';

        // Reemplazar la última palabra con la sugerencia
        const beforeLastWord = textBeforeCursor.substring(0, textBeforeCursor.length - lastWord.length);
        const afterCursor = scriptContent.substring(cursorPos);
        const newContent = beforeLastWord + suggestion.text + afterCursor;

        setScriptContent(newContent);
        setShowAutocomplete(false);

        setTimeout(() => {
            const newCursorPos = beforeLastWord.length + suggestion.text.length;
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    // Formatear código automáticamente
    const formatCode = () => {
        const lines = scriptContent.split('\n');
        let indentLevel = 0;
        const formatted: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Des-indentar antes de 'end'
            if (trimmed.startsWith('end')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            // Agregar línea con indentación
            const indent = '    '.repeat(indentLevel);
            formatted.push(indent + trimmed);

            // Indentar después de 'then'
            if (trimmed.endsWith('then')) {
                indentLevel++;
            }
        }

        const newContent = formatted.join('\n');
        handleScriptChange(newContent);

        const textarea = document.getElementById('code-editor') as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
        }
    };

    // Función para el syntax highlighting con Prism
    const highlightCode = (code: string) => {
        try {
            return highlight(code, languages.decatronscript, 'decatronscript');
        } catch {
            return code;
        }
    };

    const loadExample = (example: Example) => {
        handleScriptChange(example.code);
        const textarea = document.getElementById('code-editor') as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
        }
    };

    const clearEditor = () => {
        if (scriptContent.trim() && !confirm(t('scripting.messages.deleteConfirm', { command: 'editor' }))) {
            return;
        }
        handleScriptChange('');
    };

    const examples: Example[] = [
        {
            title: 'Dado Simple',
            description: 'Tira un dado de 6 caras',
            code: 'set resultado = roll(1, 6)\nsend "🎲 $(user) lanzó un dado y obtuvo: $(resultado)"',
            category: 'basic',
            icon: Sparkles
        },
        {
            title: 'Pick Aleatorio',
            description: 'Elige entre múltiples opciones',
            code: 'set opciones = "pizza, tacos, sushi, hamburguesa"\nset eleccion = pick($(opciones))\nsend "🍕 $(user), te recomiendo: $(eleccion)"',
            category: 'basic',
            icon: Sparkles
        },
        {
            title: 'Contador',
            description: 'Cuenta los usos del comando',
            code: 'set contador = count()\nsend "📊 Este comando se ha usado $(contador) veces por $(user)"',
            category: 'basic',
            icon: Sparkles
        },
        {
            title: 'Dos Dados',
            description: 'Tira dos dados y suma el resultado',
            code: 'set dado1 = roll(1, 6)\nset dado2 = roll(1, 6)\nset total = $(dado1) + $(dado2)\n\nwhen $(dado1) == $(dado2) then\n    send "🎲🎲 DOBLES! $(user) sacó $(dado1) y $(dado2) = $(total)"\nend\n\nwhen $(dado1) != $(dado2) then\n    send "🎲 $(user) sacó $(dado1) + $(dado2) = $(total)"\nend',
            category: 'intermediate',
            icon: Zap
        },
        {
            title: 'Sistema de Suerte',
            description: 'Porcentaje de suerte con rangos',
            code: 'set suerte = roll(1, 100)\n\nwhen $(suerte) >= 90 then\n    send "⭐ LEGENDARIA! $(user) tiene $(suerte)% de suerte"\nend\n\nwhen $(suerte) >= 70 then\n    send "🔥 Buena suerte: $(user) tiene $(suerte)%"\nend\n\nwhen $(suerte) >= 50 then\n    send "👍 Suerte normal: $(user) tiene $(suerte)%"\nend\n\nwhen $(suerte) < 50 then\n    send "😅 Mala suerte: $(user) tiene $(suerte)%"\nend',
            category: 'intermediate',
            icon: Zap
        },
        {
            title: 'Contador con Mensajes',
            description: 'Contador con diferentes respuestas',
            code: 'set contador = count()\nset usuario = $(user)\n\nwhen $(contador) == 1 then\n    send "🎉 ¡Primera vez usando este comando, $(usuario)!"\nend\n\nwhen $(contador) > 100 then\n    send "🏆 ¡Wow! Este comando se ha usado $(contador) veces"\nend\n\nwhen $(contador) > 10 then\n    send "📊 Comando popular: $(contador) usos"\nend\n\nwhen $(contador) <= 10 then\n    send "📊 Comando usado $(contador) veces"\nend',
            category: 'intermediate',
            icon: Zap
        },
        {
            title: 'Script Completo',
            description: 'Combina todas las funcionalidades',
            code: 'set usuario = $(user)\nset juego = $(game)\nset canal = $(channel)\nset contador = count()\nset suerte = roll(1, 100)\nset dado1 = roll(1, 6)\nset dado2 = roll(1, 6)\nset suma = $(dado1) + $(dado2)\n\nwhen $(contador) == 1 then\n    send "🎉 ¡Primera vez de $(usuario) en $(canal)!"\nend\n\nwhen $(suerte) >= 90 then\n    send "⭐ ÉPICO! $(usuario) tiene $(suerte)% jugando $(juego)"\nend\n\nwhen $(suerte) >= 60 then\n    send "😊 $(usuario) tiene buena suerte: $(suerte)%"\nend\n\nwhen $(suerte) < 60 then\n    send "😅 $(usuario) tiene $(suerte)% de suerte"\nend\n\nwhen $(suma) == 12 then\n    send "🎲 DOBLE SEIS! Puntuación perfecta"\nend\n\nwhen $(suma) < 12 then\n    send "🎲 Dados: $(dado1) + $(dado2) = $(suma)"\nend\n\nsend "📊 Total de usos: $(contador)"',
            category: 'advanced',
            icon: GraduationCap
        }
    ];

    const filteredExamples = examples.filter(ex =>
        selectedCategory === 'all' || ex.category === selectedCategory
    );

    const variables = [
        { name: '$(user)', description: 'Usuario que ejecutó el comando' },
        { name: '$(channel)', description: 'Canal actual del stream' },
        { name: '$(game)', description: 'Juego/categoría actual' },
        { name: '$(uptime)', description: 'Tiempo que lleva el stream en vivo' },
        { name: '$(ruser)', description: 'Usuario aleatorio del chat' },
        { name: '$(touser)', description: 'Usuario mencionado con @' }
    ];

    const functions = [
        { name: 'roll(min, max)', description: 'Número aleatorio entre min y max', example: 'roll(1, 100)' },
        { name: 'pick("a, b, c")', description: 'Elige una opción aleatoria', example: 'pick("pizza, tacos, sushi")' },
        { name: 'count()', description: 'Incrementa contador del comando', example: 'count()' }
    ];

    const syntaxDocs = [
        {
            title: 'Variables',
            code: 'set nombre = valor',
            description: 'Asigna un valor a una variable'
        },
        {
            title: 'Condicionales',
            code: 'when condicion then\n    acciones\nend',
            description: 'Ejecuta código si se cumple la condición'
        },
        {
            title: 'Mensajes',
            code: 'send "Hola $(user)"',
            description: 'Envía un mensaje al chat'
        },
        {
            title: 'Operadores',
            code: '==, !=, >, <, >=, <=, +, -',
            description: 'Comparación y aritmética'
        }
    ];

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('scripting.editor.loadingTitle')}</div>;
    }

    if (!hasMinimumLevel('commands')) {
        navigate('/dashboard');
        return null;
    }

    return (
        <div className="max-w-[1800px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/commands/scripting')}
                        className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {isEditMode ? t('scripting.editor.titleEdit') : t('scripting.editor.titleCreate')}
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            {t('scripting.header.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[#1e293b] dark:text-[#f8fafc]"
                        title="Deshacer (Ctrl+Z)"
                    >
                        <Undo2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[#1e293b] dark:text-[#f8fafc]"
                        title="Rehacer (Ctrl+Y)"
                    >
                        <Redo2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={validateScript}
                        disabled={validating || !scriptContent.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all"
                    >
                        <Code className="w-4 h-4" />
                        {validating ? t('scripting.editor.saving') : t('scripting.editor.validateButton')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? t('scripting.editor.saving') : isEditMode ? t('scripting.editor.saveButton') : t('scripting.editor.createButton')}
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Editor (2 columns) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Command Name */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            {t('scripting.editor.commandNameLabel')}
                        </label>
                        <input
                            type="text"
                            value={commandName}
                            onChange={(e) => setCommandName(e.target.value)}
                            disabled={isEditMode}
                            placeholder={t('scripting.editor.commandNamePlaceholder')}
                            className={`w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] font-mono text-lg ${
                                isEditMode ? 'cursor-not-allowed opacity-60' : ''
                            }`}
                        />
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                            {isEditMode ? t('customCommands.editModal.commandHelper') : t('scripting.editor.commandNameHelper')}
                        </p>
                    </div>

                    {/* User Restriction */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            {t('customCommands.createModal.restrictionLabel')}
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                            <button
                                type="button"
                                onClick={() => setRestriction('all')}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                    restriction === 'all'
                                        ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'
                                }`}
                            >
                                <div className="text-2xl mb-2">👥</div>
                                <div className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('customCommands.restrictions.all')}</div>
                                <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('customCommands.restrictions.all')}</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRestriction('sub')}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                    restriction === 'sub'
                                        ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'
                                }`}
                            >
                                <div className="text-2xl mb-2">⭐</div>
                                <div className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('customCommands.restrictions.sub')}+</div>
                                <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('customCommands.restrictions.sub')}, VIPs, {t('customCommands.restrictions.mod')}</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRestriction('vip')}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                    restriction === 'vip'
                                        ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'
                                }`}
                            >
                                <div className="text-2xl mb-2">💎</div>
                                <div className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('customCommands.restrictions.vip')}+</div>
                                <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('customCommands.restrictions.vip')} y {t('customCommands.restrictions.mod')}</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRestriction('mod')}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                    restriction === 'mod'
                                        ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'
                                }`}
                            >
                                <div className="text-2xl mb-2">🛡️</div>
                                <div className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('customCommands.restrictions.mod')}</div>
                                <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('customCommands.restrictions.mod')}</div>
                            </button>
                        </div>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-3">
                            The streamer can always use any command without restrictions
                        </p>
                    </div>

                    {/* Script Editor */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                <FileCode className="w-4 h-4" />
                                {t('scripting.editor.scriptCodeLabel')}
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    Lines: {scriptContent.split('\n').length}
                                </span>
                                <button
                                    onClick={formatCode}
                                    className="p-1.5 hover:bg-[#dbeafe] dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                    title="Formatear código (auto-indent)"
                                >
                                    <Wand2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </button>
                                <button
                                    onClick={clearEditor}
                                    className="p-1.5 hover:bg-[#fee2e2] dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    title="Limpiar editor"
                                >
                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </button>
                            </div>
                        </div>

                        {/* Editor with line numbers */}
                        <div className="relative">
                            <div className="flex border border-[#e2e8f0] dark:border-[#374151] rounded-lg overflow-hidden bg-[#f8fafc] dark:bg-[#262626]">
                                {/* Line numbers */}
                                <div className="select-none bg-[#f1f5f9] dark:bg-[#1a1a1a] px-3 py-3 text-right text-xs text-[#64748b] dark:text-[#94a3b8] font-mono leading-relaxed border-r border-[#e2e8f0] dark:border-[#374151]">
                                    {scriptContent.split('\n').map((_, i) => (
                                        <div
                                            key={i}
                                            className={`leading-[1.5rem] transition-colors ${
                                                currentLine === i + 1
                                                    ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold -mx-3 px-3'
                                                    : ''
                                            }`}
                                        >
                                            {i + 1}
                                        </div>
                                    ))}
                                </div>
                                {/* Code editor with syntax highlighting */}
                                <div className="flex-1">
                                    <Editor
                                        value={scriptContent}
                                        onValueChange={(code) => handleScriptChange(code)}
                                        highlight={highlightCode}
                                        padding={12}
                                        placeholder={'// Escribe tu script aquí...\nset resultado = roll(1, 6)\nsend "🎲 $(user) sacó: $(resultado)"'}
                                        style={{
                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                            fontSize: 14,
                                            minHeight: '480px',
                                            backgroundColor: 'transparent',
                                            outline: 'none',
                                        }}
                                        className="text-[#1e293b] dark:text-[#f8fafc] focus:outline-none"
                                        textareaClassName="focus:outline-none"
                                        onKeyUp={handleCursorChange}
                                        onClick={handleCursorChange}
                                        textareaId="code-editor"
                                    />
                                </div>
                            </div>

                            {/* Autocomplete dropdown */}
                            {showAutocomplete && autocompleteOptions.length > 0 && (
                                <div
                                    className="absolute z-50 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden max-w-md"
                                    style={{
                                        top: `${autocompletePosition.top}px`,
                                        left: `${autocompletePosition.left}px`,
                                        minWidth: '300px',
                                        maxHeight: '200px',
                                        overflowY: 'auto'
                                    }}
                                >
                                    {autocompleteOptions.map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => insertSuggestion(suggestion)}
                                            className={`w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                                                idx === selectedSuggestionIndex
                                                    ? 'bg-blue-100 dark:bg-blue-900/30'
                                                    : ''
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <code className={`font-mono text-sm font-bold ${
                                                    suggestion.type === 'keyword'
                                                        ? 'text-blue-600 dark:text-blue-400'
                                                        : suggestion.type === 'function'
                                                        ? 'text-purple-600 dark:text-purple-400'
                                                        : 'text-green-600 dark:text-green-400'
                                                }`}>
                                                    {suggestion.displayText}
                                                </code>
                                                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                    {suggestion.description}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                            Use Tab to indent • Ctrl+Z to undo
                        </p>
                    </div>

                    {/* Validation Result */}
                    {validationResult && (
                        <div className={`rounded-xl border p-4 ${
                            validationResult.isValid
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}>
                            <div className="flex items-start gap-3">
                                {validationResult.isValid ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className={`font-bold ${
                                        validationResult.isValid
                                            ? 'text-green-700 dark:text-green-300'
                                            : 'text-red-700 dark:text-red-300'
                                    }`}>
                                        {validationResult.isValid ? t('scripting.editor.validationValid') : t('scripting.editor.validationError')}
                                    </p>
                                    {!validationResult.isValid && (
                                        <>
                                            <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                                                {validationResult.errorMessage}
                                            </p>
                                            {validationResult.errorLine && (
                                                <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-mono">
                                                    📍 Line {validationResult.errorLine}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Test Console */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                <Terminal className="w-5 h-5 text-[#2563eb]" />
                                {t('scripting.editor.testResultTitle')}
                            </h3>
                            <button
                                onClick={testScript}
                                disabled={testing || !scriptContent.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all"
                            >
                                <Play className="w-4 h-4" />
                                {testing ? t('scripting.editor.saving') : t('scripting.editor.testButton')}
                            </button>
                        </div>

                        {previewResult ? (
                            <div className={`p-4 rounded-lg font-mono text-sm ${
                                previewResult.success
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                            }`}>
                                <div className="flex items-start gap-2">
                                    {previewResult.success ? (
                                        <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 whitespace-pre-wrap break-words">
                                        {previewResult.output}
                                    </div>
                                </div>
                                {previewResult.errorLine && (
                                    <p className="text-xs mt-2 opacity-80">
                                        Error on line {previewResult.errorLine}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 rounded-lg bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] text-sm">
                                <p>Click {t('scripting.editor.testButton')} to simulate command execution</p>
                                <p className="text-xs mt-2">The system will use test data to execute your script</p>
                            </div>
                        )}
                    </div>

                    {/* Examples */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden shadow-lg">
                        <button
                            onClick={() => setShowExamples(!showExamples)}
                            className="w-full flex items-center justify-between p-4 hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-[#2563eb]" />
                                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">{t('scripting.editor.examplesTitle')}</h3>
                            </div>
                            {showExamples ? <ChevronDown className="w-5 h-5 text-[#1e293b] dark:text-[#f8fafc]" /> : <ChevronRight className="w-5 h-5 text-[#1e293b] dark:text-[#f8fafc]" />}
                        </button>
                        {showExamples && (
                            <div className="border-t border-[#e2e8f0] dark:border-[#374151]">
                                {/* Category Filter */}
                                <div className="p-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => setSelectedCategory('all')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                selectedCategory === 'all'
                                                    ? 'bg-[#2563eb] text-white'
                                                    : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                            }`}
                                        >
                                            {t('customCommands.restrictions.all')}
                                        </button>
                                        <button
                                            onClick={() => setSelectedCategory('basic')}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                selectedCategory === 'basic'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                            }`}
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            {t('scripting.editor.exampleBasic')}
                                        </button>
                                        <button
                                            onClick={() => setSelectedCategory('intermediate')}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                selectedCategory === 'intermediate'
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                            }`}
                                        >
                                            <Zap className="w-3 h-3" />
                                            {t('scripting.editor.exampleConditionals')}
                                        </button>
                                        <button
                                            onClick={() => setSelectedCategory('advanced')}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                selectedCategory === 'advanced'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                            }`}
                                        >
                                            <GraduationCap className="w-3 h-3" />
                                            {t('scripting.editor.exampleComplete')}
                                        </button>
                                    </div>
                                </div>

                                {/* Examples List */}
                                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                                    {filteredExamples.map((example, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <example.icon className="w-4 h-4 text-[#2563eb]" />
                                                    <p className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">{example.title}</p>
                                                </div>
                                                <span className={`text-xs px-2 py-1 rounded font-bold ${
                                                    example.category === 'basic'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                        : example.category === 'intermediate'
                                                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                                                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                                }`}>
                                                    {example.category === 'basic' ? t('scripting.editor.exampleBasic') : example.category === 'intermediate' ? t('scripting.editor.exampleConditionals') : t('scripting.editor.exampleComplete')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3">{example.description}</p>
                                            <code className="block bg-[#f1f5f9] dark:bg-[#1a1a1a] p-3 rounded font-mono text-xs whitespace-pre-wrap border border-[#e2e8f0] dark:border-[#374151] mb-3 text-[#1e293b] dark:text-[#e2e8f0]">
                                                {example.code}
                                            </code>
                                            <button
                                                onClick={() => loadExample(example)}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all text-sm"
                                            >
                                                <Copy className="w-3 h-3" />
                                                {t('scripting.editor.insertButton')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Active Toggle */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="w-5 h-5 text-[#2563eb] bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] rounded focus:ring-2 focus:ring-[#2563eb]"
                            />
                            <label htmlFor="isActive" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] cursor-pointer">
                                {t('scripting.editor.statusActive')}
                            </label>
                        </div>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2 ml-8">
                            {t('scripting.editor.statusInactive')}
                        </p>
                    </div>

                    {/* Atajos de Teclado */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-[#2563eb]" />
                            Keyboard Shortcuts
                        </h3>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-[#f8fafc] dark:bg-[#262626] rounded-lg">
                                <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('scripting.editor.undoButton')}</span>
                                <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-[#1e293b] dark:text-[#f8fafc]">Ctrl+Z</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-[#f8fafc] dark:bg-[#262626] rounded-lg">
                                <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('scripting.editor.redoButton')}</span>
                                <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-[#1e293b] dark:text-[#f8fafc]">Ctrl+Y</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-[#f8fafc] dark:bg-[#262626] rounded-lg">
                                <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">Indent</span>
                                <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-[#1e293b] dark:text-[#f8fafc]">Tab</kbd>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-[#f8fafc] dark:bg-[#262626] rounded-lg">
                                <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{t('scripting.editor.saveButton')}</span>
                                <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-[#1e293b] dark:text-[#f8fafc]">Ctrl+S</kbd>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Help & Tools (1 column) */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-[#2563eb]" />
                            Quick Templates
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => insertTemplate('dice')}
                                className="flex items-center gap-2 p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-[#e2e8f0] dark:border-[#374151] rounded-lg transition-all"
                            >
                                <span className="text-2xl">🎲</span>
                                <span className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">Dice</span>
                            </button>
                            <button
                                onClick={() => insertTemplate('pick')}
                                className="flex items-center gap-2 p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-[#e2e8f0] dark:border-[#374151] rounded-lg transition-all"
                            >
                                <span className="text-2xl">🎯</span>
                                <span className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">Pick</span>
                            </button>
                            <button
                                onClick={() => insertTemplate('counter')}
                                className="flex items-center gap-2 p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-green-50 dark:hover:bg-green-900/20 border border-[#e2e8f0] dark:border-[#374151] rounded-lg transition-all"
                            >
                                <span className="text-2xl">📊</span>
                                <span className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">Counter</span>
                            </button>
                            <button
                                onClick={() => insertTemplate('conditional')}
                                className="flex items-center gap-2 p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-[#e2e8f0] dark:border-[#374151] rounded-lg transition-all"
                            >
                                <span className="text-2xl">🔀</span>
                                <span className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">Conditional</span>
                            </button>
                        </div>
                    </div>

                    {/* Variables */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">{t('scripting.editor.exampleVariables')}</h3>
                        <div className="space-y-2">
                            {variables.map((variable, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => insertText(variable.name)}
                                    className="w-full flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-[#e2e8f0] dark:border-[#374151] rounded-lg transition-all text-left group"
                                >
                                    <div>
                                        <code className="text-sm font-bold text-[#2563eb] dark:text-[#60a5fa]">{variable.name}</code>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{variable.description}</p>
                                    </div>
                                    <Copy className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Functions */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">Functions</h3>
                        <div className="space-y-3">
                            {functions.map((func, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => insertText(func.example)}
                                    className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-[#e2e8f0] dark:border-[#374151] rounded-lg transition-all text-left group"
                                >
                                    <div className="flex items-start justify-between">
                                        <code className="text-sm font-bold text-purple-600 dark:text-purple-400">{func.name}</code>
                                        <Copy className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8] opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{func.description}</p>
                                    <code className="block text-xs text-[#2563eb] dark:text-[#60a5fa] mt-2 bg-[#f1f5f9] dark:bg-[#1a1a1a] px-2 py-1 rounded">
                                        {func.example}
                                    </code>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Documentation */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden shadow-lg">
                        <button
                            onClick={() => setShowDocs(!showDocs)}
                            className="w-full flex items-center justify-between p-4 hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-[#2563eb]" />
                                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Documentation</h3>
                            </div>
                            {showDocs ? <ChevronDown className="w-5 h-5 text-[#1e293b] dark:text-[#f8fafc]" /> : <ChevronRight className="w-5 h-5 text-[#1e293b] dark:text-[#f8fafc]" />}
                        </button>
                        {showDocs && (
                            <div className="p-4 space-y-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                {syntaxDocs.map((doc, idx) => (
                                    <div key={idx}>
                                        <p className="font-bold text-sm mb-2 text-[#2563eb] dark:text-[#60a5fa]">{doc.title}:</p>
                                        <code className="block bg-[#f8fafc] dark:bg-[#262626] p-3 rounded font-mono text-xs whitespace-pre border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#e2e8f0]">
                                            {doc.code}
                                        </code>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{doc.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tips */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <div className="flex items-start gap-3">
                            <Lightbulb className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[#1e293b] dark:text-[#f8fafc] font-bold text-sm mb-3">Pro Tips</p>
                                <ul className="text-[#64748b] dark:text-[#94a3b8] text-xs space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] mt-0.5">•</span>
                                        <span>Validate your code before saving to detect errors</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] mt-0.5">•</span>
                                        <span>Test your script with the console to see how it runs</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] mt-0.5">•</span>
                                        <span>Use quick templates to start faster</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] mt-0.5">•</span>
                                        <span>Click on variables and functions to insert them</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#2563eb] mt-0.5">•</span>
                                        <span>Scripts execute line by line</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
