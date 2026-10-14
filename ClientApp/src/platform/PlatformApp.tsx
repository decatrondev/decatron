import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BrandProvider } from '../brand/BrandContext';
import PlatformLanding from '../pages/platform/PlatformLanding';
import { PlatformConfirm, PlatformNotFound } from '../pages/platform/PlatformConfirm';
import '../i18n/config';

// Árbol de rutas del dominio de la plataforma (decatron.top). Es independiente del del bot: aquí no existe
// /dashboard, /login ni ninguna ruta de decatron.net. Se carga con React.lazy desde App.tsx solo para este dominio.
export default function PlatformApp() {
    return (
        <BrowserRouter>
            <BrandProvider>
                <Routes>
                    <Route path="/" element={<PlatformLanding />} />
                    <Route path="/lista-de-espera/confirmar" element={<PlatformConfirm />} />
                    <Route path="*" element={<PlatformNotFound />} />
                </Routes>
            </BrandProvider>
        </BrowserRouter>
    );
}
