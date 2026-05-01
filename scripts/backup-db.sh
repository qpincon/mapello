#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="data/backups"
mkdir -p "$BACKUP_DIR"

sqlite3 data/cartosvg.db ".backup $BACKUP_DIR/cartosvg-$(date +%Y%m%d-%H%M%S).db"

# Keep last 7 days of backups
find "$BACKUP_DIR" -name "cartosvg-*.db" -mtime +7 -delete

echo "Backup complete: $BACKUP_DIR"
