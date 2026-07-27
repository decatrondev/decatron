import { Link, Outlet } from 'react-router-dom';
import { Bot, ArrowLeft } from 'lucide-react';

export default function LegalLayout() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D] flex flex-col">
            {/* Header */}
            <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#1B1C1D]/95 backdrop-blur-sm border-b border-[#e2e8f0] dark:border-[#374151] shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2 text-2xl font-black text-[#2563eb]">
                        <Bot className="w-8 h-8" />
                        <span>Decatron</span>
                    </Link>
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-sm font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver al inicio
                    </Link>
                </div>
            </nav>

            {/* Content */}
            <main className="flex-1">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="py-8 px-4 bg-[#f8fafc] dark:bg-[#111214] border-t border-[#e2e8f0] dark:border-[#374151]">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-wrap justify-center gap-6 mb-4">
                        <Link to="/terminos" className="text-sm text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors font-medium">
                            Términos y Condiciones
                        </Link>
                        <Link to="/privacidad" className="text-sm text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors font-medium">
                            Política de Privacidad
                        </Link>
                        <Link to="/devoluciones" className="text-sm text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors font-medium">
                            Devoluciones
                        </Link>
                        <Link to="/libro-reclamaciones" className="text-sm text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#2563eb] transition-colors font-medium">
                            Libro de Reclamaciones
                        </Link>
                    </div>
                    <p className="text-center text-xs text-[#94a3b8] dark:text-[#475569]">
                        &copy; {new Date().getFullYear()} Decatron. Todos los derechos reservados.
                    </p>
                </div>
            </footer>
        </div>
    );
}
