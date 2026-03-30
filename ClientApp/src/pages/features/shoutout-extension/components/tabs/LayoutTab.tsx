import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LayoutConfig, DragElement } from '../../types';

interface LayoutTabProps {
    layout: LayoutConfig;
    setLayout: React.Dispatch<React.SetStateAction<LayoutConfig>>;
    canvasRef: React.RefObject<HTMLDivElement | null>;
    isDragging: boolean;
    setIsDragging: (v: boolean) => void;
    dragElement: DragElement;
    setDragElement: (v: DragElement) => void;
    dragOffset: { x: number; y: number };
    setDragOffset: (v: { x: number; y: number }) => void;
}

export function LayoutTab({
    layout, setLayout, canvasRef,
    isDragging, setIsDragging, dragElement, setDragElement,
    dragOffset, setDragOffset
}: LayoutTabProps) {
    const { t } = useTranslation('features');

    const handleMouseDown = (element: DragElement, e: React.MouseEvent) => {
        setIsDragging(true);
        setDragElement(element);

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const canvas = canvasRef.current?.getBoundingClientRect();

        if (canvas) {
            const scale = canvas.width / 1000;
            setDragOffset({
                x: (e.clientX - rect.left) / scale,
                y: (e.clientY - rect.top) / scale
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragElement || !canvasRef.current) return;

        const canvas = canvasRef.current.getBoundingClientRect();
        const scale = canvas.width / 1000;

        const x = Math.max(0, Math.min(1000, ((e.clientX - canvas.left) / scale) - dragOffset.x));
        const y = Math.max(0, Math.min(300, ((e.clientY - canvas.top) / scale) - dragOffset.y));

        if (dragElement === 'clip') {
            setLayout(prev => ({
                ...prev,
                clip: { ...prev.clip, x: Math.round(x), y: Math.round(y) }
            }));
        } else if (dragElement === 'text') {
            setLayout(prev => ({
                ...prev,
                text: { ...prev.text, x: Math.round(x), y: Math.round(y) }
            }));
        } else if (dragElement === 'profile') {
            setLayout(prev => ({
                ...prev,
                profile: { ...prev.profile, x: Math.round(x), y: Math.round(y) }
            }));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragElement(null);
    };

    return (
        <div className="space-y-6">
            {/* Visual Editor */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    {t('shoutoutTabs.visualEditor')}
                </h3>

                <div
                    ref={canvasRef}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="relative w-full aspect-[10/3] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border-2 border-[#e2e8f0] dark:border-[#374151] cursor-default"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                >
                    {/* Clip Element (Video) */}
                    <div
                        onMouseDown={(e) => handleMouseDown('clip', e)}
                        className={`absolute bg-blue-500/30 border-2 border-blue-500 rounded-lg flex items-center justify-center text-white font-bold cursor-move ${
                            dragElement === 'clip' ? 'ring-4 ring-blue-300' : ''
                        }`}
                        style={{
                            left: `${(layout.clip.x / 1000) * 100}%`,
                            top: `${(layout.clip.y / 300) * 100}%`,
                            width: `${(layout.clip.width / 1000) * 100}%`,
                            height: `${(layout.clip.height / 300) * 100}%`
                        }}
                    >
                        <div className="text-center">
                            <div className="text-2xl mb-1">🎬</div>
                            <div className="text-xs">CLIP</div>
                        </div>
                    </div>

                    {/* Profile Element (Photo) */}
                    <div
                        onMouseDown={(e) => handleMouseDown('profile', e)}
                        className={`absolute bg-purple-500/30 border-2 border-purple-500 rounded-full flex items-center justify-center text-white font-bold cursor-move ${
                            dragElement === 'profile' ? 'ring-4 ring-purple-300' : ''
                        }`}
                        style={{
                            left: `${(layout.profile.x / 1000) * 100}%`,
                            top: `${(layout.profile.y / 300) * 100}%`,
                            width: `${(layout.profile.size / 1000) * 100}%`,
                            height: `${(layout.profile.size / 300) * 100}%`
                        }}
                    >
                        <div className="text-center">
                            <div className="text-2xl">👤</div>
                        </div>
                    </div>

                    {/* Text Element */}
                    <div
                        onMouseDown={(e) => handleMouseDown('text', e)}
                        className={`absolute bg-green-500/30 border-2 border-green-500 rounded-lg flex items-center justify-center text-white font-bold cursor-move ${
                            dragElement === 'text' ? 'ring-4 ring-green-300' : ''
                        }`}
                        style={{
                            left: `${(layout.text.x / 1000) * 100}%`,
                            top: `${(layout.text.y / 300) * 100}%`,
                            width: '200px',
                            height: '80px',
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        <div className="text-center px-2">
                            <div className="text-xl mb-1">📝</div>
                            <div className="text-xs">{t('shoutoutTabs.text').toUpperCase()}</div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        {t('shoutoutTabs.dragTip')}
                    </p>
                </div>
            </div>

            {/* Position Controls */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    {t('shoutoutTabs.positionSettings')}
                </h3>

                <div className="space-y-6">
                    {/* Clip Position */}
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg">
                        <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                            🎬 {t('shoutoutTabs.clipVideo')}
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">X</label>
                                <input
                                    type="number"
                                    value={layout.clip.x}
                                    onChange={(e) => setLayout({ ...layout, clip: { ...layout.clip, x: parseInt(e.target.value) || 0 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">Y</label>
                                <input
                                    type="number"
                                    value={layout.clip.y}
                                    onChange={(e) => setLayout({ ...layout, clip: { ...layout.clip, y: parseInt(e.target.value) || 0 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">{t('shoutoutTabs.width')}</label>
                                <input
                                    type="number"
                                    value={layout.clip.width}
                                    onChange={(e) => setLayout({ ...layout, clip: { ...layout.clip, width: parseInt(e.target.value) || 100 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">{t('shoutoutTabs.height')}</label>
                                <input
                                    type="number"
                                    value={layout.clip.height}
                                    onChange={(e) => setLayout({ ...layout, clip: { ...layout.clip, height: parseInt(e.target.value) || 100 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Profile Position */}
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg">
                        <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                            👤 {t('shoutoutTabs.profilePhoto')}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">X</label>
                                <input
                                    type="number"
                                    value={layout.profile.x}
                                    onChange={(e) => setLayout({ ...layout, profile: { ...layout.profile, x: parseInt(e.target.value) || 0 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">Y</label>
                                <input
                                    type="number"
                                    value={layout.profile.y}
                                    onChange={(e) => setLayout({ ...layout, profile: { ...layout.profile, y: parseInt(e.target.value) || 0 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">{t('shoutoutTabs.size')}</label>
                                <input
                                    type="number"
                                    value={layout.profile.size}
                                    onChange={(e) => setLayout({ ...layout, profile: { ...layout.profile, size: parseInt(e.target.value) || 50 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Text Position */}
                    <div className="p-4 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg">
                        <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                            📝 {t('shoutoutTabs.text')}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">X</label>
                                <input
                                    type="number"
                                    value={layout.text.x}
                                    onChange={(e) => setLayout({ ...layout, text: { ...layout.text, x: parseInt(e.target.value) || 0 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">Y</label>
                                <input
                                    type="number"
                                    value={layout.text.y}
                                    onChange={(e) => setLayout({ ...layout, text: { ...layout.text, y: parseInt(e.target.value) || 0 } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1 block">{t('shoutoutTabs.alignment')}</label>
                                <select
                                    value={layout.text.align}
                                    onChange={(e) => setLayout({ ...layout, text: { ...layout.text, align: e.target.value } })}
                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                >
                                    <option value="left">{t('shoutoutTabs.alignLeft')}</option>
                                    <option value="center">{t('shoutoutTabs.alignCenter')}</option>
                                    <option value="right">{t('shoutoutTabs.alignRight')}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
