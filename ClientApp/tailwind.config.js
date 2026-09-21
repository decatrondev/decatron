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
            },
        },
    },
    plugins: [],
}