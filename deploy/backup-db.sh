#!/usr/bin/env bash
# Faz uma cópia do banco do DATABASE_URL (.env.local) e guarda só as mais recentes.
# Uso: deploy/backup-db.sh   (variáveis opcionais: BACKUP_DIR, BACKUP_KEEP)
# Restaurar: veja "Backup do banco" no README.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/clareza}"
BACKUP_KEEP="${BACKUP_KEEP:-7}"

DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$APP_DIR/.env.local" | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//')"
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL não encontrada em $APP_DIR/.env.local" >&2; exit 1; }

umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/clareza-$(date +%Y-%m-%d_%H%M%S).dump"

# Grava num arquivo temporário e só renomeia depois de conferir que a cópia abre.
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$file.tmp"
pg_restore --list "$file.tmp" > /dev/null
mv "$file.tmp" "$file"

# Apaga as cópias antigas, mantendo as $BACKUP_KEEP mais recentes.
ls -1t "$BACKUP_DIR"/clareza-*.dump | tail -n +"$((BACKUP_KEEP + 1))" | xargs -r rm --

echo "Backup salvo: $file ($(du -h "$file" | cut -f1))"
