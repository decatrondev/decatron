import { CheckCircle, MessageSquare } from 'lucide-react';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../../components/LanguageSelector';
import { SettingsGroup, SettingsRow, ReadOnlyNotice, Linked, PlatformIcon, TierBadge, linkButton, unlinkButton } from './parts';
import type { SettingsCtx } from './types';

/** Pestaña «Mi cuenta»: plataformas vinculadas, plan e idioma. */
export default function AccountTab({ s }: { s: SettingsCtx }) {
    const { t } = useTranslation(['settings', 'common']);
    const { userInfo, accountTier, identity, jwtClaims, authProvider, linkedKick, linkedTwitch, loadAccountChannels, addToast, viewerIsOwner, twitchLinked, discordLinked, kickLinked } = s;
    return (
        <div className="space-y-6 4xl:space-y-8">
            <SettingsGroup title={t('settings:sections.platforms.title')} description={t('settings:sections.platforms.description')}>
                {!viewerIsOwner ? (
                    <>
                        <ReadOnlyNotice text={t('settings:header.readOnly', { login: identity?.owner.login ?? userInfo.login })} />
                        <SettingsRow title="Twitch" description={twitchLinked ? <Linked>Vinculado{identity?.platforms.twitch?.login ? ` (${identity.platforms.twitch.login})` : ''}</Linked> : 'No vinculado'} />
                        <SettingsRow title="Kick" description={kickLinked ? <Linked>Vinculado{identity?.platforms.kick?.username ? ` (${identity.platforms.kick.username})` : ''}</Linked> : 'No vinculado'} />
                        <SettingsRow title="Discord" description={discordLinked ? <Linked>Vinculado</Linked> : 'No vinculado'} />
                    </>
                ) : (
                    <>
                        <SettingsRow
                            icon={<PlatformIcon color="#9146FF"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" /></svg></PlatformIcon>}
                            title="Twitch"
                            description={twitchLinked ? <Linked>Vinculado{linkedTwitch?.twitchLogin ? ` (${linkedTwitch.twitchLogin})` : ''}</Linked> : 'No vinculado'}
                        >
                            {authProvider === 'discord' && (
                                <button
                                    onClick={async () => {
                                        try {
                                            const res = await api.post('/auth/link-twitch-start');
                                            if (res.data.url) window.location.href = res.data.url;
                                        } catch { addToast('Error al iniciar vinculación', 'error'); }
                                    }}
                                    className={linkButton}
                                >
                                    Vincular
                                </button>
                            )}
                            {authProvider === 'kick' && !linkedTwitch && (
                                <button
                                    onClick={async () => {
                                        try {
                                            // link-account-start, no link-twitch-start: no fusiona
                                            // filas, Kick conserva su propia config.
                                            const res = await api.post('/auth/link-account-start');
                                            if (res.data.url) window.location.href = res.data.url;
                                        } catch { addToast('Error al iniciar vinculación', 'error'); }
                                    }}
                                    className={linkButton}
                                >
                                    Vincular
                                </button>
                            )}
                            {authProvider === 'kick' && linkedTwitch && (
                                <button
                                    onClick={async () => {
                                        if (!confirm('¿Desvincular Twitch? El canal sigue existiendo, solo deja de estar agrupado con esta cuenta.')) return;
                                        try {
                                            await api.post('/auth/unlink-account');
                                            addToast('Twitch desvinculado', 'success');
                                            loadAccountChannels();
                                        } catch { addToast('Error al desvincular', 'error'); }
                                    }}
                                    className={unlinkButton}
                                >
                                    Desvincular
                                </button>
                            )}
                            {authProvider === 'both' && jwtClaims.AuthProvider === 'discord' && (
                                <button
                                    onClick={async () => {
                                        if (!confirm('¿Desvincular Twitch? Perderás acceso al bot y al dashboard del streamer.')) return;
                                        try {
                                            const res = await api.post('/auth/unlink-twitch');
                                            if (res.data.token) {
                                                localStorage.setItem('token', res.data.token);
                                                window.location.reload();
                                            }
                                        } catch { addToast('Error al desvincular', 'error'); }
                                    }}
                                    className={unlinkButton}
                                >
                                    Desvincular
                                </button>
                            )}
                        </SettingsRow>

                        <SettingsRow
                            icon={<PlatformIcon color="#5865F2"><MessageSquare className="w-5 h-5" /></PlatformIcon>}
                            title="Discord"
                            description={discordLinked ? <Linked>Vinculado</Linked> : 'No vinculado'}
                        >
                            {authProvider === 'twitch' && (
                                <button
                                    onClick={async () => {
                                        try {
                                            const res = await api.post('/auth/discord/link-start');
                                            if (res.data.url) window.location.href = res.data.url;
                                        } catch { addToast('Error al iniciar vinculación', 'error'); }
                                    }}
                                    className={linkButton}
                                >
                                    Vincular Discord
                                </button>
                            )}
                            {authProvider === 'both' && jwtClaims.AuthProvider !== 'discord' && (
                                <button
                                    onClick={async () => {
                                        if (!confirm('¿Desvincular Discord?')) return;
                                        try {
                                            const res = await api.post('/auth/discord/unlink');
                                            if (res.data.token) {
                                                localStorage.setItem('token', res.data.token);
                                                window.location.reload();
                                            }
                                        } catch { addToast('Error al desvincular', 'error'); }
                                    }}
                                    className={unlinkButton}
                                >
                                    Desvincular
                                </button>
                            )}
                        </SettingsRow>

                        {/* Kick — no fusiona filas, cada canal mantiene su propia config */}
                        {authProvider !== 'kick' && (
                            <SettingsRow
                                icon={<PlatformIcon color="#53FC18"><span className="font-black">K</span></PlatformIcon>}
                                title="Kick"
                                description={linkedKick ? <Linked>Vinculado{linkedKick.kickUsername ? ` (${linkedKick.kickUsername})` : ''}</Linked> : 'No vinculado'}
                            >
                                {!linkedKick ? (
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await api.post('/auth/kick/link-start');
                                                if (res.data.url) window.location.href = res.data.url;
                                            } catch { addToast('Error al iniciar vinculación', 'error'); }
                                        }}
                                        className={linkButton}
                                    >
                                        Vincular Kick
                                    </button>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            if (!confirm('¿Desvincular Kick? El canal sigue existiendo, solo deja de estar agrupado con esta cuenta.')) return;
                                            try {
                                                await api.post('/auth/kick/unlink');
                                                addToast('Kick desvinculado', 'success');
                                                loadAccountChannels();
                                            } catch { addToast('Error al desvincular', 'error'); }
                                        }}
                                        className={unlinkButton}
                                    >
                                        Desvincular
                                    </button>
                                )}
                            </SettingsRow>
                        )}
                        {authProvider === 'both' && (
                            <div className="px-5 4xl:px-7 py-3 bg-ds-ok/10 text-sm 4xl:text-base text-ds-ok font-medium flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Cuentas vinculadas: acceso completo
                            </div>
                        )}
                    </>
                )}
            </SettingsGroup>

            <SettingsGroup title={t('settings:sections.plan.title')} description={t('settings:sections.plan.description')}>
                <div className="px-5 4xl:px-7 py-4 4xl:py-5">
                    {accountTier ? (
                        <TierBadge tier={accountTier} />
                    ) : (
                        <div className="inline-block px-4 py-2 bg-ds-bg text-ds-soft font-bold rounded-lg text-sm animate-pulse">Cargando...</div>
                    )}
                </div>
            </SettingsGroup>

            <SettingsGroup title={t('settings:language.title')} description={t('settings:language.description')}>
                <div className="px-5 4xl:px-7 py-4 4xl:py-5 space-y-4">
                    <LanguageSelector variant="radio" showLabel={false} />
                    <p className="text-sm 4xl:text-base text-ds-soft">{t('settings:language.note')}</p>
                </div>
            </SettingsGroup>
        </div>
    );
}
