#!/bin/sh
# קריאה חד-פעמית לנתיב פנימי של האפליקציה (עם המפתח הפנימי מקובץ הסביבה בשרת).
# דוגמה: /opt/rezef/deploy/internal-call.sh /api/internal/backfill-types
set -eu
KEY=$(grep '^INTERNAL_KEY=' /opt/rezef/.env | cut -d= -f2-)
docker exec -e KEY="$KEY" -e TARGET="$1" rezef-app node -e '
fetch("http://127.0.0.1:3000" + process.env.TARGET, { method: "POST", headers: { "x-internal-key": process.env.KEY } })
  .then(async (r) => console.log(r.status, await r.text()))
  .catch((e) => { console.error(e); process.exit(1); });
'
