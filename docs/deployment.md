# Deployment guide

## Kubernetes

Expose separate HTTP and Colyseus ports when using standalone mode. Keep the
WebSocket service address stable per game-server process and configure probes
against the application's health controller.

```yaml
readinessProbe:
  httpGet:
    path: /health/colyseus
    port: http
livenessProbe:
  httpGet:
    path: /health/colyseus
    port: http
terminationGracePeriodSeconds: 30
```

Call `app.enableShutdownHooks()` and give the process enough termination time
for Colyseus to drain rooms.

## Nginx

The proxy must preserve WebSocket upgrade headers and allow long-lived reads:

```nginx
location / {
  proxy_pass http://colyseus_backend;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400s;
  proxy_send_timeout 86400s;
}
```

## Redis

All game-server processes and the standalone matchmaker must use the same Redis
endpoint, `RedisPresence`, `RedisDriver`, and room names. Use TLS and an
authenticated endpoint in production; do not commit the URL or credentials.
