import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, RefreshCw, Send, X } from 'lucide-react';
import api from '../../../../services/api';
import { Card, ColorField, CopyButton, Field, NumberInput, Select, Slider, Toggle, inputClass } from '../../../../components/overlay-editor/ui';
import { CanvasEditor } from '../../../../components/overlay-editor/CanvasEditor';
import OverlayCanvasEditor from '../../../../components/overlay-editor/OverlayCanvasEditor';
import ChatBox from '../../../../components/chat-overlay/ChatRenderer';
import BotListModal from '../../../../components/bot-list/BotListModal';
import { FONT_OPTIONS } from '../../../../components/shoutout-overlay/defaults';
import { CANVAS, CHAT_PRESETS, type BubbleMovement, type BubbleShape, type BubbleZone, type ChatOverlayConfig, type ChatPreset, type EnterAnimation, type ExitAnimation, type MinRole } from '../../../../components/chat-overlay/types';
import { sampleMessage } from '../../../../components/chat-overlay/sample';
import type { FeedItem } from '../../../../components/chat-overlay/useChatFeed';
import type { ChatOverlayConfigState } from '../hooks/useChatOverlayConfig';
import { LinkRow, Warning, useOverlayStatus } from '../../../../components/overlay-editor/OverlayLinks';

export type ChatTabId = 'guide' | 'general' | 'bubbles' | 'messages' | 'sources' | 'emotes' | 'filters' | 'theme' | 'text' | 'animations' | 'editor';

interface TabProps { cfg: ChatOverlayConfigState }

/** Cambia una sección de la config conservando el resto */
function useSection(cfg: ChatOverlayConfigState) {
    return <K extends keyof ChatOverlayConfig>(section: K, patch: Partial<ChatOverlayConfig[K]>) =>
        cfg.update({ ...cfg.config, [section]: { ...(cfg.config[section] as object), ...(patch as object) } } as ChatOverlayConfig);
}

const choice = (active: boolean) => `px-3 py-2.5 rounded-lg text-sm 3xl:text-base font-bold border transition-colors ${active ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text ' : 'border-ds-border text-ds-soft hover:border-ds-accent'}`;
const btnGray = 'px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold transition-colors bg-ds-raised text-ds-soft hover:bg-ds-raised disabled:opacity-50 flex items-center gap-2';

