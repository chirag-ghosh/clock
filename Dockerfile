FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css /usr/share/nginx/html/
COPY js /usr/share/nginx/html/js
COPY docker/stamp.sh /tmp/stamp.sh
RUN sh /tmp/stamp.sh /usr/share/nginx/html && rm /tmp/stamp.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
