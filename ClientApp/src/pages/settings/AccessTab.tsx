import { Trash2, Plus, Crown, EyeOff, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsGroup, SettingsRow, linkButton } from './parts';
import type { SettingsCtx } from './types';

/** Pestaña «Accesos»: quién más puede gestionar este canal. */
export default function AccessTab({ s }: { s: SettingsCtx }) {
    const { t } = useTranslation(['settings', 'common']);
    const { channelUsers, userInfo, isAccessOwner, loading, setShowAddUserModal, openEditAccess, removeUser } = s;
    return (
        <div className="space-y-6 4xl:space-y-8">
            <SettingsGroup
                title={t('settings:accessManagement.title')}
                action={
                    <button
                        onClick={() => setShowAddUserModal(true)}
                        className="ds-btn ds-btn--primary"
                    >
                        <Plus className="w-4 h-4" />
                        {t('settings:accessManagement.addAccess')}
                    </button>
                }
            >
                <SettingsRow
                    icon={<Crown className="w-5 h-5 text-ds-accent-text" />}
                    title={userInfo.displayName}
                    description={`@${userInfo.login}`}
                >
                    <span className="px-3 py-1 bg-ds-accent text-white text-xs 4xl:text-sm font-bold rounded">{t('settings:accessLevels.owner')}</span>
                </SettingsRow>
            </SettingsGroup>

            <SettingsGroup
                title={t('settings:accessManagement.usersWithAccess')}
                description={isAccessOwner ? t('settings:accessManagement.hiddenHint') : undefined}
            >
                {channelUsers.length === 0 ? (
                    <div className="text-center text-ds-soft py-8 text-sm 4xl:text-base">{t('settings:accessManagement.noUsers')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm 4xl:text-base">
                            <thead>
                                <tr className="text-left text-ds-soft">
                                    <th className="px-5 4xl:px-7 py-3 font-semibold">{t('settings:accessManagement.tableHeaders.name')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('settings:accessManagement.tableHeaders.username')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('settings:accessManagement.tableHeaders.permissions')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('settings:accessManagement.tableHeaders.addedBy')}</th>
                                    <th className="px-5 4xl:px-7 py-3 font-semibold text-right">{t('settings:accessManagement.tableHeaders.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ds-border border-t border-ds-border">
                                {channelUsers.map((user) => (
                                    <tr key={user.id} className={`hover:bg-ds-bg transition-colors ${user.isHidden ? 'opacity-60' : ''}`}>
                                        <td className="px-5 4xl:px-7 py-3 text-ds-text font-medium">
                                            <div className="flex items-center gap-2">
                                                <span>{user.displayName}</span>
                                                {user.isHidden && (
                                                    <span title={t('settings:accessManagement.hiddenBadge')} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-ds-bg text-ds-soft">
                                                        <EyeOff className="w-3 h-3" />
                                                        {t('settings:accessManagement.hiddenBadge')}
                                                    </span>
                                                )}
                                                {user.isSelf && <span className="text-xs font-bold text-ds-accent-text">{t('settings:accessManagement.youBadge')}</span>}
                                            </div>
                                            {user.alias && (
                                                <div className="text-xs text-ds-soft font-normal">
                                                    {t('settings:accessManagement.aliasLabel')}: {user.alias}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-ds-soft">{user.isAliased ? '—' : `@${user.username}`}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${user.accessLevel === 'control_total' ? 'bg-ds-accent text-white' : user.accessLevel === 'moderation' ? 'bg-ds-accent/15 text-ds-accent-text border border-ds-accent/30' : 'bg-ds-bg text-ds-soft border border-ds-border'}`}>
                                                {user.permissionLabel}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-ds-soft">{user.grantedBy === '__owner__' ? t('settings:accessManagement.owner') : user.grantedBy}</td>
                                        <td className="px-5 4xl:px-7 py-3 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                {isAccessOwner && (
                                                    <button
                                                        onClick={() => openEditAccess(user)}
                                                        disabled={loading}
                                                        title={t('settings:accessManagement.editAccess')}
                                                        className="p-1.5 hover:bg-ds-accent-hover rounded text-ds-accent-text hover:text-white transition-all disabled:opacity-50"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => removeUser(user.id)}
                                                    disabled={loading}
                                                    className="p-1.5 hover:bg-ds-danger rounded text-ds-danger hover:text-white transition-all disabled:opacity-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SettingsGroup>
        </div>
    );
}