/** Lista de textos con chips (usuarios, palabras, canales) */
function TagInput({ values, onChange, placeholder, normalize }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; normalize?: (s: string) => string }) {
    const { t } = useTranslation('overlays');
    const [text, setText] = useState('');
    const add = () => {
        const v = (normalize ? normalize(text) : text).trim();
        if (v && !values.includes(v) && values.length < 500) onChange([...values, v]);
        setText('');
    };
    return (
        <div>
            <div className="flex gap-2">
                <input
                    className={inputClass}
                    value={text}
                    placeholder={placeholder}
                    maxLength={100}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                />
                <button type="button" onClick={add} className="px-4 py-2 rounded-lg text-sm font-bold bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent shrink-0">{t('chat.add')}</button>
            </div>
            {values.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                    {values.map(v => (
                        <span key={v} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full text-xs 3xl:text-sm font-bold bg-ds-raised text-ds-soft">
                            {v}
                            <button type="button" onClick={() => onChange(values.filter(x => x !== v))} aria-label={t('chat.remove', { name: v })} className="p-0.5 rounded-full hover:bg-ds-raised">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function Stack({ children }: { children: ReactNode }) {
    return <div className="space-y-5">{children}</div>;
}

// ── Guía ───────────────────────────────────────────────────────────────────

export function GuideTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: ChatTabId) => void }) {
    const { t } = useTranslation('overlays');
    const [botsOpen, setBotsOpen] = useState(false);
    const [test, setTest] = useState<{ state: 'idle' | 'sending' | 'ok' | 'none' | 'error' }>({ state: 'idle' });
    const steps = ['step1', 'step2', 'step3', 'step4'] as const;
    const { status, loaded } = useOverlayStatus('/chat-overlay/status');
    const bothLinked = cfg.channel.hasTwitch && cfg.channel.hasKick;
    const connected = (n: number) => n > 0;

    const sendTest = async () => {
        setTest({ state: 'sending' });
        try {
            const res = await api.post('/chat-overlay/test', {});
            setTest({ state: res.data?.delivered ? 'ok' : 'none' });
        } catch {
            setTest({ state: 'error' });
        }
    };

    return (
        <Stack>
            <Card title={t('chat.guide.urlTitle')} description={t('chat.guide.urlDescription')}>
                <LinkRow
                    url={cfg.overlayUrl}
                    name={bothLinked ? t('chat.guide.linkAll') : undefined}
                    hint={bothLinked ? t('chat.guide.linkAllHint') : undefined}
                    recommended={bothLinked}
                    connected={connected(status.all)}
                    loaded={loaded}
                    copyLabel={t('chat.guide.copy')}
                    copiedLabel={t('chat.guide.copied')}
                />
                {bothLinked && (
                    <div className="mt-5 pt-4 border-t border-ds-border">
                        <p className="text-xs 3xl:text-sm font-bold uppercase tracking-wide text-ds-soft">{t('chat.guide.advancedTitle')}</p>
                        <p className="text-xs 3xl:text-sm text-ds-soft mt-1 mb-3">{t('chat.guide.perPlatform')}</p>
                        <div className="space-y-3">
                            <LinkRow url={`${cfg.overlayUrl}&source=twitch`} name={t('chat.guide.linkTwitch')} connected={connected(status.twitch)} loaded={loaded} copyLabel={t('chat.guide.copy')} copiedLabel={t('chat.guide.copied')} />
                            <LinkRow url={`${cfg.overlayUrl}&source=kick`} name={t('chat.guide.linkKick')} connected={connected(status.kick)} loaded={loaded} copyLabel={t('chat.guide.copy')} copiedLabel={t('chat.guide.copied')} />
                        </div>
                    </div>
                )}
                {status.warnings.includes('mixed') && (
                    <Warning title={t('chat.guide.warnMixedTitle')} text={t('chat.guide.warnMixed')} />
                )}
                {status.warnings.includes('repeated') && !status.warnings.includes('mixed') && (
                    <Warning title={t('chat.guide.warnRepeatedTitle')} text={t('chat.guide.warnRepeated')} />
                )}
                {!bothLinked && cfg.channel.hasTwitch !== cfg.channel.hasKick && (
                    <p className="mt-4 text-xs 3xl:text-sm text-ds-soft">{t('chat.guide.linkOtherHint')}</p>
                )}
            </Card>

            <Card title={t('chat.guide.testTitle')} description={t('chat.guide.testDescription')}>
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className={btnGray} disabled={test.state === 'sending'} onClick={sendTest}>
                        <Send className="w-4 h-4" />
                        {t('chat.guide.testButton')}
                    </button>
                    {test.state === 'ok' && <span className="text-sm font-semibold text-ds-ok">{t('chat.guide.testOk')}</span>}
                    {test.state === 'none' && <span className="text-sm font-semibold text-ds-warn">{t('chat.guide.testNone')}</span>}
                    {test.state === 'error' && <span className="text-sm font-semibold text-ds-danger">{t('chat.guide.testError')}</span>}
                </div>
            </Card>

            <Card title={t('chat.guide.stepsTitle')}>
                <ol className="space-y-3 list-decimal list-inside text-sm 3xl:text-base text-ds-text">
                    {steps.map(s => <li key={s}>{t(`chat.guide.${s}`)}</li>)}
                </ol>
            </Card>

            <Card title={t('chat.guide.goodToKnowTitle')}>
                <ul className="space-y-2 list-disc list-inside text-sm 3xl:text-base text-ds-soft">
                    <li>{t('chat.guide.noteBot')}</li>
                    <li>{t('chat.guide.noteShared')}</li>
                    <li>{t('chat.guide.noteKick')}</li>
                    <li>{t('chat.guide.noteEmotes')}</li>
                </ul>
                <div className="flex flex-wrap gap-3 mt-5">
                    <button type="button" className={btnGray} onClick={() => onNavigate('emotes')}>{t('chat.guide.goEmotes')}</button>
                    <button type="button" className={btnGray} onClick={() => setBotsOpen(true)}><Bot className="w-4 h-4" />{t('chat.guide.goBots')}</button>
                </div>
            </Card>
            <BotListModal open={botsOpen} onClose={() => setBotsOpen(false)} />
        </Stack>
    );
}

// ── General ────────────────────────────────────────────────────────────────

export function GeneralTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;
    return (
        <Stack>
            <Card title={t('chat.general.modeTitle')} description={t('chat.general.modeDescription')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button type="button" className={choice(c.mode === 'list')} onClick={() => cfg.update({ ...c, mode: 'list' })}>{t('chat.general.modeList')}</button>
                    <button type="button" className={choice(c.mode === 'bubbles')} onClick={() => cfg.update({ ...c, mode: 'bubbles' })}>{t('chat.general.modeBubbles')}</button>
                </div>
            </Card>
            {c.mode === 'list' && <Card title={t('chat.general.listTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t('chat.general.maxMessages')} hint={t('chat.general.maxMessagesHint')}>
                        <Slider value={c.display.maxMessages} min={3} max={40} onChange={v => set('display', { maxMessages: v })} />
                    </Field>
                    <Field label={t('chat.general.messageSeconds')} hint={t('chat.general.messageSecondsHint')}>
                        <Slider value={c.display.messageSeconds} min={0} max={120} step={5} suffix="s" onChange={v => set('display', { messageSeconds: v })} />
                    </Field>
                    <Field label={t('chat.general.direction')}>
                        <Select value={c.display.direction} onChange={v => set('display', { direction: v })}
                            options={[{ value: 'up', label: t('chat.general.directionUp') }, { value: 'down', label: t('chat.general.directionDown') }]} />
                    </Field>
                </div>
            </Card>}
        </Stack>
    );
}

// ── Burbujas ───────────────────────────────────────────────────────────────

export function BubblesTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: ChatTabId) => void }) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;
    const b = c.bubbles;
    const movements: BubbleMovement[] = ['float', 'drift', 'bounce', 'fall', 'stay', 'random'];
    const shapes: BubbleShape[] = ['round', 'comic', 'rect'];
    return (
        <Stack>
            {c.mode !== 'bubbles' && (
                <div className="p-4 rounded-lg border border-ds-warn/40 bg-ds-warn/10 text-sm 3xl:text-base text-ds-warn flex flex-wrap items-center justify-between gap-3">
                    <span>{t('chat.bubbles.inactive')}</span>
                    <button type="button" className={btnGray} onClick={() => cfg.update({ ...c, mode: 'bubbles' })}>{t('chat.bubbles.activate')}</button>
                </div>
            )}
            <Card title={t('chat.bubbles.movementTitle')} description={t('chat.bubbles.movementDescription')}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {movements.map(m => (
                        <button key={m} type="button" onClick={() => set('bubbles', { movement: m })} className={choice(b.movement === m)}>{t(`chat.bubbles.movements.${m}`)}</button>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                    <Field label={t('chat.bubbles.speed')} hint={t('chat.bubbles.speedHint')}>
                        <Slider value={b.speed} min={0} max={300} step={5} suffix="px/s" onChange={v => set('bubbles', { speed: v })} />
                    </Field>
                    <Field label={t('chat.bubbles.duration')} hint={t('chat.bubbles.durationHint')}>
                        <Slider value={b.durationSeconds} min={2} max={40} suffix="s" onChange={v => set('bubbles', { durationSeconds: v })} />
                    </Field>
                </div>
            </Card>
            <Card title={t('chat.bubbles.crowdTitle')} description={t('chat.bubbles.crowdDescription')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t('chat.bubbles.maxBubbles')}>
                        <Slider value={b.maxBubbles} min={1} max={30} onChange={v => set('bubbles', { maxBubbles: v })} />
                    </Field>
                    <Field label={t('chat.bubbles.whenFull')}>
                        <Select value={b.whenFull} onChange={v => set('bubbles', { whenFull: v })}
                            options={[{ value: 'replace', label: t('chat.bubbles.whenFullReplace') }, { value: 'skip', label: t('chat.bubbles.whenFullSkip') }]} />
                    </Field>
                </div>
                <div className="mt-5">
                    <Toggle checked={b.avoidOverlap} onChange={v => set('bubbles', { avoidOverlap: v })} label={t('chat.bubbles.avoidOverlap')} hint={t('chat.bubbles.avoidOverlapHint')} />
                </div>
            </Card>
            <Card title={t('chat.bubbles.lookTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t('chat.bubbles.shape')}>
                        <Select<BubbleShape> value={b.shape} onChange={v => set('bubbles', { shape: v })} options={shapes.map(sh => ({ value: sh, label: t(`chat.bubbles.shapes.${sh}`) }))} />
                    </Field>
                    <ColorField label={t('chat.bubbles.background')} value={b.background} onChange={v => set('bubbles', { background: v })} />
                    <Field label={t('chat.bubbles.maxWidth')}>
                        <Slider value={b.maxWidth} min={200} max={900} step={10} suffix="px" onChange={v => set('bubbles', { maxWidth: v })} />
                    </Field>
                    <Field label={t('chat.bubbles.emoteOnlyScale')} hint={t('chat.bubbles.emoteOnlyScaleHint')}>
                        <Slider value={b.emoteOnlyScale} min={1} max={4} step={0.1} suffix="x" onChange={v => set('bubbles', { emoteOnlyScale: v })} />
                    </Field>
                </div>
                <div className="space-y-4 mt-5">
                    <Toggle checked={b.userBorder} onChange={v => set('bubbles', { userBorder: v })} label={t('chat.bubbles.userBorder')} hint={t('chat.bubbles.userBorderHint')} />
                    <Toggle checked={b.sizeByLength} onChange={v => set('bubbles', { sizeByLength: v })} label={t('chat.bubbles.sizeByLength')} hint={t('chat.bubbles.sizeByLengthHint')} />
                </div>
            </Card>
            <Card title={t('chat.bubbles.zonesTitle')} description={t('chat.bubbles.zonesDescription')}>
                <button type="button" className={btnGray} onClick={() => onNavigate('editor')}>{t('chat.bubbles.goEditor')}</button>
            </Card>
        </Stack>
    );
}

// ── Mensajes ───────────────────────────────────────────────────────────────

export function MessagesTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;
    return (
        <Stack>
            <Card title={t('chat.messages.showTitle')}>
                <div className="space-y-4">
                    <Toggle checked={c.display.showBadges} onChange={v => set('display', { showBadges: v })} label={t('chat.messages.badges')} hint={t('chat.messages.badgesHint')} />
                    <Toggle checked={c.display.showTimestamp} onChange={v => set('display', { showTimestamp: v })} label={t('chat.messages.timestamp')} />
                    <Toggle checked={c.display.showReplies} onChange={v => set('display', { showReplies: v })} label={t('chat.messages.replies')} hint={t('chat.messages.repliesHint')} />
                    <Toggle checked={c.sources.showPlatformIcon} onChange={v => set('sources', { showPlatformIcon: v })} label={t('chat.messages.platformIcon')} hint={t('chat.messages.platformIconHint')} />
                </div>
            </Card>
            <Card title={t('chat.messages.nameTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t('chat.messages.nameColor')}>
                        <Select value={c.display.nameColor} onChange={v => set('display', { nameColor: v })}
                            options={[{ value: 'user', label: t('chat.messages.nameColorUser') }, { value: 'fixed', label: t('chat.messages.nameColorFixed') }]} />
                    </Field>
                    {c.display.nameColor === 'fixed' && (
                        <ColorField label={t('chat.messages.fixedColor')} value={c.display.fixedNameColor} onChange={v => set('display', { fixedNameColor: v })} />
                    )}
                    <Field label={t('chat.messages.separator')} hint={t('chat.messages.separatorHint')}>
                        <input className={inputClass} value={c.display.separator} maxLength={4} onChange={e => set('display', { separator: e.target.value })} />
                    </Field>
                </div>
            </Card>
            <Card title={t('chat.messages.highlightTitle')} description={t('chat.messages.highlightDescription')}>
                <ColorField label={t('chat.messages.highlightColor')} value={c.theme.highlightColor} onChange={v => set('theme', { highlightColor: v })} />
            </Card>
        </Stack>
    );
}

// ── Fuentes ────────────────────────────────────────────────────────────────

export function SourcesTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;
    return (
        <Stack>
            <Card title={t('chat.sources.title')} description={t('chat.sources.description')}>
                <div className="space-y-4">
                    <Toggle checked={c.sources.twitch} onChange={v => set('sources', { twitch: v })} label="Twitch"
                        hint={cfg.channel.hasTwitch ? t('chat.sources.linked') : t('chat.sources.notLinked')} />
                    <Toggle checked={c.sources.kick} onChange={v => set('sources', { kick: v })} label="Kick"
                        hint={cfg.channel.hasKick ? t('chat.sources.linked') : t('chat.sources.notLinked')} />
                    <div className="opacity-60">
                        <Toggle checked={false} onChange={() => undefined} label="YouTube" hint={t('chat.sources.youtubeSoon')} />
                    </div>
                </div>
            </Card>
            <Card title={t('chat.sources.sharedTitle')} description={t('chat.sources.sharedDescription')}>
                <div className="space-y-5">
                    <Field label={t('chat.sources.sharedMode')}>
                        <Select value={c.sharedChat.mode} onChange={v => set('sharedChat', { mode: v })}
                            options={[{ value: 'all', label: t('chat.sources.sharedAll') }, { value: 'mine', label: t('chat.sources.sharedMine') }]} />
                    </Field>
                    <Toggle checked={c.sharedChat.showOrigin} onChange={v => set('sharedChat', { showOrigin: v })} label={t('chat.sources.showOrigin')} hint={t('chat.sources.showOriginHint')} />
                    <Field label={t('chat.sources.hiddenChannels')} hint={t('chat.sources.hiddenChannelsHint')}>
                        <TagInput values={c.sharedChat.hiddenChannels} onChange={v => set('sharedChat', { hiddenChannels: v })} placeholder={t('chat.sources.channelPlaceholder')}
                            normalize={s => s.trim().replace(/^@/, '').toLowerCase()} />
                    </Field>
                </div>
            </Card>
        </Stack>
    );
}

// ── Emotes ─────────────────────────────────────────────────────────────────

export function EmotesTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;
    const [search, setSearch] = useState('');
    const hidden = useMemo(() => new Set(c.emotes.hidden), [c.emotes.hidden]);

    const counts = useMemo(() => {
        const r: Record<string, number> = {};
        cfg.emotes.forEach(e => { r[e.provider] = (r[e.provider] ?? 0) + 1; });
        return r;
    }, [cfg.emotes]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return cfg.emotes.filter(e => !q || e.name.toLowerCase().includes(q)).slice(0, 150);
    }, [cfg.emotes, search]);

    const toggleHidden = (name: string) =>
        set('emotes', { hidden: hidden.has(name) ? c.emotes.hidden.filter(h => h !== name) : [...c.emotes.hidden, name] });

    return (
        <Stack>
            <Card title={t('chat.emotes.providersTitle')} description={t('chat.emotes.providersDescription')}>
                <div className="space-y-4">
                    <Toggle checked={c.emotes.decatron} onChange={v => set('emotes', { decatron: v })} label={t('chat.emotes.decatron')} hint={counts['decatron'] !== undefined ? t('chat.emotes.count', { count: counts['decatron'] }) : t('chat.emotes.decatronHint')} />
                    <Toggle checked={c.emotes.decatronGlobal} onChange={v => set('emotes', { decatronGlobal: v })} label={t('chat.emotes.decatronGlobal')} hint={counts['decatron-global'] !== undefined ? t('chat.emotes.count', { count: counts['decatron-global'] }) : t('chat.emotes.decatronGlobalHint')} />
                    <Toggle checked={c.emotes.sevenTv} onChange={v => set('emotes', { sevenTv: v })} label="7TV" hint={counts['7tv'] !== undefined ? t('chat.emotes.count', { count: counts['7tv'] }) : undefined} />
                    <Toggle checked={c.emotes.bttv} onChange={v => set('emotes', { bttv: v })} label="BetterTTV" hint={counts['bttv'] !== undefined ? t('chat.emotes.count', { count: counts['bttv'] }) : undefined} />
                    <Toggle checked={c.emotes.ffz} onChange={v => set('emotes', { ffz: v })} label="FrankerFaceZ" hint={counts['ffz'] !== undefined ? t('chat.emotes.count', { count: counts['ffz'] }) : undefined} />
                    <Toggle checked={c.emotes.globals} onChange={v => set('emotes', { globals: v })} label={t('chat.emotes.globals')} hint={t('chat.emotes.globalsHint')} />
                    <Toggle checked={c.emotes.sharedChannels} onChange={v => set('emotes', { sharedChannels: v })} label={t('chat.emotes.sharedChannels')} hint={t('chat.emotes.sharedChannelsHint')} />
                </div>
                <p className="text-xs 3xl:text-sm text-ds-soft mt-4">{t('chat.emotes.nativeNote')}</p>
                <div className="mt-3"><a href="/features/emotes" className="text-sm font-bold text-ds-accent-text hover:underline">{t('chat.emotes.manageOwn')}</a></div>
                <div className="mt-4">
                    <button type="button" className={btnGray} disabled={cfg.emotesLoading} onClick={() => cfg.refreshEmotes()}>
                        <RefreshCw className={`w-4 h-4 ${cfg.emotesLoading ? 'animate-spin' : ''}`} />
                        {t('chat.emotes.refresh')}
                    </button>
                </div>
            </Card>
            <Card title={t('chat.emotes.sizeTitle')}>
                <Field label={t('chat.emotes.size')} hint={t('chat.emotes.sizeHint')}>
                    <Slider value={c.emotes.sizePx} min={16} max={96} suffix="px" onChange={v => set('emotes', { sizePx: v })} />
                </Field>
            </Card>
            <Card title={t('chat.emotes.hiddenTitle')} description={t('chat.emotes.hiddenDescription')}>
                <input className={inputClass} value={search} placeholder={t('chat.emotes.search')} onChange={e => setSearch(e.target.value)} />
                {c.emotes.hidden.length > 0 && (
                    <p className="text-xs 3xl:text-sm text-ds-soft mt-3">{t('chat.emotes.hiddenCount', { count: c.emotes.hidden.length })}: {c.emotes.hidden.join(', ')}</p>
                )}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 mt-4 max-h-[360px] overflow-y-auto">
                    {shown.map(e => (
                        <button
                            key={`${e.provider}-${e.name}`}
                            type="button"
                            title={e.name}
                            onClick={() => toggleHidden(e.name)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${hidden.has(e.name) ? 'border-ds-danger/40 bg-ds-danger/10 opacity-60' : 'border-ds-border hover:border-ds-accent'}`}
                        >
                            <img src={e.url} alt={e.name} loading="lazy" className="h-8 w-auto object-contain" />
                            <span className="text-[10px] w-full truncate text-ds-soft">{e.name}</span>
                        </button>
                    ))}
                    {shown.length === 0 && <p className="col-span-full text-sm text-ds-soft">{cfg.emotesLoading ? t('chat.emotes.loading') : t('chat.emotes.none')}</p>}
                </div>
            </Card>
        </Stack>
    );
}

// ── Filtros ────────────────────────────────────────────────────────────────

export function FiltersTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;
    const [botsOpen, setBotsOpen] = useState(false);
    return (
        <Stack>
            <Card title={t('chat.filters.hideTitle')}>
                <div className="space-y-4">
                    <Toggle checked={c.filters.hideCommands} onChange={v => set('filters', { hideCommands: v })} label={t('chat.filters.hideCommands')} hint={t('chat.filters.hideCommandsHint')} />
                    <Toggle checked={c.filters.hideBots} onChange={v => set('filters', { hideBots: v })} label={t('chat.filters.hideBots')} hint={t('chat.filters.hideBotsHint')} />
                </div>
                <div className="mt-4">
                    <button type="button" className={btnGray} onClick={() => setBotsOpen(true)}><Bot className="w-4 h-4" />{t('chat.filters.openBots')}</button>
                </div>
            </Card>
            <Card title={t('chat.filters.roleTitle')} description={t('chat.filters.roleDescription')}>
                <Select<MinRole> value={c.filters.minRole} onChange={v => set('filters', { minRole: v })}
                    options={[
                        { value: 'all', label: t('chat.filters.roleAll') },
                        { value: 'sub', label: t('chat.filters.roleSub') },
                        { value: 'vip', label: t('chat.filters.roleVip') },
                        { value: 'mod', label: t('chat.filters.roleMod') },
                    ]} />
            </Card>
            <Card title={t('chat.filters.usersTitle')} description={t('chat.filters.usersDescription')}>
                <TagInput values={c.filters.blockedUsers} onChange={v => set('filters', { blockedUsers: v })} placeholder={t('chat.filters.userPlaceholder')}
                    normalize={s => s.trim().replace(/^@/, '').toLowerCase()} />
            </Card>
            <Card title={t('chat.filters.wordsTitle')} description={t('chat.filters.wordsDescription')}>
                <TagInput values={c.filters.blockedWords} onChange={v => set('filters', { blockedWords: v })} placeholder={t('chat.filters.wordPlaceholder')} />
            </Card>
            <BotListModal open={botsOpen} onClose={() => setBotsOpen(false)} />
        </Stack>
    );
}

// ── Tema ───────────────────────────────────────────────────────────────────

const PRESET_IDS: ChatPreset[] = ['classic', 'compact', 'boxed', 'minimal', 'twitch'];

export function ThemeTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;

    const applyPreset = (id: ChatPreset) => {
        const p = CHAT_PRESETS[id];
        cfg.update({
            ...c,
            theme: { ...c.theme, ...p.theme, preset: id },
            text: { ...c.text, ...p.text },
            emotes: { ...c.emotes, sizePx: p.emoteSize },
        });
    };

    return (
        <Stack>
            {c.mode === 'bubbles' && (
                <div className="p-4 rounded-lg border border-ds-accent bg-ds-accent/10 text-sm 3xl:text-base text-ds-accent-text">{t('chat.theme.bubblesNote')}</div>
            )}
            <Card title={t('chat.theme.presetsTitle')} description={t('chat.theme.presetsDescription')}>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    {PRESET_IDS.map(id => (
                        <button key={id} type="button" onClick={() => applyPreset(id)} className={choice(c.theme.preset === id)}>{t(`chat.theme.presets.${id}`)}</button>
                    ))}
                </div>
            </Card>
            <Card title={t('chat.theme.containerTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <ColorField label={t('chat.theme.containerBg')} value={c.theme.containerBg} onChange={v => set('theme', { containerBg: v })} />
                    <Field label={t('chat.theme.containerRadius')}><Slider value={c.theme.containerRadius} min={0} max={60} suffix="px" onChange={v => set('theme', { containerRadius: v })} /></Field>
                    <Field label={t('chat.theme.containerPadding')}><Slider value={c.theme.containerPadding} min={0} max={60} suffix="px" onChange={v => set('theme', { containerPadding: v })} /></Field>
                </div>
            </Card>
            <Card title={t('chat.theme.messageTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <ColorField label={t('chat.theme.messageBg')} value={c.theme.messageBg} onChange={v => set('theme', { messageBg: v })} />
                    <Field label={t('chat.theme.messageRadius')}><Slider value={c.theme.messageRadius} min={0} max={40} suffix="px" onChange={v => set('theme', { messageRadius: v })} /></Field>
                    <Field label={t('chat.theme.paddingY')}><Slider value={c.theme.messagePaddingY} min={0} max={30} suffix="px" onChange={v => set('theme', { messagePaddingY: v })} /></Field>
                    <Field label={t('chat.theme.paddingX')}><Slider value={c.theme.messagePaddingX} min={0} max={40} suffix="px" onChange={v => set('theme', { messagePaddingX: v })} /></Field>
                    <Field label={t('chat.theme.gap')}><Slider value={c.theme.gap} min={0} max={40} suffix="px" onChange={v => set('theme', { gap: v })} /></Field>
                    <ColorField label={t('chat.theme.borderColor')} value={c.theme.borderColor} onChange={v => set('theme', { borderColor: v })} />
                    <Field label={t('chat.theme.borderWidth')}><Slider value={c.theme.borderWidth} min={0} max={8} suffix="px" onChange={v => set('theme', { borderWidth: v })} /></Field>
                </div>
            </Card>
        </Stack>
    );
}

// ── Texto ──────────────────────────────────────────────────────────────────

export function TextTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;
    return (
        <Stack>
            <Card title={t('chat.text.fontTitle')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t('chat.text.fontFamily')}>
                        <Select value={c.text.fontFamily} onChange={v => set('text', { fontFamily: v })} options={FONT_OPTIONS.map(f => ({ value: f, label: f }))} />
                    </Field>
                    <Field label={t('chat.text.fontWeight')}>
                        <Select value={String(c.text.fontWeight)} onChange={v => set('text', { fontWeight: Number(v) })}
                            options={['400', '500', '600', '700', '800'].map(w => ({ value: w, label: w }))} />
                    </Field>
                    <Field label={t('chat.text.fontSize')}><Slider value={c.text.fontSize} min={14} max={72} suffix="px" onChange={v => set('text', { fontSize: v })} /></Field>
                    <Field label={t('chat.text.lineHeight')}><Slider value={c.text.lineHeight} min={1} max={2} step={0.05} onChange={v => set('text', { lineHeight: v })} /></Field>
                    <ColorField label={t('chat.text.color')} value={c.text.color} onChange={v => set('text', { color: v })} />
                </div>
            </Card>
            <Card title={t('chat.text.effectsTitle')}>
                <div className="space-y-4">
                    <Toggle checked={c.text.shadow} onChange={v => set('text', { shadow: v })} label={t('chat.text.shadow')} />
                    <Toggle checked={c.text.outlineEnabled} onChange={v => set('text', { outlineEnabled: v })} label={t('chat.text.outline')} />
                    {c.text.outlineEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <ColorField label={t('chat.text.outlineColor')} value={c.text.outlineColor} onChange={v => set('text', { outlineColor: v })} />
                            <Field label={t('chat.text.outlineWidth')}><Slider value={c.text.outlineWidth} min={1} max={8} suffix="px" onChange={v => set('text', { outlineWidth: v })} /></Field>
                        </div>
                    )}
                </div>
            </Card>
        </Stack>
    );
}

// ── Animaciones ────────────────────────────────────────────────────────────

export function AnimationsTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;
    return (
        <Card title={t('chat.animations.title')} description={t('chat.animations.description')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label={t('chat.animations.enter')}>
                    <Select<EnterAnimation> value={c.animations.enter} onChange={v => set('animations', { enter: v })}
                        options={(['slide', 'fade', 'pop', 'none'] as const).map(v => ({ value: v, label: t(`chat.animations.types.${v}`) }))} />
                </Field>
                <Field label={t('chat.animations.exit')}>
                    <Select<ExitAnimation> value={c.animations.exit} onChange={v => set('animations', { exit: v })}
                        options={(['fade', 'slide', 'none'] as const).map(v => ({ value: v, label: t(`chat.animations.types.${v}`) }))} />
                </Field>
                <Field label={t('chat.animations.duration')}>
                    <Slider value={c.animations.durationMs} min={0} max={1500} step={50} suffix="ms" onChange={v => set('animations', { durationMs: v })} />
                </Field>
            </div>
        </Card>
    );
}

// ── Editor ─────────────────────────────────────────────────────────────────

const POSITIONS: { id: string; x: (w: number, h: number) => number; y: (w: number, h: number) => number }[] = [
    { id: 'bottomLeft', x: () => 40, y: (_w, h) => CANVAS.height - h - 40 },
    { id: 'bottomRight', x: w => CANVAS.width - w - 40, y: (_w, h) => CANVAS.height - h - 40 },
    { id: 'topLeft', x: () => 40, y: () => 40 },
    { id: 'topRight', x: w => CANVAS.width - w - 40, y: () => 40 },
];

export function EditorTab({ cfg }: TabProps) {
    return cfg.config.mode === 'bubbles' ? <ZonesEditor cfg={cfg} /> : <BoxEditor cfg={cfg} />;
}

/** Modo burbujas: dónde pueden aparecer (zonas permitidas) y dónde nunca (zonas prohibidas) */
function ZonesEditor({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const zones = cfg.config.bubbles.zones;
    const setZones = (next: BubbleZone[]) => set('bubbles', { zones: next });
    const allowCount = zones.filter(z => z.kind === 'allow').length;

    const add = (kind: BubbleZone['kind']) => {
        if (zones.length >= 20) return;
        // Un rectángulo cómodo al centro, para tomarlo y moverlo
        setZones([...zones, { id: `z${Date.now().toString(36)}`, kind, x: 660, y: 340, width: 600, height: 400 }]);
    };

    const labelOf = (z: BubbleZone) => {
        const n = zones.filter(o => o.kind === z.kind).indexOf(z) + 1;
        return t(z.kind === 'allow' ? 'chat.bubbles.zoneAllow' : 'chat.bubbles.zoneDeny', { n });
    };

    return (
        <OverlayCanvasEditor
            canvas={CANVAS}
            title={t('chat.bubbles.editorTitle')}
            description={t('chat.bubbles.editorDescription')}
            notice={allowCount === 0
                ? <div className="p-3 rounded-lg border border-ds-accent bg-ds-accent/10 text-sm text-ds-accent-text">{t('chat.bubbles.noAllow')}</div>
                : undefined}
            elements={zones.map(z => ({ id: z.id, label: labelOf(z), enabled: true, toggleable: false, x: z.x, y: z.y, width: z.width, height: z.height }))}
            onRectChange={(id, patch) => setZones(zones.map(z => (z.id === id ? { ...z, ...patch } : z)))}
            layersActions={(
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnGray} onClick={() => add('allow')}>{t('chat.bubbles.addAllow')}</button>
                    <button type="button" className={btnGray} onClick={() => add('deny')}>{t('chat.bubbles.addDeny')}</button>
                </div>
            )}
            selectedExtra={id => {
                const z = zones.find(x => x.id === id);
                if (!z) return null;
                return (
                    <div className="space-y-3">
                        <Select<BubbleZone['kind']> value={z.kind} onChange={kind => setZones(zones.map(o => (o.id === id ? { ...o, kind } : o)))}
                            options={[{ value: 'allow', label: t('chat.bubbles.kindAllow') }, { value: 'deny', label: t('chat.bubbles.kindDeny') }]} />
                        <button type="button" className={btnGray} onClick={() => setZones(zones.filter(o => o.id !== id))}>{t('chat.bubbles.removeZone')}</button>
                    </div>
                );
            }}
        >
            {/* El fondo del lienzo: las zonas se pintan aquí, el editor pone encima los tiradores */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {zones.map(z => (
                    <div
                        key={z.id}
                        style={{
                            position: 'absolute', left: z.x, top: z.y, width: z.width, height: z.height,
                            background: z.kind === 'allow' ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.28)',
                            border: `2px dashed ${z.kind === 'allow' ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.9)'}`,
                        }}
                    />
                ))}
            </div>
        </OverlayCanvasEditor>
    );
}

function BoxEditor({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = useSection(cfg);
    const c = cfg.config;

    // Mensajes fijos para ver cómo queda el cuadro al arrastrarlo
    const items = useMemo<FeedItem[]>(
        () => Array.from({ length: 8 }, () => sampleMessage(cfg.emotes)).map(msg => ({ msg, addedAt: 0, leavingAt: null })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [cfg.emotes.length]
    );
    const noAnimation: ChatOverlayConfig = { ...c, animations: { ...c.animations, enter: 'none', exit: 'none' } };

    return (
        <Stack>
            <Card title={t('chat.editor.title')} description={t('chat.editor.description')}>
                <CanvasEditor
                    width={CANVAS.width}
                    height={CANVAS.height}
                    snap={10}
                    maxDisplayWidth={1100}
                    items={[{ id: 'chat', position: { x: c.layout.x, y: c.layout.y }, node: <ChatBox items={items} config={noAnimation} inline /> }]}
                    onMove={(_id, p) => set('layout', { x: p.x, y: p.y })}
                />
            </Card>
            <Card title={t('chat.editor.sizeTitle')}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="X"><NumberInput value={c.layout.x} min={0} max={CANVAS.width - 40} onChange={v => set('layout', { x: v })} /></Field>
                    <Field label="Y"><NumberInput value={c.layout.y} min={0} max={CANVAS.height - 40} onChange={v => set('layout', { y: v })} /></Field>
                    <Field label={t('chat.editor.width')}><NumberInput value={c.layout.width} min={120} max={CANVAS.width} onChange={v => set('layout', { width: v })} /></Field>
                    <Field label={t('chat.editor.height')}><NumberInput value={c.layout.height} min={80} max={CANVAS.height} onChange={v => set('layout', { height: v })} /></Field>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                    {POSITIONS.map(p => (
                        <button key={p.id} type="button" className={btnGray}
                            onClick={() => set('layout', { x: p.x(c.layout.width, c.layout.height), y: p.y(c.layout.width, c.layout.height) })}>
                            {t(`chat.editor.positions.${p.id}`)}
                        </button>
                    ))}
                </div>
            </Card>
        </Stack>
    );
}
