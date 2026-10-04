#!/usr/bin/env bash
# Launcher icon, splash, and manifest hints after `npx cap add/sync android`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d android/app ]]; then
  echo "apply-android-branding: android/ missing — run cap add android first"
  exit 1
fi

echo ">> generate app icon from SVG (if needed)"
if [[ ! -f assets/icon.png ]]; then
  node scripts/generate-app-icon.mjs
fi

if [[ ! -f assets/splash.png ]]; then
  cp assets/icon.png assets/splash.png
fi

echo ">> @capacitor/assets (Android mipmaps + splash)"
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#0c0a12' \
  --splashBackgroundColor '#0c0a12'

MANIFEST=android/app/src/main/AndroidManifest.xml
# social | audio | video | game | news | maps | productivity (Android app drawer hints)
APP_CATEGORY="${ANDROID_APP_CATEGORY:-social}"

if grep -q 'android:appCategory=' "$MANIFEST"; then
  sed -i "s/android:appCategory=\"[^\"]*\"/android:appCategory=\"${APP_CATEGORY}\"/" "$MANIFEST"
else
  sed -i "s/<application/<application android:appCategory=\"${APP_CATEGORY}\"/" "$MANIFEST"
fi

STRINGS=android/app/src/main/res/values/strings.xml
if [[ -f "$STRINGS" ]]; then
  sed -i 's/<string name="app_name">.*<\/string>/<string name="app_name">MusicPromo AI<\/string>/' "$STRINGS"
  sed -i 's/<string name="title_activity_main">.*<\/string>/<string name="title_activity_main">MusicPromo AI<\/string>/' "$STRINGS"
fi

echo ">> Android branding applied (category=${APP_CATEGORY})"
