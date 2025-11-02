Quick links (replace <port> with the one printed at startup)

- Home page: http://localhost:<port>/
- Admin dashboard: http://localhost:<port>/admin  (or /admin.html)
- Config health: http://localhost:<port>/health/config
- Database health: http://localhost:<port>/health/db
- API (public):
  - GET resources: http://localhost:<port>/api/resources
  - POST notification: http://localhost:<port>/api/notifications
  - GET notifications for user 1: http://localhost:<port>/api/notifications/1
- API (admin, requires ADMIN_TOKEN or ADMIN_BYPASS=true):
  - http://localhost:<port>/api/admin/health
  - http://localhost:<port>/api/admin/stats
  - http://localhost:<port>/api/admin/resources

Notes
- On startup the server prints: "Server listening on http://localhost:<port>". Use that port in the links above.
- If 3000 is busy, the app automatically tries 3001..3010 and prints the final port.
