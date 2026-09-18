#!/usr/bin/env python3
"""
Sincroniza el catalogo de sprites de Fortnite con la API propia
(https://decatron-fortnite-api.decatron.net), que extrae los datos
directamente de los archivos del juego (CUE4Parse) — reemplaza al repo de
GitHub de terceros (staticvacant/fnsprites) y a rickventure.com, que ya no
se usan.

Que hace:
  1. Descarga el catalogo completo de /v1/sprites.
  2. Matchea contra lo que ya tenemos en fortnite_sprites por (personaje, tema
     normalizado) — no por sprite_key exacto, porque la API nueva usa una
     nomenclatura distinta (ej. "8_bit_basic" vs el "8bit_basic" viejo). Esto
     preserva el id (PK) de cada fila que ya existia, asi que
     user_fortnite_sprites (que referencia por id, no por sprite_key) queda
     intacto sin tocar nada — nadie pierde su coleccion.
  3. Actualiza esas filas con la clave/nombre/tema/rareza/temporada nuevos.
  4. Inserta las que son nuevas de verdad (sin equivalente viejo).
  5. Lo que ya estaba en la base y no tiene equivalente en la API nueva se
     deja intacto, nunca se borra.
  6. Descarga a ClientApp/public/sprites/ y dist/sprites/ las imagenes que
     falten (bajo el nombre NUEVO del sprite_key).

Es idempotente: se puede correr cada vez.

Uso:
    python3 scripts/sync-fortnite-sprites.py            # aplica los cambios
    python3 scripts/sync-fortnite-sprites.py --dry-run  # solo muestra el diff
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request

API_BASE = "https://decatron-fortnite-api.decatron.net/v1"
SPRITES_URL = f"{API_BASE}/sprites"
IMG_URL = f"{API_BASE}/sprites"  # + /{id}.png

# Las columnas son 'timestamp without time zone' y el bot las escribe/compara
# en UTC (DateTime.UtcNow). Un NOW() pelado las grabaria en hora de Lima
# (-05) y los avisos de "spirits nuevos" quedarian 5 horas corridos.
UTC_NOW = "(NOW() AT TIME ZONE 'utc')"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "ClientApp", "public", "sprites")
# Vite copia public/ a dist/ solo al buildear. Escribiendo tambien aca, las
# imagenes nuevas quedan servidas por nginx al toque, sin esperar un build.
DIST_IMG_DIR = os.path.join(ROOT, "ClientApp", "dist", "sprites")
SECRETS = os.path.join(ROOT, "appsettings.Secrets.json")

# Los themes "Rift" y "Cube" del catalogo viejo son un solo theme aca
# ("Rift/Cube") — se usa esto solo para MATCHEAR filas viejas, el valor que
# se guarda de ahi en mas es siempre el de la API nueva.
def norm_theme(theme):
    theme = theme.strip()
    if theme in ("Rift", "Cube", "Rift/Cube"):
        return "RIFTCUBE"
    return theme.lower()


def read_secret(section, key):
    """Lee appsettings.Secrets.json linea por linea (trae comentarios // que no son JSON valido)."""
    in_section = False
    for line in open(SECRETS, encoding="utf-8"):
        stripped = line.lstrip()
        if stripped.startswith("//"):
            continue
        if f'"{section}"' in stripped:
            in_section = True
        if in_section:
            m = re.search(rf'"{key}"\s*:\s*"([^"]+)"', stripped)
            if m:
                return m.group(1)
            if in_section and stripped.startswith("}"):
                break
    sys.exit(f"No se encontro {section}.{key} en appsettings.Secrets.json")


def connection_string():
    return read_secret("ConnectionStrings", "DefaultConnection")


def api_key():
    return read_secret("DecatronFortniteApi", "ApiKey")


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0",
        "Authorization": f"Bearer {api_key()}",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def fetch_sprites():
    data = json.loads(fetch(SPRITES_URL).decode("utf-8"))
    for s in data:
        s["unreleased"] = bool(s["unreleased"])
    return data


def pg_env():
    parts = dict(
        p.split("=", 1) for p in connection_string().split(";") if "=" in p
    )
    lookup = {k.lower(): v for k, v in parts.items()}
    env = dict(os.environ, PGPASSWORD=lookup.get("password", ""))
    args = [
        "-h", lookup.get("host", "localhost"),
        "-p", lookup.get("port", "5432"),
        "-U", lookup.get("username", "postgres"),
        "-d", lookup.get("database", "decatron"),
    ]
    return env, args, lookup.get("database", "decatron")


def read_db(env, args):
    out = subprocess.run(
        ["psql", *args, "-Atc",
         "select id, sprite_key, name, character, theme, rarity, is_unreleased, "
         "coalesce(season, '') from fortnite_sprites"],
        env=env, capture_output=True, text=True, check=True,
    ).stdout
    rows = []
    for line in out.strip().splitlines():
        if not line:
            continue
        id_, key, name, character, theme, rarity, unreleased, season = line.split("|")
        rows.append({
            "id": int(id_), "key": key, "name": name, "character": character,
            "theme": theme, "rarity": rarity,
            "unreleased": unreleased in ("t", "true"), "season": season,
        })
    return rows


def match(old_rows, new_sprites):
    """Devuelve (matched, new_only, old_only) — matched es lista de (old_row, new_sprite)."""
    new_by_key = {}
    for n in new_sprites:
        k = (n["character"].strip().lower(), norm_theme(n["theme"]))
        new_by_key.setdefault(k, []).append(n)

    matched = []
    old_only = []
    used_new_ids = set()

    for o in old_rows:
        k = (o["character"].strip().lower(), norm_theme(o["theme"]))
        candidates = [n for n in new_by_key.get(k, []) if n["id"] not in used_new_ids]
        if candidates:
            n = candidates[0]
            used_new_ids.add(n["id"])
            matched.append((o, n))
        else:
            old_only.append(o)

    new_only = [n for n in new_sprites if n["id"] not in used_new_ids]
    return matched, new_only, old_only


def sync_images(sprites, dry_run):
    have = set(os.listdir(IMG_DIR)) if os.path.isdir(IMG_DIR) else set()
    missing = [s["id"] for s in sprites if f"{s['id']}.png" not in have]

    dist_have = set(os.listdir(DIST_IMG_DIR)) if os.path.isdir(DIST_IMG_DIR) else set()
    to_copy = sorted(have - dist_have)

    if not missing and not to_copy:
        print("Imagenes: todas presentes (public y dist)")
        return

    if missing:
        print(f"Imagenes faltantes: {len(missing)}")
    if to_copy:
        print(f"Imagenes en public/ pendientes de copiar a dist/: {len(to_copy)}")

    if dry_run:
        for key in missing:
            print(f"  - {key}.png")
        return

    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(DIST_IMG_DIR, exist_ok=True)

    for key in missing:
        try:
            data = fetch(f"{IMG_URL}/{key}.png")
        except Exception as exc:
            print(f"  ! {key}.png no se pudo descargar ({exc})")
            continue
        write_image(IMG_DIR, f"{key}.png", data)
        write_image(DIST_IMG_DIR, f"{key}.png", data)
        print(f"  + {key}.png")

    for key in to_copy:
        with open(os.path.join(IMG_DIR, key), "rb") as fh:
            data = fh.read()
        if write_image(DIST_IMG_DIR, key, data):
            print(f"  ~ {key} copiada a dist/")


def write_image(directory, name, data):
    """
    Escribe sin abortar el sync entero si falla una sola imagen. Caso real
    (2026-09-18): dist/sprites/ quedo root:root tras un build con sudo y el
    cron (usuario decatron) reventaba con PermissionError en la primera
    imagen, dejando las otras 44 sin bajar.
    """
    try:
        with open(os.path.join(directory, name), "wb") as fh:
            fh.write(data)
        return True
    except OSError as exc:
        print(f"  ! {name} no se pudo escribir en {directory} ({exc})")
        return False


def clamp_unreleased(matched):
    """
    Nunca se deja que 'unreleased' retroceda de False a True — pase lo que
    pase en la fuente. Si algo ya esta confirmado como released (alguien ya
    lo tiene en su coleccion), ningun sync automatico se lo puede sacar.
    Real: la API nueva marca 35 sprites de la temporada Runners como
    unreleased porque su extractor lee el build actual del juego, donde esos
    desafios viejos ya no estan activos — pero la gente ya los tiene.
    """
    downgraded = []
    for o, n in matched:
        if not o["unreleased"] and n["unreleased"]:
            n["unreleased"] = False
            downgraded.append(n["id"])
    return downgraded


def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"


def sync_db(matched, new_only, old_only, env, args, dry_run):
    updates = []
    for o, n in matched:
        fields = []
        if o["key"] != n["id"]: fields.append(f"sprite_key: {o['key']} -> {n['id']}")
        if o["name"] != n["name"]: fields.append(f"name: {o['name']} -> {n['name']}")
        if o["theme"] != n["theme"]: fields.append(f"theme: {o['theme']} -> {n['theme']}")
        if o["rarity"] != n["rarity"]: fields.append(f"rarity: {o['rarity']} -> {n['rarity']}")
        if o["unreleased"] != n["unreleased"]: fields.append(f"unreleased: {o['unreleased']} -> {n['unreleased']}")
        if o["season"] != n["season"]: fields.append(f"season: {o['season']} -> {n['season']}")
        if fields:
            updates.append((o, n, fields))

    print(f"\nSprites a actualizar (match por personaje+tema): {len(updates)}")
    for o, n, fields in updates:
        print(f"  ~ id={o['id']:4} {o['key']:22} -> {n['id']:22} | {', '.join(fields)}")

    print(f"\nSprites nuevos (sin equivalente viejo): {len(new_only)}")
    for n in new_only:
        estado = "unreleased" if n["unreleased"] else "released"
        print(f"  + {n['id']:22} {n['name']} ({n['character']}, {n['rarity']}, {estado})")

    if old_only:
        print(f"\nEn la base sin equivalente en la API nueva ({len(old_only)}), se dejan intactos:")
        for o in old_only:
            print(f"  ? id={o['id']:4} {o['key']:22} ({o['character']}, {o['theme']}, {o['rarity']})")

    if not updates and not new_only:
        print("\nNada que aplicar en la base")
        return
    if dry_run:
        print("\n--dry-run: no se aplico nada")
        return

    statements = ["BEGIN;"]

    for o, n, _fields in updates:
        statements.append(f"""
UPDATE fortnite_sprites SET
    sprite_key    = {sql_literal(n['id'])},
    name          = {sql_literal(n['name'])},
    character     = {sql_literal(n['character'])},
    theme         = {sql_literal(n['theme'])},
    rarity        = {sql_literal(n['rarity'])},
    image_url     = {sql_literal(f"/sprites/{n['id']}.png")},
    is_unreleased = {"true" if n["unreleased"] else "false"},
    season        = {sql_literal(n['season'])},
    released_at   = CASE
                        WHEN fortnite_sprites.released_at IS NOT NULL THEN fortnite_sprites.released_at
                        WHEN {"true" if n["unreleased"] else "false"} THEN NULL
                        ELSE {UTC_NOW}
                     END,
    updated_at    = {UTC_NOW}
WHERE id = {o['id']};""")

    if new_only:
        values = ",\n".join(
            "({}, {}, {}, {}, {}, {}, {}, {}, {})".format(
                sql_literal(n["id"]), sql_literal(n["name"]),
                sql_literal(n["character"]), sql_literal(n["theme"]),
                sql_literal(n["rarity"]), sql_literal(f"/sprites/{n['id']}.png"),
                "true" if n["unreleased"] else "false",
                sql_literal(n["season"]),
                "NULL" if n["unreleased"] else UTC_NOW,
            )
            for n in new_only
        )
        statements.append(f"""
INSERT INTO fortnite_sprites
    (sprite_key, name, character, theme, rarity, image_url, is_unreleased, season, released_at)
VALUES
{values}
ON CONFLICT (sprite_key) DO NOTHING;""")

    statements.append("COMMIT;")

    subprocess.run(["psql", *args, "-v", "ON_ERROR_STOP=1", "-q"],
                   env=env, input="\n".join(statements), text=True, check=True)
    print(f"\nAplicado: {len(updates)} actualizados, {len(new_only)} nuevos")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="muestra el diff sin tocar nada")
    opts = parser.parse_args()

    new_sprites = fetch_sprites()
    print(f"API decatron-fortnite-api: {len(new_sprites)} sprites")

    env, args, dbname = pg_env()
    old_rows = read_db(env, args)
    print(f"Base ({dbname}): {len(old_rows)} sprites")

    matched, new_only, old_only = match(old_rows, new_sprites)

    downgraded = clamp_unreleased(matched)
    if downgraded:
        print(f"\nLa API marca {len(downgraded)} sprite(s) ya released como unreleased — se ignora ese cambio puntual (nunca se retrocede): {', '.join(downgraded)}")

    all_current = [n for _, n in matched] + new_only
    sync_images(all_current, opts.dry_run)
    sync_db(matched, new_only, old_only, env, args, opts.dry_run)


if __name__ == "__main__":
    main()
