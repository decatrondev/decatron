import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, Plus, Trash2, AlertCircle, CheckCircle,
    Shield, Download, Upload, Play, Users, TrendingUp
} from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';

// Tipos
type SeverityLevel = 'leve' | 'medio' | 'severo';
type ImmunityLevel = 'total' | 'escalamiento';
type StrikeAction = 'warning' | 'delete' | 'timeout_30s' | 'timeout_1m' | 'timeout_5m' | 'timeout_10m' | 'timeout_30m' | 'timeout_1h' | 'ban';
type StrikeExpiration = '5min' | '10min' | '15min' | '30min' | '1hour' | 'never';

interface BannedWord {
    id: number;
    word: string;
    severity: SeverityLevel;
    detections: number;
    createdAt: string;
}

interface ModerationConfig {
    vipImmunity: ImmunityLevel;
    subImmunity: ImmunityLevel;
    whitelistUsers: string[];
    warningMessage: string;
    deleteMessage: string;
    timeoutMessage: string;
    banMessage: string;
    severoMessage: string;
    strikeExpiration: StrikeExpiration;
    strike1Action: StrikeAction;
    strike2Action: StrikeAction;
    strike3Action: StrikeAction;
    strike4Action: StrikeAction;
    strike5Action: StrikeAction;
}

interface ModerationStats {
    totalWords: number;
    detectionsToday: number;
    usersSanctionedToday: number;
}

interface TestResult {
    hasMatch: boolean;
    matchedWord?: string;
    severity?: SeverityLevel;
    actionNormal?: string;
    actionWithImmunity?: string;
}

