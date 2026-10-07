#!/usr/bin/env bash
# End-to-end check of the LimeSurvey exports against a real LimeSurvey 6 in Docker.
# Needs Docker and Python 3. Usage: scripts/limesurvey-e2e/run.sh [import|push|all]
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
if [ ! -f out/.env.test ]; then
  gen() { python3 -c "import secrets; print(secrets.token_urlsafe(12))"; }
  printf "LS_USER=admin\nLS_PASS=%s\nDB_PASS=%s\n" "$(gen)" "$(gen)" > out/.env.test
fi
set -a; . out/.env.test; set +a
docker compose --env-file out/.env.test -p lstest up -d
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8082/index.php/admin)" = 302 ]; do sleep 5; done
docker exec lstest-db-1 mariadb -ulimesurvey -p"$DB_PASS" limesurvey -e \
  "INSERT INTO lime_settings_global (stg_name, stg_value) VALUES ('RPCInterface','json') ON DUPLICATE KEY UPDATE stg_value='json';"
(cd ../.. && npx tsx scripts/limesurvey-e2e/fixtures.ts)
mode="${1:-all}"
[ "$mode" = push ] || python3 e2e.py import
# The push needs the app running with LIMESURVEY_PUSH_ALLOW_PRIVATE=1 (see README):
#   LIMESURVEY_PUSH_ALLOW_PRIVATE=1 npx next dev -p 3005
[ "$mode" = import ] || python3 e2e.py push
echo "Stop the stack with: docker compose -p lstest down -v"
