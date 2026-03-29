import { Shield, Plus, Trash2 } from 'lucide-react';

interface ManagementTabProps {
    blacklist: string[];
    whitelist: string[];
    addToBlacklist: (username: string) => void;
    removeFromBlacklist: (index: number) => void;
    addToWhitelist: (username: string) => void;
    removeFromWhitelist: (index: number) => void;
}

export function ManagementTab({
    blacklist, whitelist,
    addToBlacklist, removeFromBlacklist,
    addToWhitelist, removeFromWhitelist
}: ManagementTabProps) {
    return (
        <div className="space-y-6">
            {/* Blacklist */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-600" />
                    Blacklist (Lista Negra)
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Usuarios que <strong>NO pueden recibir</strong> shoutouts. Cuando alguien intenta hacer <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">!so usuario</code> de alguien en esta lista, el comando será ignorado.
                </p>

                <div className="space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="nombre_de_usuario"
                            className="flex-1 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const input = e.currentTarget;
                                    const username = input.value.trim().toLowerCase();
                                    if (username && !blacklist.includes(username)) {
                                        addToBlacklist(username);
                                        input.value = '';
                                    }
                                }
                            }}
                        />
                        <button
                            onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const username = input.value.trim().toLowerCase();
                                if (username && !blacklist.includes(username)) {
                                    addToBlacklist(username);
                                    input.value = '';
                                }
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar
                        </button>
                    </div>

                    {blacklist.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8] text-sm">
                            No hay usuarios en la lista negra
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {blacklist.map((username, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg"
                                >
                                    <span className="text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                        @{username}
                                    </span>
                                    <button
                                        onClick={() => removeFromBlacklist(index)}
                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Whitelist */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    Whitelist (Lista Blanca)
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Usuarios <strong>ADICIONALES</strong> que pueden ejecutar <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">!so</code> aparte de mods y streamer. Los <strong>moderadores y el streamer SIEMPRE pueden usar</strong> el comando (excepto si están en la blacklist). Esta lista es para agregar viewers extras.
                </p>

                <div className="space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="nombre_de_usuario"
                            className="flex-1 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const input = e.currentTarget;
                                    const username = input.value.trim().toLowerCase();
                                    if (username && !whitelist.includes(username)) {
                                        addToWhitelist(username);
                                        input.value = '';
                                    }
                                }
                            }}
                        />
                        <button
                            onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const username = input.value.trim().toLowerCase();
                                if (username && !whitelist.includes(username)) {
                                    addToWhitelist(username);
                                    input.value = '';
                                }
                            }}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar
                        </button>
                    </div>

                    {whitelist.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8] text-sm">
                            Lista vacía - Todos los moderadores pueden usar !so
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {whitelist.map((username, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg"
                                >
                                    <span className="text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                        @{username}
                                    </span>
                                    <button
                                        onClick={() => removeFromWhitelist(index)}
                                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
