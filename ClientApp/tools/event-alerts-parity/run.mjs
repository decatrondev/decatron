#!/usr/bin/env node
// Banco de paridad de Event Alerts: dibuja cada alerta con el overlay viejo y con el renderer nuevo y compara
// las capturas píxel a píxel (estático y cuadros de entrada y salida). Sin red ni producción: la media se
// reemplaza por una imagen generada acá mismo. Uso: ver README.md.

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPayload, listAlerts } from './payload.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT = resolve(HERE, '../..');
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Opciones
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const opt = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = name => args.includes(`--${name}`);

const configsDir = resolve(opt('configs', join(HERE, 'configs')));
const outDir = resolve(opt('out', join(HERE, 'out')));
const only = opt('only', '');
const quick = flag('quick');
const skipBuild = flag('skip-build');
const background = opt('background', '#6b7280');

// Cuadros (ms desde que empieza la animación). El estático compara el viejo ya entrado con el nuevo quieto.
const ENTER = quick ? [0, 300] : [0, 100, 200, 300, 450, 1500];
const EXIT = quick ? [300] : [0, 150, 300, 450];
const REST = 650;

// ---------------------------------------------------------------------------
// Build del harness (vite, con SignalR simulado)
// ---------------------------------------------------------------------------

const distDir = join(outDir, '.dist');

async function buildHarness() {
    const { build } = await import(require.resolve('vite', { paths: [CLIENT] }));
    const react = (await import(require.resolve('@vitejs/plugin-react', { paths: [CLIENT] }))).default;
    process.chdir(CLIENT); // tailwind y postcss se leen desde ClientApp
    await build({
        configFile: false,
        root: HERE,
        base: './',
        logLevel: 'warn',
        publicDir: false,
        plugins: [react()],
        define: { __BUILD_ID__: JSON.stringify('paridad') },
        css: { postcss: CLIENT },
        resolve: {
            alias: [
                { find: '@microsoft/signalr', replacement: join(HERE, 'mockSignalR.ts') },
                { find: /^.*\/utils\/overlayVersion$/, replacement: join(HERE, 'overlayVersionStub.ts') },
            ],
        },
        build: { outDir: distDir, emptyOutDir: true, rollupOptions: { input: join(HERE, 'harness.html') }, minify: false },
    });
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------

function loadPlaywright() {
    for (const paths of [[CLIENT], [process.env.NODE_PATH ?? ''], ['/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']]) {
        try { return require(require.resolve('playwright', { paths: paths.filter(Boolean) })); } catch { /* siguiente */ }
    }
    console.error('No se encontró Playwright. Instálalo con "npm i -g playwright" (o "npm i --no-save playwright" en ClientApp).');
    process.exit(2);
}

const ORIGIN = 'http://paridad.local';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

/** Imagen de ejemplo para toda la media (con detalle en los bordes para que se note cover/contain). */
async function makePlaceholder(browser) {
    const page = await browser.newPage();
    const b64 = await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 640; c.height = 360;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 640, 360);
        grad.addColorStop(0, '#ff5f6d'); grad.addColorStop(1, '#3a7bd5');
        g.fillStyle = grad; g.fillRect(0, 0, 640, 360);
        g.fillStyle = '#ffe66d'; g.beginPath(); g.arc(320, 180, 120, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, 640, 24); g.fillRect(0, 336, 640, 24); g.fillRect(0, 0, 24, 360); g.fillRect(616, 0, 24, 360);
        for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#00c2a8'; g.fillRect(40 + i * 35, 60, 20, 20); }
        return c.toDataURL('image/png').split(',')[1];
    });
    await page.close();
    return Buffer.from(b64, 'base64');
}

async function preparePage(browser, width, height, placeholder) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.error('  [página]', e.message));
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === ORIGIN) {
            const file = join(distDir, decodeURIComponent(url.pathname));
            if (existsSync(file)) return route.fulfill({ status: 200, body: readFileSync(file), contentType: MIME[extname(file)] ?? 'application/octet-stream' });
            return route.fulfill({ status: 404, body: '' });
        }
        // Videos: sin archivo (se ven igual de vacíos en los dos). Todo lo demás: la imagen de ejemplo.
        if (/\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(url.pathname) || route.request().resourceType() === 'media') return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, body: placeholder, contentType: 'image/png' });
    });
    await page.goto(`${ORIGIN}/harness.html`);
    await page.waitForFunction(() => typeof window.__parityRender === 'function');
    return page;
}

