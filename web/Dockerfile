FROM nginxinc/nginx-unprivileged:stable-alpine
COPY --chown=101:101 index.html /usr/share/nginx/html/index.html
COPY --chown=101:101 style.css /usr/share/nginx/html/style.css
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
