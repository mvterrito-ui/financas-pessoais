#!/usr/bin/env bash
# Backup completo do banco (rede de segurança do plano free).
# Uso:  npm run backup    (ou  bash scripts/backup.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

# Lê a connection string do .env.local (tudo após o primeiro '=').
if [ -f .env.local ]; then
  SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- || true)
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ Defina SUPABASE_DB_URL no .env.local."
  echo "   Pegue em: Supabase > Settings > Database > Connection string > URI"
  echo "   (troque [YOUR-PASSWORD] pela senha do banco que você criou)"
  exit 1
fi

mkdir -p backups
ARQ="backups/backup-$(date +%Y%m%d-%H%M%S).sql"
echo "📦 Gerando backup em $ARQ ..."
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges -f "$ARQ"
echo "✅ Backup salvo: $ARQ"