export default function BannedWords() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

    // Estados
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Palabras prohibidas
    const [bannedWords, setBannedWords] = useState<BannedWord[]>([]);
    const [newWord, setNewWord] = useState('');
    const [newWordSeverity, setNewWordSeverity] = useState<SeverityLevel>('leve');

    // Configuración
    const [config, setConfig] = useState<ModerationConfig>({
        vipImmunity: 'escalamiento',
        subImmunity: 'escalamiento',
        whitelistUsers: [],
        warningMessage: '⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5',
        deleteMessage: '🗑️ $(user), mensaje borrado por lenguaje inapropiado. Strike $(strike)/5',
        timeoutMessage: '⏱️ $(user), timeout aplicado por lenguaje inapropiado. Strike $(strike)/5',
        banMessage: '🔨 $(user), has sido baneado por lenguaje inapropiado. Strike $(strike)/5',
        severoMessage: '🔨 $(user), has sido baneado por usar: $(word)',
        strikeExpiration: '15min',
        strike1Action: 'warning',
        strike2Action: 'timeout_1m',
        strike3Action: 'timeout_5m',
        strike4Action: 'timeout_10m',
        strike5Action: 'ban'
    });

    // Estadísticas
    const [stats, setStats] = useState<ModerationStats>({
        totalWords: 0,
        detectionsToday: 0,
        usersSanctionedToday: 0
    });

    // Testing
    const [testMessage, setTestMessage] = useState('');
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [testing, setTesting] = useState(false);

    // Whitelist
    const [newWhitelistUser, setNewWhitelistUser] = useState('');

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('moderation')) {
            loadData();
        } else if (!permissionsLoading) {
            navigate('/dashboard');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [wordsRes, configRes, statsRes] = await Promise.all([
                api.get('/moderation/banned-words'),
                api.get('/moderation/config'),
                api.get('/moderation/stats')
            ]);

            if (wordsRes.data.success) {
                setBannedWords(wordsRes.data.words || []);
            }

            if (configRes.data.success) {
                setConfig(configRes.data.config);
            }

            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
            }
        } catch (error) {
            console.error('Error loading moderation data:', error);
        } finally {
            setLoading(false);
        }
    };

    const addWord = async () => {
        if (!newWord.trim()) return;

        try {
            const res = await api.post('/moderation/banned-words', {
                word: newWord.trim().toLowerCase(),
                severity: newWordSeverity
            });

            if (res.data.success) {
                setBannedWords([...bannedWords, res.data.word]);
                setNewWord('');
                setStats({ ...stats, totalWords: stats.totalWords + 1 });
                showMessage('success', 'Palabra agregada exitosamente');
            }
        } catch (error) {
            console.error('Error adding word:', error);
            showMessage('error', 'Error al agregar la palabra');
        }
    };

    const deleteWord = async (id: number) => {
        try {
            const res = await api.delete(`/moderation/banned-words/${id}`);

            if (res.data.success) {
                setBannedWords(bannedWords.filter(w => w.id !== id));
                setStats({ ...stats, totalWords: stats.totalWords - 1 });
                showMessage('success', 'Palabra eliminada');
            }
        } catch (error) {
            console.error('Error deleting word:', error);
            showMessage('error', 'Error al eliminar la palabra');
        }
    };

    const saveConfig = async () => {
        try {
            setSaving(true);
            const res = await api.post('/moderation/config', config);

            if (res.data.success) {
                showMessage('success', 'Configuración guardada exitosamente');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            showMessage('error', 'Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const testMessageAnalysis = async () => {
        if (!testMessage.trim()) return;

        try {
            setTesting(true);
            const res = await api.post('/moderation/test-message', {
                message: testMessage
            });

            if (res.data.success) {
                setTestResult(res.data.result);
            }
        } catch (error) {
            console.error('Error testing message:', error);
            showMessage('error', 'Error al analizar el mensaje');
        } finally {
            setTesting(false);
        }
    };

    const exportWords = () => {
        const dataStr = JSON.stringify(bannedWords, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `banned-words-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const importWords = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target?.result as string);
                const res = await api.post('/moderation/banned-words/import', { words: imported });

                if (res.data.success) {
                    loadData();
                    showMessage('success', `${res.data.imported} palabras importadas`);
                }
            } catch (error) {
                console.error('Error importing words:', error);
                showMessage('error', 'Error al importar el archivo');
            }
        };
        reader.readAsText(file);
    };

    const addWhitelistUser = () => {
        if (!newWhitelistUser.trim()) return;

        const username = newWhitelistUser.trim().toLowerCase();
        if (!config.whitelistUsers.includes(username)) {
            setConfig({
                ...config,
                whitelistUsers: [...config.whitelistUsers, username]
            });
            setNewWhitelistUser('');
        }
    };

    const removeWhitelistUser = (username: string) => {
        setConfig({
            ...config,
            whitelistUsers: config.whitelistUsers.filter(u => u !== username)
        });
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setSaveMessage({ type, text });
        setTimeout(() => setSaveMessage(null), 3000);
    };

    const getSeverityColor = (severity: SeverityLevel) => {
        switch (severity) {
            case 'leve': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
            case 'medio': return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
            case 'severo': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400';
        }
    };

    const getActionLabel = (action: StrikeAction) => {
        const labels: Record<StrikeAction, string> = {
            'warning': 'Advertencia',
            'delete': 'Borrar mensaje',
            'timeout_30s': 'Timeout 30seg',
            'timeout_1m': 'Timeout 1min',
            'timeout_5m': 'Timeout 5min',
            'timeout_10m': 'Timeout 10min',
            'timeout_30m': 'Timeout 30min',
            'timeout_1h': 'Timeout 1hora',
            'ban': 'Ban permanente'
        };
        return labels[action];
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#1B1C1D] p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#3b82f6] mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al Dashboard
                </button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            Palabras Prohibidas
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Sistema completo de moderación de palabras y frases prohibidas
                        </p>
                    </div>
                </div>
            </div>

            {/* Save Message */}
            {saveMessage && (
                <div className="max-w-7xl mx-auto mb-6">
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${saveMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                        {saveMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-semibold">{saveMessage.text}</span>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="max-w-7xl mx-auto text-center py-12">
                    <p className="text-[#64748b] dark:text-[#94a3b8]">Cargando configuración de moderación...</p>
                </div>
            ) : (
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Palabras Configuradas</p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">
                                        {stats.totalWords}/500
                                    </p>
                                </div>
                                <Shield className="w-10 h-10 text-[#2563eb]" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Detecciones Hoy</p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">
                                        {stats.detectionsToday}
                                    </p>
                                </div>
                                <TrendingUp className="w-10 h-10 text-orange-500" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Usuarios Sancionados</p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] mt-1">
                                        {stats.usersSanctionedToday}
                                    </p>
                                </div>
                                <Users className="w-10 h-10 text-red-500" />
                            </div>
                        </div>
                    </div>

                    {/* Grid de 2 columnas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Card 1: Agregar Palabra */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Agregar Palabra Prohibida
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                        Palabra o Frase
                                    </label>
                                    <input
                                        type="text"
                                        value={newWord}
                                        onChange={(e) => setNewWord(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addWord()}
                                        placeholder="Escribe la palabra o frase"
                                        className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
                                    />
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        💡 Tip: Usa asteriscos (*) para wildcards. Ejemplo: *spam* detecta "spam", "spammer", "antispam"
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                        Nivel de Severidad
                                    </label>
                                    <select
                                        value={newWordSeverity}
                                        onChange={(e) => setNewWordSeverity(e.target.value as SeverityLevel)}
                                        className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="leve">Leve (Escalamiento normal)</option>
                                        <option value="medio">Medio (Timeout directo)</option>
                                        <option value="severo">Severo (Ban directo)</option>
                                    </select>
                                </div>

                                <button
                                    onClick={addWord}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    Agregar Palabra
                                </button>
                            </div>
                        </div>

                        {/* Card 2: Lista de Palabras */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    Lista de Palabras ({stats.totalWords}/500)
                                </h2>
                                <div className="flex gap-2">
                                    <label className="cursor-pointer px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2">
                                        <Upload className="w-4 h-4" />
                                        Importar
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={importWords}
                                            className="hidden"
                                        />
                                    </label>
                                    <button
                                        onClick={exportWords}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Exportar
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-96 overflow-y-auto space-y-2">
                                {bannedWords.length === 0 ? (
                                    <p className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">
                                        No hay palabras prohibidas configuradas
                                    </p>
                                ) : (
                                    bannedWords.map((word) => (
                                        <div
                                            key={word.id}
                                            className="flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg"
                                        >
                                            <div className="flex items-center gap-3 flex-1">
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${getSeverityColor(word.severity)}`}>
                                                    {word.severity.toUpperCase()}
                                                </span>
                                                <span className="font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                                    {word.word}
                                                </span>
                                                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                    {word.detections} detecciones
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => deleteWord(word.id)}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Probar Detección */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                            Probar Detección de Mensajes
                        </h2>

                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && testMessageAnalysis()}
                                    placeholder="Escribe un mensaje de prueba"
                                    className="flex-1 px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
                                />
                                <button
                                    onClick={testMessageAnalysis}
                                    disabled={testing}
                                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    {testing ? 'Analizando...' : 'Analizar'}
                                </button>
                            </div>

                            {testResult && (
                                <div className={`p-4 rounded-lg border-2 ${testResult.hasMatch
                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                                    : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'}`}>
                                    {testResult.hasMatch ? (
                                        <div className="space-y-2">
                                            <p className="font-bold text-red-700 dark:text-red-400">
                                                ⚠️ Coincidencia Detectada
                                            </p>
                                            <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                                <strong>Palabra detectada:</strong> {testResult.matchedWord}
                                            </p>
                                            <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                                <strong>Severidad:</strong> {testResult.severity?.toUpperCase()}
                                            </p>
                                            <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                                <strong>Acción (usuario normal):</strong> {testResult.actionNormal}
                                            </p>
                                            <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                                <strong>Acción (usuario con inmunidad):</strong> {testResult.actionWithImmunity}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="font-bold text-green-700 dark:text-green-400">
                                            ✅ No se detectaron palabras prohibidas
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card 4: Sistema de Inmunidad */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                            Sistema de Inmunidad
                        </h2>

                        <div className="space-y-6">
                            {/* Moderadores */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    🛡️ Moderadores
                                </p>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    Los moderadores SIEMPRE tienen inmunidad total. No pueden ser baneados por el sistema.
                                </p>
                            </div>

                            {/* VIPs */}
                            <div>
                                <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    VIPs
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="vipImmunity"
                                            value="total"
                                            checked={config.vipImmunity === 'total'}
                                            onChange={(e) => setConfig({ ...config, vipImmunity: e.target.value as ImmunityLevel })}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-[#1e293b] dark:text-[#f8fafc]">Inmunidad total</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="vipImmunity"
                                            value="escalamiento"
                                            checked={config.vipImmunity === 'escalamiento'}
                                            onChange={(e) => setConfig({ ...config, vipImmunity: e.target.value as ImmunityLevel })}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-[#1e293b] dark:text-[#f8fafc]">Entra en escalamiento</span>
                                    </label>
                                </div>
                            </div>

                            {/* Suscriptores */}
                            <div>
                                <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    Suscriptores
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="subImmunity"
                                            value="total"
                                            checked={config.subImmunity === 'total'}
                                            onChange={(e) => setConfig({ ...config, subImmunity: e.target.value as ImmunityLevel })}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-[#1e293b] dark:text-[#f8fafc]">Inmunidad total</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="subImmunity"
                                            value="escalamiento"
                                            checked={config.subImmunity === 'escalamiento'}
                                            onChange={(e) => setConfig({ ...config, subImmunity: e.target.value as ImmunityLevel })}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-[#1e293b] dark:text-[#f8fafc]">Entra en escalamiento</span>
                                    </label>
                                </div>
                            </div>

                            {/* Whitelist Manual */}
                            <div>
                                <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    Whitelist Manual
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={newWhitelistUser}
                                        onChange={(e) => setNewWhitelistUser(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addWhitelistUser()}
                                        placeholder="nombre_de_usuario"
                                        className="flex-1 px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
                                    />
                                    <button
                                        onClick={addWhitelistUser}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {config.whitelistUsers.map((username) => (
                                        <div
                                            key={username}
                                            className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg"
                                        >
                                            <span className="text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                                @{username}
                                            </span>
                                            <button
                                                onClick={() => removeWhitelistUser(username)}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                    Los usuarios en la whitelist SIEMPRE tienen inmunidad total
                                </p>
                            </div>

                            {/* Mensajes Personalizados */}
                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    Mensajes Personalizados por Acción
                                </label>

                                {/* Warning */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                                        ⚠️ Warning (Advertencia)
                                    </label>
                                    <input
                                        type="text"
                                        value={config.warningMessage}
                                        onChange={(e) => setConfig({ ...config, warningMessage: e.target.value })}
                                        placeholder="⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5"
                                        className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>

                                {/* Delete */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                                        🗑️ Delete (Borrar Mensaje)
                                    </label>
                                    <input
                                        type="text"
                                        value={config.deleteMessage}
                                        onChange={(e) => setConfig({ ...config, deleteMessage: e.target.value })}
                                        placeholder="🗑️ $(user), mensaje borrado por lenguaje inapropiado. Strike $(strike)/5"
                                        className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>

                                {/* Timeout */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                                        ⏱️ Timeout (Suspensión Temporal)
                                    </label>
                                    <input
                                        type="text"
                                        value={config.timeoutMessage}
                                        onChange={(e) => setConfig({ ...config, timeoutMessage: e.target.value })}
                                        placeholder="⏱️ $(user), timeout aplicado por lenguaje inapropiado. Strike $(strike)/5"
                                        className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>

                                {/* Ban */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                                        🔨 Ban (Baneo Permanente por Strikes)
                                    </label>
                                    <input
                                        type="text"
                                        value={config.banMessage}
                                        onChange={(e) => setConfig({ ...config, banMessage: e.target.value })}
                                        placeholder="🔨 $(user), has sido baneado por lenguaje inapropiado. Strike $(strike)/5"
                                        className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>

                                {/* Severo Ban */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                                        🚨 Ban por Palabra SEVERA (Ban Directo)
                                    </label>
                                    <input
                                        type="text"
                                        value={config.severoMessage}
                                        onChange={(e) => setConfig({ ...config, severoMessage: e.target.value })}
                                        placeholder="🔨 $(user), has sido baneado por usar: $(word)"
                                        className="w-full px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        💡 Este mensaje se usa cuando detectas una palabra con severidad "Severo" (ban directo, sin strikes)
                                    </p>
                                </div>

                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    Variables disponibles: $(user), $(strike), $(word)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Card 5: Sistema de Escalamiento (Full Width) */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                            Sistema de Escalamiento de Strikes
                        </h2>

                        <div className="space-y-6">
                            {/* Expiración de strikes */}
                            <div>
                                <label className="block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    Tiempo de Expiración de Strikes
                                </label>
                                <select
                                    value={config.strikeExpiration}
                                    onChange={(e) => setConfig({ ...config, strikeExpiration: e.target.value as StrikeExpiration })}
                                    className="w-full max-w-md px-4 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
                                >
                                    <option value="5min">5 minutos</option>
                                    <option value="10min">10 minutos</option>
                                    <option value="15min">15 minutos</option>
                                    <option value="30min">30 minutos</option>
                                    <option value="1hour">1 hora</option>
                                    <option value="never">Nunca (permanente)</option>
                                </select>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    Los strikes disminuyen 1 nivel después del tiempo configurado sin infracciones
                                </p>
                            </div>

                            {/* Grid de Strikes */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                {/* Strike 1 */}
                                <div>
                                    <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                        Strike 1
                                    </label>
                                    <select
                                        value={config.strike1Action}
                                        onChange={(e) => setConfig({ ...config, strike1Action: e.target.value as StrikeAction })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="warning">Advertencia</option>
                                        <option value="delete">Borrar</option>
                                        <option value="timeout_30s">Timeout 30s</option>
                                        <option value="timeout_1m">Timeout 1m</option>
                                    </select>
                                </div>

                                {/* Strike 2 */}
                                <div>
                                    <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                        Strike 2
                                    </label>
                                    <select
                                        value={config.strike2Action}
                                        onChange={(e) => setConfig({ ...config, strike2Action: e.target.value as StrikeAction })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="delete">Borrar</option>
                                        <option value="timeout_1m">Timeout 1m</option>
                                        <option value="timeout_5m">Timeout 5m</option>
                                        <option value="timeout_10m">Timeout 10m</option>
                                    </select>
                                </div>

                                {/* Strike 3 */}
                                <div>
                                    <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                        Strike 3
                                    </label>
                                    <select
                                        value={config.strike3Action}
                                        onChange={(e) => setConfig({ ...config, strike3Action: e.target.value as StrikeAction })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="timeout_5m">Timeout 5m</option>
                                        <option value="timeout_10m">Timeout 10m</option>
                                        <option value="timeout_30m">Timeout 30m</option>
                                        <option value="timeout_1h">Timeout 1h</option>
                                    </select>
                                </div>

                                {/* Strike 4 */}
                                <div>
                                    <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                        Strike 4
                                    </label>
                                    <select
                                        value={config.strike4Action}
                                        onChange={(e) => setConfig({ ...config, strike4Action: e.target.value as StrikeAction })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="timeout_10m">Timeout 10m</option>
                                        <option value="timeout_30m">Timeout 30m</option>
                                        <option value="timeout_1h">Timeout 1h</option>
                                        <option value="ban">Ban</option>
                                    </select>
                                </div>

                                {/* Strike 5 */}
                                <div>
                                    <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                        Strike 5
                                    </label>
                                    <select
                                        value={config.strike5Action}
                                        onChange={(e) => setConfig({ ...config, strike5Action: e.target.value as StrikeAction })}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="timeout_30m">Timeout 30m</option>
                                        <option value="timeout_1h">Timeout 1h</option>
                                        <option value="ban">Ban</option>
                                    </select>
                                </div>
                            </div>

                            {/* Botón Guardar */}
                            <button
                                onClick={saveConfig}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg"
                            >
                                <Save className="w-5 h-5" />
                                {saving ? 'Guardando Configuración...' : 'Guardar Configuración'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
