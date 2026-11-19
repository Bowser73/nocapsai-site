#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Keep the readable sources alongside the files served by GitHub Pages.
for src in assets/{page-base,site-fx,site-header,site-nav,site-theme,storefront}.css \
           assets/js/{newsletter,site-fx,site-nav,storefront}.js; do
  "${ESBUILD:-esbuild}" "$src" --minify --legal-comments=inline --outfile="${src%.*}.min.${src##*.}"
done
