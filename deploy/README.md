# פריסה (dream-vps)

- קוד: `git archive HEAD | ssh dream-vps "tar -x -C /opt/rezef"`, ואז `cd /opt/rezef && docker compose up -d --build`.
- סביבה: `/opt/rezef/.env` (chmod 600). משתנים: `POSTGRES_PASSWORD`, `REZEF_BRIDGE_SECRET`, `SESSION_SECRET`, `INTERNAL_KEY`, `WP_URL`, `APP_URL`, `PILOT_WP_USER_IDS`.
- מיגרציות רצות אוטומטית בבקשה הראשונה אחרי עדכון (`AUTO_MIGRATE=1`).
- סנכרון שימוש לחומר פתוח, כל שעה: `/etc/cron.d/rezef`

  ```
  17 * * * * root /opt/rezef/deploy/sync-usage.sh >> /var/log/rezef-sync.log 2>&1
  ```

  בדיקה בלי שליחה: להוסיף `?dry=1` לכתובת הסנכרון.
