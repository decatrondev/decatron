import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';

interface Participant {
    username: string;
    displayName: string;
    calculatedWeight: number;
    enteredAt: string;
}

export default function GiveawayOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';
    const [participants, setParticipants] = useState<Participant[]>([]);

    const connectionRef = useRef<signalR.HubConnection | null>(null);

    useEffect(() => {
        setupSignalRConnection();

        return () => {
            if (connectionRef.current) {
                connectionRef.current.stop();
            }
        };
    }, [channel]);

    const setupSignalRConnection = async () => {
        if (!channel) {
            console.warn('❌ No channel specified for SignalR connection');
            return;
        }

        try {
            const hubUrl = `${window.location.origin}/hubs/overlay`;
            const connection = new signalR.HubConnectionBuilder()
                .withUrl(hubUrl, { withCredentials: false })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            connection.on('GiveawayParticipantJoined', (participant: Participant) => {
                setParticipants(prev => [participant, ...prev].slice(0, 10)); // Mostrar últimos 10
            });

            // Connection lifecycle
            connection.onreconnected(async () => {
                try {
                    await connection.invoke('JoinChannel', channel);
                } catch (err) {
                    console.error('[GIVEAWAY] Error re-uniéndose al canal:', err);
                }
            });

            connection.onclose(error => {
                setTimeout(setupSignalRConnection, 5000);
            });

            await connection.start();
            await connection.invoke('JoinChannel', channel);

            connectionRef.current = connection;
        } catch (err) {
            console.error('Error connecting SignalR:', err);
            setTimeout(setupSignalRConnection, 5000);
        }
    };

    return (
        <div style={{
            padding: '20px',
            fontFamily: 'sans-serif',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            width: '100%',
            height: '100vh'
        }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: 'bold' }}>🎉 Nuevos Participantes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {participants.map((p, i) => (
                    <div key={`${p.username}-${i}`} style={{
                        background: 'rgba(30, 41, 59, 0.85)',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        borderLeft: '4px solid #f59e0b',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        animation: 'slideIn 0.5s ease-out'
                    }}>
                        <span style={{ fontWeight: 'bold', color: '#fbbf24', fontSize: '18px' }}>{p.displayName}</span>
                        <span style={{ color: 'white', fontSize: '16px' }}>se ha unido! 🎟️</span>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(-20px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
