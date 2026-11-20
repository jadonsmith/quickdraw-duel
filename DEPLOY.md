# Deploying

Quick-Draw Duel ships as part of the **play.jadon.me** collection and is served at
`play.jadon.me/quickdraw/`. The full runbook (systemd units, the shared nginx
config, TLS) lives in [`../play/DEPLOY.md`](../play/DEPLOY.md).

Running it on its own box instead: it's a single Node process that serves `public/`
and its WebSocket on one port. Set `PORT` / `HOST`, put it behind nginx with the
WebSocket `Upgrade` headers, add a Let's Encrypt cert. The `location` block and
`.service` unit in `../play/deploy/` are the template — just drop the `/quickdraw/`
prefix so it sits at the domain root.
