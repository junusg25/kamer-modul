#!/bin/bash

# Database Backup Script for Kamer.ba
# Automatically backs up PostgreSQL database with compression and retention

set -e

# Configuration
BACKUP_DIR="/var/backups/kamerba"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y-%m-%d)
DB_NAME="repairshop"
DB_USER="repairshop_user"
RETENTION_DAYS=7

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🗄️  Kamer.ba Database Backup"
echo "================================================"
echo "Timestamp: $(date)"
echo "Database: $DB_NAME"
echo ""

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
    exit 1
fi

# Create backup
echo "📦 Creating database backup..."
if pg_dump -U $DB_USER -d $DB_NAME > $BACKUP_DIR/backup_$TIMESTAMP.sql; then
    echo -e "${GREEN}✓ Backup created successfully${NC}"
else
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi

# Compress backup
echo "🗜️  Compressing backup..."
if gzip $BACKUP_DIR/backup_$TIMESTAMP.sql; then
    BACKUP_FILE="backup_$TIMESTAMP.sql.gz"
    BACKUP_SIZE=$(du -h $BACKUP_DIR/$BACKUP_FILE | cut -f1)
    echo -e "${GREEN}✓ Backup compressed: $BACKUP_SIZE${NC}"
else
    echo -e "${RED}✗ Compression failed${NC}"
    exit 1
fi

# Clean old backups
echo "🧹 Cleaning old backups (older than $RETENTION_DAYS days)..."
DELETED_COUNT=$(find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ $DELETED_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠ Deleted $DELETED_COUNT old backup(s)${NC}"
else
    echo "No old backups to delete"
fi

# List current backups
echo ""
echo "📂 Current backups:"
ls -lh $BACKUP_DIR/backup_*.sql.gz 2>/dev/null | tail -n 5 || echo "No backups found"

# Summary
echo ""
echo "================================================"
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo "Location: $BACKUP_DIR/$BACKUP_FILE"
echo "Size: $BACKUP_SIZE"
echo "================================================"

# Optional: Upload to cloud storage (uncomment if using)
# echo "☁️  Uploading to cloud storage..."
# aws s3 cp $BACKUP_DIR/$BACKUP_FILE s3://your-bucket/kamerba/backups/

