/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        // Tremor
        "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            // Breakpoints propios para monitores grandes — Tailwind por default corta
            // en 1536px (2xl) y no distingue nada mas alla. Sin esto, todo lo que
            // pusieramos "responsive" para 2K/4K quedaba con el mismo layout que un
            // notebook de 1440p, que es exactamente el reclamo: contenido chico y
            // centrado, sin adaptarse a la pantalla real.
            screens: {
                '3xl': '1920px', // HD / Full HD
                '4xl': '2560px', // 2K / QHD
                '5xl': '3840px', // 4K / UHD
            },
            colors: {
                // Base común de todas las vistas públicas (portada, legales, /sprites, /sr, comandos, emotes).
                // Los valores viven en components/ds/tokens.ts y se inyectan como variables CSS (--pub-*, canales r g b).
                pub: {
                    bg: 'rgb(var(--pub-bg) / <alpha-value>)',
                    surface: 'rgb(var(--pub-surface) / <alpha-value>)',
                    raised: 'rgb(var(--pub-raised) / <alpha-value>)',
                    border: 'rgb(var(--pub-border) / <alpha-value>)',
                    'border-soft': 'rgb(var(--pub-border-soft) / <alpha-value>)',
                    accent: 'rgb(var(--pub-accent) / <alpha-value>)',
                    'accent-hi': 'rgb(var(--pub-accent-hi) / <alpha-value>)',
                    'accent-hover': 'rgb(var(--pub-accent-hover) / <alpha-value>)',
                },
                // Colores semánticos del sistema de diseño (siguen el tema claro/oscuro solos): bg-ds-surface, text-ds-soft…
                ds: {
                    bg: 'rgb(var(--dc-bg) / <alpha-value>)',
                    surface: 'rgb(var(--dc-surface) / <alpha-value>)',
                    raised: 'rgb(var(--dc-raised) / <alpha-value>)',
                    input: 'rgb(var(--dc-input) / <alpha-value>)',
                    border: 'rgb(var(--dc-border) / <alpha-value>)',
                    'border-soft': 'rgb(var(--dc-border-soft) / <alpha-value>)',
                    text: 'rgb(var(--dc-text) / <alpha-value>)',
                    soft: 'rgb(var(--dc-soft) / <alpha-value>)',
                    faint: 'rgb(var(--dc-faint) / <alpha-value>)',
                    accent: 'rgb(var(--dc-accent) / <alpha-value>)',
                    'accent-hover': 'rgb(var(--dc-accent-hover) / <alpha-value>)',
                    'accent-text': 'rgb(var(--dc-accent-text) / <alpha-value>)',
                    'on-accent': 'rgb(var(--dc-on-accent) / <alpha-value>)',
                    ok: 'rgb(var(--dc-ok) / <alpha-value>)',
                    warn: 'rgb(var(--dc-warn) / <alpha-value>)',
                    danger: 'rgb(var(--dc-danger) / <alpha-value>)',
                    'syntax-keyword': 'rgb(var(--dc-syntax-keyword) / <alpha-value>)',
                    'syntax-string': 'rgb(var(--dc-syntax-string) / <alpha-value>)',
                    'syntax-number': 'rgb(var(--dc-syntax-number) / <alpha-value>)',
                },
                // Azul profesional (accent)
                accent: {
                    DEFAULT: '#2563eb',
                    light: '#1d4ed8',
                    hover: 'rgba(37, 99, 235, 0.1)',
                },
                // Backgrounds
                bg: {
                    light: '#ffffff',
                    dark: '#1B1C1D',
                },
                card: {
                    light: '#f8fafc',
                    dark: '#262626',
                },
                // Borders
                border: {
                    light: '#e2e8f0',
                    dark: '#374151',
                },
                // Text
                text: {
                    light: '#f8fafc',
                    dark: '#1e293b',
                    muted: {
                        light: '#64748b',
                        dark: '#94a3b8',
                    }
                },
                // Success
                success: {
                    DEFAULT: '#10b981',
                    dark: '#059669',
                    border: '#22c55e',
                    bg: 'rgba(34, 197, 94, 0.1)',
                },
                // Danger
                danger: {
                    DEFAULT: '#dc2626',
                    dark: '#b91c1c',
                    border: '#ef4444',
                    bg: 'rgba(239, 68, 68, 0.1)',
                },
                // Twitch purple
                twitch: {
                    DEFAULT: '#9146ff',
                    dark: '#772ce8',
                },
                // Kick green
                kick: {
                    DEFAULT: '#53fc18',
                    dark: '#3ecc0a',
                },
                // YouTube red
                youtube: {
                    DEFAULT: '#ff0000',
                    dark: '#cc0000',
                }
            },
            fontFamily: {
                // Chakra Petch ya se cargaba en index.html sin usarse en ningun lado.
                // Es la tipografia de titulos de la landing (ver Index.tsx).
                display: ['"Chakra Petch"', 'sans-serif'],
                // Vista publica de torneos (rediseño "grafico de transmision"): titulos y
                // numeros de marcador + texto. Ver .dev/torneos/16-rediseno-publico.md.
                scoreboard: ['"Big Shoulders Display"', 'sans-serif'],
                barlow: ['Barlow', 'sans-serif'],
                // Settings (rediseño 2026-09-29): solo dentro de esa pagina.
                onest: ['Onest', 'sans-serif'],
            },
        },
    },
    plugins: [],
}