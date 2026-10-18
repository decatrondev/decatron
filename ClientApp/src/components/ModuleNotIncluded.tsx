import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Se muestra en lugar de una vista cuyo módulo no trae el plan del tenant (el servidor también lo bloquea con 403 module_not_included).
export default function ModuleNotIncluded() {
    const { t } = useTranslation('layout');
    const navigate = useNavigate();
    return (
        <div className="panel-scale">
            <div className="ds-empty">
                <Lock className="w-8 h-8 text-ds-soft" aria-hidden />
                <p className="ds-card-title">{t('planModules.title')}</p>
                <p className="ds-card-text">{t('planModules.text')}</p>
                <div style={{ marginTop: 16 }}>
                    <button className="ds-btn ds-btn--primary" onClick={() => navigate('/dashboard')}>{t('planModules.back')}</button>
                </div>
            </div>
        </div>
    );
}
