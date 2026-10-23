#!/bin/sh
# סנכרון נתוני שימוש מצטברים מהרצף אל חומר פתוח. רץ משעון ה-cron של השרת (ראו deploy/README.md).
# המפתח נקרא מקובץ הסביבה של השרת, ולא נשמר בקוד. הבקשה נשלחת מתוך הקונטיינר בעזרת node,
# כי wget של alpine (busybox) לא שולח POST ריק בצורה שהשרת מקבל.
set -eu
KEY=$(grep '^INTERNAL_KEY=' /opt/rezef/.env | cut -d= -f2-)
docker exec -e KEY="$KEY" rezef-app node -e '
fetch("http://127.0.0.1:3000/api/internal/sync-usage", { method: "POST", headers: { "x-internal-key": process.env.KEY } })
  .then(async (r) => console.log(new Date().toISOString(), r.status, await r.text()))
  .catch((e) => { console.error(e); process.exit(1); });
'
