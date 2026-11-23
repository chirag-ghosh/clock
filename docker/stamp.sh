#!/bin/sh
# Cache-busting: append ?v=<content hash> to every asset URL (the stylesheet, the
# entry script and each relative ES-module import). A deploy with changed files
# gets new URLs, so no browser or CDN cache can serve stale CSS/JS next to new HTML.
set -eu
cd "${1:-/usr/share/nginx/html}"
V=$(find . -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) | sort | xargs cat | sha256sum | cut -c1-10)
sed -i "s#href=\"styles.css\"#href=\"styles.css?v=$V\"#; s#src=\"js/main.js\"#src=\"js/main.js?v=$V\"#" index.html
find js -name '*.js' -exec sed -i -E "s#(from '\.\.?/[^']+\.js)'#\1?v=$V'#g" {} +
grep -q "styles.css?v=$V" index.html && grep -q "main.js?v=$V" index.html
echo "assets stamped with v=$V"
