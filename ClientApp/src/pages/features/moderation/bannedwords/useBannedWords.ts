import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../../../hooks/usePermissions';
import api from '../../../../services/api';
import { useToast } from '../../../../components/dashboard/toast';
import { useFilterEnabled } from '../filterSwitch';
import type { BannedWord, ModerationConfig, ModerationStats, SeverityLevel, TestResult } from './types';

/** Estado y acciones de «Palabras prohibidas»: lista, configuración, estadísticas, prueba y whitelist. */
export function useBannedWords() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const { t } = useTranslation('moderation');
    const filter = useFilterEnabled('banned_words');
    const { toast, showToast } = useToast();

    // Estados
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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

    const showMessage = (type: 'success' | 'error', text: string) => showToast(text, type);

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
                showMessage('success', t('banned.addedOk'));
            }
        } catch (error) {
            console.error('Error adding word:', error);
            showMessage('error', t('banned.addFailed'));
        }
    };

    const deleteWord = async (id: number) => {
        try {
            const res = await api.delete(`/moderation/banned-words/${id}`);

            if (res.data.success) {
                setBannedWords(bannedWords.filter(w => w.id !== id));
                setStats({ ...stats, totalWords: stats.totalWords - 1 });
                showMessage('success', t('banned.deletedOk'));
            }
        } catch (error) {
            console.error('Error deleting word:', error);
            showMessage('error', t('banned.deleteFailed'));
        }
    };

    const saveConfig = async () => {
        try {
            setSaving(true);
            const res = await api.post('/moderation/config', config);

            if (res.data.success) {
                showMessage('success', t('common.saved'));
            }
        } catch (error) {
            console.error('Error saving config:', error);
            showMessage('error', t('common.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const testMessageAnalysis = async () => {
        if (!testMessage.trim()) return;

        try {
            setTesting(true);
            const res = await api.post('/moderation/test-message', {
                message: testMessage,
                filter: 'banned_words'
            });

            if (res.data.success) {
                setTestResult(res.data);
            }
        } catch (error) {
            console.error('Error testing message:', error);
            showMessage('error', t('links.analyzeFailed'));
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
                    showMessage('success', t('banned.imported', { count: res.data.imported }));
                }
            } catch (error) {
                console.error('Error importing words:', error);
                showMessage('error', t('banned.importFailed'));
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

    return {
        toast, filter, loading, saving, permissionsLoading, hasMinimumLevel,
        bannedWords, newWord, setNewWord, newWordSeverity, setNewWordSeverity,
        config, setConfig, stats,
        t, testMessage, setTestMessage, testResult, testing,
        newWhitelistUser, setNewWhitelistUser,
        addWord, deleteWord, saveConfig, testMessageAnalysis, exportWords, importWords, addWhitelistUser, removeWhitelistUser,
    };
}

export type BannedWordsState = ReturnType<typeof useBannedWords>;
