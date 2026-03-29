import { useState, useEffect, useCallback } from 'react';

interface DateRange {
    from: Date;
    to: Date;
}

interface TimerEvent {
    id: number;
    eventType: string;
    username: string;
    timeAdded: number;
    details: string;
    occurredAt: string;
}

interface ModerationLog {
    id: number;
    username: string;
    detectedWord: string;
    severity: string;
    actionTaken: string;
    strikeLevel: number;
    createdAt: string;
}

interface GameChange {
    id: number;
    categoryName: string;
    changedBy: string;
    changedAt: string;
}

interface TitleChange {
    id: number;
    title: string;
    changedBy: string;
    changedAt: string;
}

interface OverviewData {
    totalTimerEvents: number;
    totalTimeAdded: number;
    totalModerationActions: number;
    totalGameChanges: number;
    topEventTypes: { type: string; count: number }[];
    eventsPerDay: { date: string; count: number }[];
}

interface ChatMessage {
    id: number;
    username: string;
    userId: string | null;
    message: string;
    timestamp: string;
}

interface AnalyticsData {
    overview: OverviewData;
    timerEvents: TimerEvent[];
    moderation: ModerationLog[];
    streamHistory: {
        games: GameChange[];
        titles: TitleChange[];
    };
    activity: {
        followers: { date: string; count: number }[];
        tips: { date: string; amount: number }[];
        topTippers?: { name: string; value: number }[];
    };
    chatMessages: ChatMessage[];
    meta: {
        from: string;
        to: string;
        maxDaysAllowed: number;
        channelName: string;
    };
}

export function useAnalytics(dateRange: DateRange) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No estás autenticado');
            }

            const params = new URLSearchParams({
                from: dateRange.from.toISOString(),
                to: dateRange.to.toISOString()
            });

            const response = await fetch(`/api/analytics?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('No tienes permisos para ver analytics');
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Error al cargar analytics');
            }

            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const exportCSV = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No estás autenticado');
            }

            const params = new URLSearchParams({
                from: dateRange.from.toISOString(),
                to: dateRange.to.toISOString()
            });

            const response = await fetch(`/api/analytics/export?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Error al exportar');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics_${dateRange.from.toISOString().split('T')[0]}_${dateRange.to.toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            console.error('Export error:', err);
        }
    }, [dateRange]);

    return { data, isLoading, error, refetch: fetchAnalytics, exportCSV };
}
