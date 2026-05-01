#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="data/backups"
mkdir -p "$BACKUP_DIR"

sqlite3 data/mapello.db ".backup $BACKUP_DIR/mapello-$(date +%Y%m%d-%H%M%S).db"

# Keep last 7 days of backups
find "$BACKUP_DIR" -name "mapello-*.db" -mtime +7 -delete

echo "Backup complete: $BACKUP_DIR"
