#!/usr/bin/env python3
"""
Sincroniza el catalogo de sprites de Fortnite con el proyecto original
(https://github.com/staticvacant/fnsprites).

Que hace:
  1. Descarga sprites-data.js del repo upstream y lo parsea.
  2. Descarga a ClientApp/public/sprites/ las imagenes que falten.
  3. Hace UPSERT por sprite_key en fortnite_sprites (nombre, tema, rareza,
     estado unreleased). Nunca borra sprites ni toca user_fortnite_sprites,
     asi que las colecciones de los usuarios quedan intactas.

Es idempotente: se puede correr cada vez que el repo de arriba se actualice.

Uso:
    python3 scripts/sync-fnsprites.py            # aplica los cambios
    python3 scripts/sync-fnsprites.py --dry-run  # solo muestra el diff
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request

RAW_BASE = "https://raw.githubusercontent.com/staticvacant/fnsprites/main"
DATA_URL = f"{RAW_BASE}/sprites-data.js"
IMG_URL = f"{RAW_BASE}/sprites"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "ClientApp", "public", "sprites")
SECRETS = os.path.join(ROOT, "appsettings.Secrets.json")

SPRITE_RE = re.compile(
    r'\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*theme:\s*"([^"]+)",'
    r'\s*rarity:\s*"([^"]+)",\s*unreleased:\s*(true|false)'
)


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def parse_upstream(js):
    """Devuelve la lista de sprites, ignorando las lineas comentadas."""
    sprites = []
    for line in js.splitlines():
        if line.lstrip().startswith("//"):
            continue
        m = SPRITE_RE.search(line)
        if m:
            key, name, theme, rarity, unreleased = m.groups()
            sprites.append({
                "key": key,
                "name": name,
                "theme": theme,
                "rarity": rarity,
                "unreleased": unreleased == "true",
            })
    return sprites


def add_characters(sprites):
    """El upstream no guarda personaje: se toma del nombre de su '<prefijo>_basic'."""
    by_prefix = {s["key"].split("_")[0]: s["name"] for s in sprites
                 if s["key"].endswith("_basic")}
    for s in sprites:
        prefix = s["key"].split("_")[0]
        s["character"] = by_prefix.get(prefix, s["name"])
    return sprites


def connection_string():
    """Lee el DefaultConnection activo (el archivo trae lineas comentadas)."""
    for line in open(SECRETS, encoding="utf-8"):
        stripped = line.lstrip()
        if stripped.startswith("//"):
            continue
        m = re.search(r'"DefaultConnection"\s*:\s*"([^"]+)"', stripped)
        if m:
            return m.group(1)
    sys.exit("No se encontro DefaultConnection en appsettings.Secrets.json")


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
         "select sprite_key, name, character, theme, rarity, is_unreleased "
         "from fortnite_sprites"],
        env=env, capture_output=True, text=True, check=True,
    ).stdout
    db = {}
    for line in out.strip().splitlines():
        if not line:
            continue
        key, name, character, theme, rarity, unreleased = line.split("|")
        db[key] = {
            "name": name, "character": character, "theme": theme,
            "rarity": rarity, "unreleased": unreleased in ("t", "true"),
        }
    return db


def sync_images(sprites, dry_run):
    have = set(os.listdir(IMG_DIR)) if os.path.isdir(IMG_DIR) else set()
    missing = [s["key"] for s in sprites if f"{s['key']}.png" not in have]
    if not missing:
        print("Imagenes: todas presentes")
        return
    print(f"Imagenes faltantes: {len(missing)}")
    if dry_run:
        for key in missing:
            print(f"  - {key}.png")
        return
    for key in missing:
        try:
            data = fetch(f"{IMG_URL}/{key}.png")
        except Exception as exc:  # el upstream a veces lista sprites sin imagen
            print(f"  ! {key}.png no se pudo descargar ({exc})")
            continue
        with open(os.path.join(IMG_DIR, f"{key}.png"), "wb") as fh:
            fh.write(data)
        print(f"  + {key}.png")


def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"


def sync_db(sprites, db, env, args, dry_run):
    news = [s for s in sprites if s["key"] not in db]
    changes = []
    for s in sprites:
        old = db.get(s["key"])
        if not old:
            continue
        fields = [f for f in ("name", "character", "theme", "rarity", "unreleased")
                  if old[f] != s[f]]
        if fields:
            changes.append((s, old, fields))

    print(f"\nSprites nuevos: {len(news)}")
    for s in news:
        estado = "unreleased" if s["unreleased"] else "released"
        print(f"  + {s['key']:22} {s['name']} ({s['character']}, {s['rarity']}, {estado})")

    print(f"\nSprites modificados: {len(changes)}")
    for s, old, fields in changes:
        detalle = ", ".join(f"{f}: {old[f]} -> {s[f]}" for f in fields)
        print(f"  ~ {s['key']:22} {detalle}")

    huerfanos = [k for k in db if k not in {s["key"] for s in sprites}]
    if huerfanos:
        print(f"\nEn la base pero ya no en el upstream ({len(huerfanos)}), "
              f"se dejan intactos: {', '.join(sorted(huerfanos))}")

    if not news and not changes:
        print("\nNada que aplicar en la base")
        return
    if dry_run:
        print("\n--dry-run: no se aplico nada")
        return

    values = ",\n".join(
        "({}, {}, {}, {}, {}, {}, {})".format(
            sql_literal(s["key"]), sql_literal(s["name"]),
            sql_literal(s["character"]), sql_literal(s["theme"]),
            sql_literal(s["rarity"]), sql_literal(f"/sprites/{s['key']}.png"),
            "true" if s["unreleased"] else "false",
        )
        for s in sprites
    )
    sql = f"""
BEGIN;
INSERT INTO fortnite_sprites
    (sprite_key, name, character, theme, rarity, image_url, is_unreleased)
VALUES
{values}
ON CONFLICT (sprite_key) DO UPDATE SET
    name          = EXCLUDED.name,
    character     = EXCLUDED.character,
    theme         = EXCLUDED.theme,
    rarity        = EXCLUDED.rarity,
    image_url     = EXCLUDED.image_url,
    is_unreleased = EXCLUDED.is_unreleased,
    updated_at    = NOW()
WHERE fortnite_sprites.name          IS DISTINCT FROM EXCLUDED.name
   OR fortnite_sprites.character     IS DISTINCT FROM EXCLUDED.character
   OR fortnite_sprites.theme         IS DISTINCT FROM EXCLUDED.theme
   OR fortnite_sprites.rarity        IS DISTINCT FROM EXCLUDED.rarity
   OR fortnite_sprites.image_url     IS DISTINCT FROM EXCLUDED.image_url
   OR fortnite_sprites.is_unreleased IS DISTINCT FROM EXCLUDED.is_unreleased;
COMMIT;
"""
    subprocess.run(["psql", *args, "-v", "ON_ERROR_STOP=1", "-q"],
                   env=env, input=sql, text=True, check=True)
    print(f"\nAplicado: {len(news)} nuevos, {len(changes)} actualizados")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="muestra el diff sin tocar nada")
    opts = parser.parse_args()

    sprites = add_characters(parse_upstream(fetch(DATA_URL).decode("utf-8")))
    print(f"Upstream: {len(sprites)} sprites")

    env, args, dbname = pg_env()
    db = read_db(env, args)
    print(f"Base ({dbname}): {len(db)} sprites")

    sync_images(sprites, opts.dry_run)
    sync_db(sprites, db, env, args, opts.dry_run)


if __name__ == "__main__":
    main()
