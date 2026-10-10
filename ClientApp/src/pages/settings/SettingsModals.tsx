import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SettingsCtx } from './types';

/** Ventanas de Configuración: agregar acceso, editar acceso y confirmar eliminación. */
export default function SettingsModals({ s }: { s: SettingsCtx }) {
    const { t } = useTranslation(['settings', 'common']);
    const { newUserId, setNewUserId, newPermission, setNewPermission, newIsHidden, setNewIsHidden, newAlias, setNewAlias, isAccessOwner, editAccess, setEditAccess, loading, showAddUserModal, setShowAddUserModal, confirmModal, setConfirmModal, addUser, saveEditAccess } = s;
    return (
        <>
                    {showAddUserModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-ds-surface rounded-lg p-6 max-w-md w-full border border-ds-border">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-black text-ds-text">{t('settings:accessManagement.addUserModal.title')}</h3>
                                    <button onClick={() => setShowAddUserModal(false)} className="text-ds-soft hover:text-ds-text">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-ds-soft mb-2">{t('settings:accessManagement.addUserModal.uniqueIdLabel')}</label>
                                        <input
                                            type="text"
                                            value={newUserId}
                                            onChange={(e) => setNewUserId(e.target.value)}
                                            placeholder={t("settings:accessManagement.addUserModal.uniqueIdPlaceholder")}
                                            className="ds-input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-ds-soft mb-2">{t('settings:accessManagement.addUserModal.permissionLabel')}</label>
                                        <select
                                            value={newPermission}
                                            onChange={(e) => setNewPermission(e.target.value)}
                                            className="ds-input"
                                        >
                                            <option value="commands">{t('settings:accessManagement.addUserModal.permissionCommands')}</option>
                                            <option value="moderation">{t('settings:accessManagement.addUserModal.permissionModeration')}</option>
                                            <option value="control_total">{t('settings:accessManagement.addUserModal.permissionControlTotal')}</option>
                                        </select>
                                    </div>
                                    {isAccessOwner && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-bold text-ds-soft mb-2">{t('settings:accessManagement.aliasLabel')}</label>
                                                <input
                                                    type="text"
                                                    maxLength={30}
                                                    value={newAlias}
                                                    onChange={(e) => setNewAlias(e.target.value)}
                                                    placeholder={t("settings:accessManagement.aliasPlaceholder")}
                                                    className="ds-input"
                                                />
                                                <p className="text-xs text-ds-soft mt-1">{t('settings:accessManagement.aliasHelp')}</p>
                                            </div>
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={newIsHidden}
                                                    onChange={(e) => setNewIsHidden(e.target.checked)}
                                                    className="mt-1 w-4 h-4 accent-ds-accent"
                                                />
                                                <span>
                                                    <span className="block text-sm font-bold text-ds-text">{t('settings:accessManagement.hiddenLabel')}</span>
                                                    <span className="block text-xs text-ds-soft">{t('settings:accessManagement.hiddenHelp')}</span>
                                                </span>
                                            </label>
                                        </>
                                    )}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={() => setShowAddUserModal(false)}
                                            className="ds-btn ds-btn--secondary flex-1"
                                        >
                                            {t('settings:accessManagement.addUserModal.cancel')}
                                        </button>
                                        <button
                                            onClick={addUser}
                                            disabled={loading}
                                            className="ds-btn ds-btn--primary flex-1"
                                        >
                                            {loading ? t("settings:accessManagement.addUserModal.adding") : t('settings:accessManagement.addUserModal.add')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {editAccess && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-ds-surface rounded-lg p-6 max-w-md w-full border border-ds-border">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-xl font-black text-ds-text">{t('settings:accessManagement.editUserModal.title')}</h3>
                                        <p className="text-sm text-ds-soft">{editAccess.displayName}</p>
                                    </div>
                                    <button onClick={() => setEditAccess(null)} className="text-ds-soft hover:text-ds-text">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-ds-soft mb-2">{t('settings:accessManagement.addUserModal.permissionLabel')}</label>
                                        <select
                                            value={editAccess.permissionLevel}
                                            onChange={(e) => setEditAccess({ ...editAccess, permissionLevel: e.target.value })}
                                            className="ds-input"
                                        >
                                            <option value="commands">{t('settings:accessManagement.addUserModal.permissionCommands')}</option>
                                            <option value="moderation">{t('settings:accessManagement.addUserModal.permissionModeration')}</option>
                                            <option value="control_total">{t('settings:accessManagement.addUserModal.permissionControlTotal')}</option>
                                        </select>
                                    </div>
                                    {isAccessOwner && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-bold text-ds-soft mb-2">{t('settings:accessManagement.aliasLabel')}</label>
                                                <input
                                                    type="text"
                                                    maxLength={30}
                                                    value={editAccess.alias}
                                                    onChange={(e) => setEditAccess({ ...editAccess, alias: e.target.value })}
                                                    placeholder={t("settings:accessManagement.aliasPlaceholder")}
                                                    className="ds-input"
                                                />
                                                <p className="text-xs text-ds-soft mt-1">{t('settings:accessManagement.aliasHelp')}</p>
                                            </div>
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editAccess.isHidden}
                                                    onChange={(e) => setEditAccess({ ...editAccess, isHidden: e.target.checked })}
                                                    className="mt-1 w-4 h-4 accent-ds-accent"
                                                />
                                                <span>
                                                    <span className="block text-sm font-bold text-ds-text">{t('settings:accessManagement.hiddenLabel')}</span>
                                                    <span className="block text-xs text-ds-soft">{t('settings:accessManagement.hiddenHelp')}</span>
                                                </span>
                                            </label>
                                        </>
                                    )}
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={() => setEditAccess(null)}
                                            className="ds-btn ds-btn--secondary flex-1"
                                        >
                                            {t('settings:accessManagement.addUserModal.cancel')}
                                        </button>
                                        <button
                                            onClick={saveEditAccess}
                                            disabled={loading}
                                            className="ds-btn ds-btn--primary flex-1"
                                        >
                                            {loading ? t("settings:accessManagement.editUserModal.saving") : t('settings:accessManagement.editUserModal.save')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {confirmModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-ds-surface rounded-lg p-6 max-w-md w-full border border-ds-border">
                                <h3 className="text-xl font-black text-ds-text">{confirmModal.title}</h3>
                                <p className="text-ds-soft my-4">{confirmModal.message}</p>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setConfirmModal(null)}
                                        disabled={loading}
                                        className="ds-btn ds-btn--secondary flex-1"
                                    >
                                        {t('settings:accessManagement.removeUserModal.cancel')}
                                    </button>
                                    <button
                                        onClick={confirmModal.onConfirm}
                                        disabled={loading}
                                        className="ds-btn ds-btn--danger flex-1"
                                    >
                                        {loading ? t("settings:accessManagement.removeUserModal.deleting") : t('settings:accessManagement.removeUserModal.confirm')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
        </>
    );
}