/** Píxeles distintos entre dos PNG (comparación exacta), y la imagen de diferencias si hay. */
async function diffPng(cmpPage, a, b) {
    return cmpPage.evaluate(async ([a64, b64]) => {
        const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const [ia, ib] = await Promise.all([load(`data:image/png;base64,${a64}`), load(`data:image/png;base64,${b64}`)]);
        const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
        const read = img => { const c = new OffscreenCanvas(w, h); const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
        const da = read(ia), db = read(ib);
        const out = new ImageData(w, h);
        let count = 0;
        for (let i = 0; i < da.length; i += 4) {
            const same = da[i] === db[i] && da[i + 1] === db[i + 1] && da[i + 2] === db[i + 2] && da[i + 3] === db[i + 3];
            if (!same) { count++; out.data[i] = 255; out.data[i + 3] = 255; } else { out.data[i] = out.data[i + 1] = out.data[i + 2] = da[i] >> 2; out.data[i + 3] = 255; }
        }
        if (!count) return { count, diff: null };
        const c = new OffscreenCanvas(w, h); c.getContext('2d').putImageData(out, 0, 0);
        const blob = await c.convertToBlob({ type: 'image/png' });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return { count, diff: btoa(s) };
    }, [a.toString('base64'), b.toString('base64')]);
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

async function main() {
    if (!existsSync(configsDir)) { console.error(`No existe la carpeta de configs: ${configsDir}`); process.exit(2); }
    const files = readdirSync(configsDir).filter(f => f.endsWith('.json') && (!only || f.includes(only))).sort();
    if (!files.length) { console.error(`No hay configs (.json) en ${configsDir}`); process.exit(2); }

    mkdirSync(outDir, { recursive: true });
    if (!skipBuild || !existsSync(join(distDir, 'harness.html'))) {
        console.log('Compilando el harness…');
        await buildHarness();
    }

    const { chromium } = loadPlaywright();
    const browser = await chromium.launch();
    const placeholder = await makePlaceholder(browser);
    const cmpPage = await browser.newPage();
    const diffDir = join(outDir, 'diffs');
    rmSync(diffDir, { recursive: true, force: true });

    const results = [];
    let totalFrames = 0, badFrames = 0;

    for (const file of files) {
        const config = JSON.parse(readFileSync(join(configsDir, file), 'utf8'));
        const canvas = config?.global?.canvas ?? {};
        const width = Number(canvas.width) || 1920, height = Number(canvas.height) || 1080;
        const page = await preparePage(browser, width, height, placeholder);
        const name = file.replace(/\.json$/, '');

        for (const item of listAlerts(config)) {
            const payload = buildPayload(config, item);
            const partialStyle = item.alertConfig.style;
            const shots = {};
            // 'rest' = la entrada ya terminada (el viejo quieto después de entrar)
            const shoot = async (mode, phase, times) => {
                await page.evaluate(a => window.__parityRender(a), { mode, phase: phase === 'rest' ? 'enter' : phase, config, payload, partialStyle, background });
                for (const t of times) {
                    if (phase === 'rest') await page.evaluate(ms => window.__parityRest(ms), t);
                    else if (phase !== 'static') await page.evaluate(ms => window.__parityFreeze(ms), t);
                    shots[`${mode}|${phase}|${t}`] = await page.screenshot({ type: 'png' });
                }
            };
            await shoot('old', 'enter', ENTER);
            await shoot('old', 'rest', [REST]);
            await shoot('old', 'exit', EXIT);
            for (const mode of ['new', 'new-config']) {
                await shoot(mode, 'enter', ENTER);
                await shoot(mode, 'exit', EXIT);
                await shoot(mode, 'rest', [REST]);
                await shoot(mode, 'static', [0]);
            }

            const row = { config: name, alert: item.label, frames: {} };
            const compare = async (key, oldKey, newKey) => {
                const r = await diffPng(cmpPage, shots[oldKey], shots[newKey]);
                row.frames[key] = r.count;
                totalFrames++;
                if (r.count) {
                    badFrames++;
                    const base = join(diffDir, name, `${item.label}__${key.replace(/[|]/g, '_')}`);
                    mkdirSync(dirname(base), { recursive: true });
                    writeFileSync(`${base}__viejo.png`, shots[oldKey]);
                    writeFileSync(`${base}__nuevo.png`, shots[newKey]);
                    writeFileSync(`${base}__diff.png`, Buffer.from(r.diff, 'base64'));
                }
            };
            for (const mode of ['new', 'new-config']) {
                for (const t of ENTER) await compare(`${mode}|entrada|${t}`, `old|enter|${t}`, `${mode}|enter|${t}`);
                for (const t of EXIT) await compare(`${mode}|salida|${t}`, `old|exit|${t}`, `${mode}|exit|${t}`);
                await compare(`${mode}|reposo`, `old|rest|${REST}`, `${mode}|rest|${REST}`);
                await compare(`${mode}|estatico`, `old|rest|${REST}`, `${mode}|static|0`);
            }
            const worst = Math.max(...Object.values(row.frames));
            results.push(row);
            console.log(`${worst === 0 ? 'OK  ' : 'DIF '} ${name} / ${item.label}${worst ? `  (máx. ${worst} px: ${Object.entries(row.frames).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ')})` : ''}`);
        }
        await page.close();
    }

    await browser.close();
    writeFileSync(join(outDir, 'report.json'), JSON.stringify({ frames: { enter: ENTER, exit: EXIT, rest: REST }, results }, null, 2));
    console.log(`\n${results.length} alertas, ${totalFrames} cuadros comparados, ${badFrames} con diferencias. Informe: ${join(outDir, 'report.json')}`);
    if (badFrames) console.log(`Capturas de los cuadros distintos: ${diffDir}`);
    process.exit(badFrames ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
