#!/bin/sh
# סנכרון נתוני שימוש מצטברים מהרצף אל חומר פתוח. רץ משעון ה-cron של השרת (ראו deploy/README.md).
# המפתח נקרא מקובץ הסביבה של השרת, ולא נשמר בקוד.
set -eu
KEY=$(grep '^INTERNAL_KEY=' /opt/rezef/.env | cut -d= -f2-)
docker exec rezef-app wget -q -O- --header "x-internal-key: $KEY" --post-data "" \
  http://127.0.0.1:3000/api/internal/sync-usage
echo
