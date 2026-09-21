/**
 * Fase en vivo simulada (lo que manda Decatron Desktop) para diseñar sin tener el
 * cliente de LoL abierto. La usan el editor de Game Overlays (hasta la fase 3) y el
 * de Partida en vivo. Usa los íconos de campeón del estado de preview del backend.
 */
import { AccountOverlayState, LivePhaseId, LivePhaseInfo } from './types';

/** Fase en vivo simulada para diseñar lo que manda Decatron Desktop, con los íconos del preview. */
export function simulateLive(phase: LivePhaseId, account: AccountOverlayState): LivePhaseInfo | null {
    if (phase === 'none') return null;
    const champs = (account.session?.matches ?? []).filter(m => m.character).map(m => ({ id: 0, name: m.character!, icon: m.characterIcon ?? null }));
    const c = (i: number) => champs[i % Math.max(1, champs.length)] ?? { id: 0, name: '?', icon: null };
    const base: LivePhaseInfo = { phase, queueId: 420, queueName: 'Ranked Solo/Duo', lobby: [], updatedAt: new Date().toISOString() };
    if (phase === 'lobby') base.lobby = [{ name: account.displayName, isMe: true, isLeader: true }, { name: 'Roba', isMe: false, isLeader: false, scout: { tier: 'GOLD', division: 'II', lp: 45, games: 20, winRate: 60, streak: 3, topChampions: ['Lee Sin 6-2', 'Vi 4-3'] } }, { name: 'Jesús', isMe: false, isLeader: false, scout: { tier: 'SILVER', division: 'I', lp: 80, games: 20, winRate: 45, streak: -2, topChampions: ['Lux 5-5'] } }];
    if (phase === 'champselect') base.champSelect = {
        myTeam: [0, 1, 2, 3, 4].map(i => ({ cellId: i, champion: i < 4 ? c(i) : null, position: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][i], isMe: i === 3, locked: i < 3 })),
        theirTeam: [5, 6, 7, 8, 9].map(i => ({ cellId: i, champion: i < 8 ? c(i) : null, isMe: false, locked: i < 7 })),
        myBans: [c(4)], theirBans: [c(1), c(2)], timerPhase: 'BAN_PICK', remainingMs: 21000, myPick: c(3), myPosition: 'BOTTOM', myTurn: true,
    };
    if (phase === 'champselect') base.coach = { kind: 'my_turn', comment: `Con ${c(3).name} vas cómoda contra su bot; cuidado con el ${c(5).name} en early.`, suggestion: c(3).name, tips: [], coachName: 'Coach', at: new Date().toISOString() };
    if (phase === 'postgame') base.coach = { kind: 'postgame', comment: 'Buen tempo en línea y muy bien las peleas del minuto 20+. Sigue mejorando el CS temprano: 6.1/min vs tu 7.2 habitual.', tips: ['Warda el río antes del min 3', 'Compra pinks al volver'], coachName: 'Coach', at: new Date().toISOString() };
    if (phase === 'ingame') base.game = { champion: c(0), position: 'BOTTOM', startedAt: new Date(Date.now() - 12 * 60000).toISOString(), gameMode: 'CLASSIC' };
    if (phase === 'ingame') base.prediction = { champion: c(0).name, openedAt: new Date(Date.now() - 3 * 60000).toISOString(), closesAt: new Date(Date.now() + 2 * 60000).toISOString(), poolWin: 1850, poolLoss: 620, betsWin: 9, betsLoss: 4, result: null, winners: 0, top: [] };
    if (phase === 'postgame') base.prediction = { champion: c(0).name, openedAt: new Date(Date.now() - 32 * 60000).toISOString(), closesAt: new Date(Date.now() - 27 * 60000).toISOString(), poolWin: 1850, poolLoss: 620, betsWin: 9, betsLoss: 4, result: 'win', resolvedAt: new Date().toISOString(), winners: 9, top: ['roba +210', 'jesus +140', 'maria +95'] };
    if (phase === 'postgame') base.postGame = {
        win: true, champion: c(0), kills: 11, deaths: 3, assists: 9, cs: 214, damage: 24300, visionScore: 21, durationSeconds: 1832, pointsDelta: 22,
        myTeam: [], theirTeam: [],
    };
    return base;
}

