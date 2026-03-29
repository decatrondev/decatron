// DesignTab - Visual design configuration for goals overlay

import React from 'react';
import { Palette, Type, Box, Sparkles } from 'lucide-react';
import type { GoalsDesignConfig } from '../../types';

interface DesignTabProps {
    design: GoalsDesignConfig;
    onUpdateDesign: (updates: Partial<GoalsDesignConfig>) => void;
    onUpdateDesignProgressBar: (updates: Partial<GoalsDesignConfig['progressBar']>) => void;
    onUpdateDesignText: (updates: Partial<GoalsDesignConfig['text']>) => void;
    onUpdateDesignContainer: (updates: Partial<GoalsDesignConfig['container']>) => void;
    onUpdateDesignAnimations: (updates: Partial<GoalsDesignConfig['animations']>) => void;
}

export const DesignTab: React.FC<DesignTabProps> = ({
    design,
    onUpdateDesign,
    onUpdateDesignProgressBar,
    onUpdateDesignText,
    onUpdateDesignContainer,
    onUpdateDesignAnimations
}) => {
    return (
        <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                    🎨 Personaliza el aspecto visual del overlay de metas. Los cambios se reflejan en tiempo real en la vista previa.
                </p>
            </div>

            {/* Layout */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Layout
                </h3>

                <div className="space-y-4">
                    {/* Layout Type */}
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Disposición de metas
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'vertical', label: 'Vertical', icon: '⬇️' },
                                { value: 'horizontal', label: 'Horizontal', icon: '➡️' },
                                { value: 'grid', label: 'Grid', icon: '⊞' }
                            ].map((layout) => (
                                <button
                                    key={layout.value}
                                    onClick={() => onUpdateDesign({ layout: layout.value as any })}
                                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                                        design.layout === layout.value
                                            ? 'bg-[#667eea] text-white border-[#667eea]'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] border-transparent hover:border-[#667eea]'
                                    }`}
                                >
                                    <span className="text-lg mr-2">{layout.icon}</span>
                                    {layout.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Max Visible Goals */}
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Máximo de metas visibles: {design.maxVisibleGoals}
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            value={design.maxVisibleGoals}
                            onChange={(e) => onUpdateDesign({ maxVisibleGoals: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        <div className="flex justify-between text-xs text-[#94a3b8] mt-1">
                            <span>1</span>
                            <span>2</span>
                            <span>3</span>
                            <span>4</span>
                            <span>5</span>
                        </div>
                    </div>

                    {/* Spacing */}
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Espaciado: {design.spacing}px
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="48"
                            step="4"
                            value={design.spacing}
                            onChange={(e) => onUpdateDesign({ spacing: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Barra de Progreso
                </h3>

                <div className="space-y-4">
                    {/* Bar Type */}
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Tipo de barra
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'horizontal', label: 'Horizontal' },
                                { value: 'vertical', label: 'Vertical' },
                                { value: 'circular', label: 'Circular' }
                            ].map((type) => (
                                <button
                                    key={type.value}
                                    onClick={() => onUpdateDesignProgressBar({ type: type.value as any })}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
                                        design.progressBar.type === type.value
                                            ? 'bg-[#667eea] text-white border-[#667eea]'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] border-transparent hover:border-[#667eea]'
                                    }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Size */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Ancho: {design.progressBar.width}px
                            </label>
                            <input
                                type="range"
                                min="100"
                                max="500"
                                step="10"
                                value={design.progressBar.width}
                                onChange={(e) => onUpdateDesignProgressBar({ width: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Alto: {design.progressBar.height}px
                            </label>
                            <input
                                type="range"
                                min="8"
                                max="48"
                                step="2"
                                value={design.progressBar.height}
                                onChange={(e) => onUpdateDesignProgressBar({ height: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                        </div>
                    </div>

                    {/* Border Radius */}
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Bordes redondeados: {design.progressBar.borderRadius}px
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="24"
                            value={design.progressBar.borderRadius}
                            onChange={(e) => onUpdateDesignProgressBar({ borderRadius: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Color de fondo
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={design.progressBar.backgroundColor.startsWith('rgba') ? '#374151' : design.progressBar.backgroundColor}
                                    onChange={(e) => onUpdateDesignProgressBar({ backgroundColor: e.target.value })}
                                    className="w-10 h-10 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                />
                                <input
                                    type="text"
                                    value={design.progressBar.backgroundColor}
                                    onChange={(e) => onUpdateDesignProgressBar({ backgroundColor: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Color de relleno
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={design.progressBar.fillColor}
                                    onChange={(e) => onUpdateDesignProgressBar({ fillColor: e.target.value })}
                                    className="w-10 h-10 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                />
                                <input
                                    type="text"
                                    value={design.progressBar.fillColor}
                                    onChange={(e) => onUpdateDesignProgressBar({ fillColor: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Gradient */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-[#64748b] dark:text-[#94a3b8]">
                                Usar gradiente
                            </label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={design.progressBar.useGradient}
                                    onChange={(e) => onUpdateDesignProgressBar({ useGradient: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#667eea]"></div>
                            </label>
                        </div>

                        {design.progressBar.useGradient && (
                            <div className="grid grid-cols-2 gap-4 mt-3">
                                <div>
                                    <label className="block text-xs text-[#94a3b8] mb-1">Desde</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={design.progressBar.gradientFrom || '#667eea'}
                                            onChange={(e) => onUpdateDesignProgressBar({ gradientFrom: e.target.value })}
                                            className="w-8 h-8 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={design.progressBar.gradientFrom || '#667eea'}
                                            onChange={(e) => onUpdateDesignProgressBar({ gradientFrom: e.target.value })}
                                            className="flex-1 px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-xs"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-[#94a3b8] mb-1">Hasta</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={design.progressBar.gradientTo || '#764ba2'}
                                            onChange={(e) => onUpdateDesignProgressBar({ gradientTo: e.target.value })}
                                            className="w-8 h-8 rounded cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={design.progressBar.gradientTo || '#764ba2'}
                                            onChange={(e) => onUpdateDesignProgressBar({ gradientTo: e.target.value })}
                                            className="flex-1 px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Show Options */}
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={design.progressBar.showPercentage}
                                onChange={(e) => onUpdateDesignProgressBar({ showPercentage: e.target.checked })}
                                className="w-4 h-4 text-[#667eea] bg-gray-100 border-gray-300 rounded focus:ring-[#667eea]"
                            />
                            <span className="text-sm text-[#64748b]">Mostrar porcentaje</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={design.progressBar.showValues}
                                onChange={(e) => onUpdateDesignProgressBar({ showValues: e.target.checked })}
                                className="w-4 h-4 text-[#667eea] bg-gray-100 border-gray-300 rounded focus:ring-[#667eea]"
                            />
                            <span className="text-sm text-[#64748b]">Mostrar valores (50/100)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={design.progressBar.animated}
                                onChange={(e) => onUpdateDesignProgressBar({ animated: e.target.checked })}
                                className="w-4 h-4 text-[#667eea] bg-gray-100 border-gray-300 rounded focus:ring-[#667eea]"
                            />
                            <span className="text-sm text-[#64748b]">Animación suave</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Text Styling */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Tipografía
                </h3>

                <div className="space-y-4">
                    {/* Font Family */}
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Fuente
                        </label>
                        <select
                            value={design.text.fontFamily}
                            onChange={(e) => onUpdateDesignText({ fontFamily: e.target.value })}
                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="Inter, sans-serif">Inter</option>
                            <option value="Roboto, sans-serif">Roboto</option>
                            <option value="Poppins, sans-serif">Poppins</option>
                            <option value="Montserrat, sans-serif">Montserrat</option>
                            <option value="Open Sans, sans-serif">Open Sans</option>
                            <option value="monospace">Monospace</option>
                        </select>
                    </div>

                    {/* Goal Name */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Tamaño nombre: {design.text.goalNameSize}px
                            </label>
                            <input
                                type="range"
                                min="12"
                                max="32"
                                value={design.text.goalNameSize}
                                onChange={(e) => onUpdateDesignText({ goalNameSize: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Color nombre
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={design.text.goalNameColor}
                                    onChange={(e) => onUpdateDesignText({ goalNameColor: e.target.value })}
                                    className="w-10 h-10 rounded-lg cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={design.text.goalNameColor}
                                    onChange={(e) => onUpdateDesignText({ goalNameColor: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Values */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Tamaño valores: {design.text.valuesSize}px
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="24"
                                value={design.text.valuesSize}
                                onChange={(e) => onUpdateDesignText({ valuesSize: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Color valores
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={design.text.valuesColor}
                                    onChange={(e) => onUpdateDesignText({ valuesColor: e.target.value })}
                                    className="w-10 h-10 rounded-lg cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={design.text.valuesColor}
                                    onChange={(e) => onUpdateDesignText({ valuesColor: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Container */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Contenedor
                </h3>

                <div className="space-y-4">
                    {/* Background */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Color de fondo
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={design.container.backgroundColor}
                                    onChange={(e) => onUpdateDesignContainer({ backgroundColor: e.target.value })}
                                    className="w-10 h-10 rounded-lg cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={design.container.backgroundColor}
                                    onChange={(e) => onUpdateDesignContainer({ backgroundColor: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Opacidad: {design.container.backgroundOpacity}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={design.container.backgroundOpacity}
                                onChange={(e) => onUpdateDesignContainer({ backgroundOpacity: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                        </div>
                    </div>

                    {/* Border & Padding */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Bordes redondeados: {design.container.borderRadius}px
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="32"
                                value={design.container.borderRadius}
                                onChange={(e) => onUpdateDesignContainer({ borderRadius: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                                Padding: {design.container.padding}px
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="32"
                                value={design.container.padding}
                                onChange={(e) => onUpdateDesignContainer({ padding: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                        </div>
                    </div>

                    {/* Shadow */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={design.container.shadow}
                            onChange={(e) => onUpdateDesignContainer({ shadow: e.target.checked })}
                            className="w-4 h-4 text-[#667eea] bg-gray-100 border-gray-300 rounded focus:ring-[#667eea]"
                        />
                        <span className="text-sm text-[#64748b]">Mostrar sombra</span>
                    </label>
                </div>
            </div>

            {/* Animations */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Animaciones
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Animación de progreso
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'smooth', label: 'Suave' },
                                { value: 'bounce', label: 'Rebote' },
                                { value: 'none', label: 'Ninguna' }
                            ].map((anim) => (
                                <button
                                    key={anim.value}
                                    onClick={() => onUpdateDesignAnimations({ progressAnimation: anim.value as any })}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
                                        design.animations.progressAnimation === anim.value
                                            ? 'bg-[#667eea] text-white border-[#667eea]'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] border-transparent hover:border-[#667eea]'
                                    }`}
                                >
                                    {anim.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Al alcanzar milestone
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { value: 'pulse', label: 'Pulso' },
                                { value: 'shake', label: 'Temblor' },
                                { value: 'glow', label: 'Brillo' },
                                { value: 'none', label: 'Ninguna' }
                            ].map((anim) => (
                                <button
                                    key={anim.value}
                                    onClick={() => onUpdateDesignAnimations({ onMilestone: anim.value as any })}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
                                        design.animations.onMilestone === anim.value
                                            ? 'bg-[#667eea] text-white border-[#667eea]'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] border-transparent hover:border-[#667eea]'
                                    }`}
                                >
                                    {anim.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#64748b] dark:text-[#94a3b8] mb-2">
                            Al completar meta
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { value: 'confetti', label: 'Confeti' },
                                { value: 'flash', label: 'Flash' },
                                { value: 'scale', label: 'Escala' },
                                { value: 'none', label: 'Ninguna' }
                            ].map((anim) => (
                                <button
                                    key={anim.value}
                                    onClick={() => onUpdateDesignAnimations({ onComplete: anim.value as any })}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
                                        design.animations.onComplete === anim.value
                                            ? 'bg-[#667eea] text-white border-[#667eea]'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] border-transparent hover:border-[#667eea]'
                                    }`}
                                >
                                    {anim.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DesignTab;
