# Banco de paridad de Event Alerts

Compara, píxel a píxel, el overlay viejo (`src/pages/EventAlertsOverlay.tsx`, sin tocar) con el renderer nuevo
(`src/components/event-alert-overlay/`) usando las mismas alertas. No usa producción ni red.

## Cómo correrlo

Desde `ClientApp/` (con `npm install` hecho y Playwright disponible: global con `npm i -g playwright`, o
`npm i --no-save playwright` en `ClientApp/`; usa el Chromium de Playwright):

```bash
node tools/event-alerts-parity/run.mjs                        # las configs de ejemplo (configs/)
node tools/event-alerts-parity/run.mjs --configs /ruta/configs # otra carpeta con configs .json
```

Opciones:

- `--configs <carpeta>`: una config por archivo `.json`, tal como se guarda en la base (el JSON con `global`,
  `follow`, `bits`, …). Las reales van fuera de git.
- `--out <carpeta>`: dónde dejar el informe y las capturas (por defecto `out/`, ignorada por git).
- `--only <texto>`: solo las configs cuyo nombre de archivo contiene ese texto.
- `--quick`: menos cuadros (para probar rápido).
- `--skip-build`: reusa el harness ya compilado.
- `--background <color>`: color de fondo de la página (por defecto `#6b7280`, para que se note la transparencia).

Sale con código 0 si todo es idéntico y 1 si algún cuadro difiere.

## Qué hace

1. Compila `harness.tsx` con Vite. `@microsoft/signalr` se reemplaza por `mockSignalR.ts` (el overlay viejo se
   conecta a eso y el banco le manda `ShowEventAlert`) y el vigilante de versión por un stub.
2. Por cada config arma las alertas que mandaría el backend (`payload.mjs`, copia de la lógica de
   `EventAlertsService.cs`: nivel por cantidad, variantes, `style` = `global.defaultStyle` + el del
   evento/nivel/variante, `overlayElements`, media y animación). Prueba cada evento, cada tier de sub, cada nivel
   alcanzable de bits/gift subs/raids/resubs (y la alerta base), los 5 niveles del hype train y cada variante.
3. Dibuja cada alerta con:
   - `old`: el overlay viejo tal cual.
   - `new`: el renderer nuevo con `normalizeEventAlertsDesign(config)` + `resolveAlertDesign` usando el `style` y
     las posiciones que llegan en la alerta (lo que hará el overlay de OBS).
   - `new-config`: igual, pero con el `style` parcial sacado de la config y las posiciones de la conversión (prueba
     la conversión sola, sin ayuda del payload).
4. Cuadros: entrada a 0, 100, 200, 300, 450 y 1500 ms (con los efectos ya corriendo), salida a 0, 150, 300 y
   450 ms (animaciones en pausa con `currentTime` fijo), `reposo` (la entrada terminada de verdad) y `estatico`
   (el renderer con `phase="static"` contra el viejo en reposo).
5. Compara exacto (tolerancia 0). Deja `out/report.json` con los píxeles distintos por cuadro y, de cada cuadro
   distinto, las capturas `__viejo.png`, `__nuevo.png` y `__diff.png` (en rojo lo distinto) en `out/diffs/`.

Toda la media (imágenes, GIF, fondos) se reemplaza por una imagen generada en el momento; los videos responden
404 y se ven vacíos en los dos. Las fuentes que no estén instaladas en la máquina caen en la misma de reemplazo en
los dos lados.

## Configs de ejemplo

`configs/` tiene configs inventadas que cubren: cada evento con los valores de fábrica (01), subs por tier con
estilo propio (02), un nivel con `style` parcial (03), variantes (04), fondos color/degradado/imagen/transparente
e imagen vacía (05), borde (06), `mediaLayout` y ajuste de media (07), texto largo (08, con `_parity.username` y
`_parity.userMessage`, que solo lee el banco), sin media y sin mensaje (09), lienzo 500×500 (10), elementos
movidos, apagados y a medio definir (11, 12) y config mínima sin `defaultStyle` ni `overlayElements`, con video (13).
