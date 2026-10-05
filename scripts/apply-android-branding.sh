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
  SERVER_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}"
  if [[ -n "$SERVER_CLIENT_ID" ]]; then
    if grep -q 'name="server_client_id"' "$STRINGS"; then
      sed -i "s|<string name=\"server_client_id\">.*</string>|<string name=\"server_client_id\">${SERVER_CLIENT_ID}</string>|" "$STRINGS"
    else
      sed -i "s|</resources>|  <string name=\"server_client_id\">${SERVER_CLIENT_ID}</string>\n</resources>|" "$STRINGS"
    fi
  fi
fi

MANIFEST=android/app/src/main/AndroidManifest.xml
if ! grep -q 'pathPrefix="/auth"' "$MANIFEST"; then
  echo ">> Android App Links intent filter (/auth/*)"
  python3 << 'PY'
from pathlib import Path
path = Path("android/app/src/main/AndroidManifest.xml")
text = path.read_text()
block = """
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="musicpromoai.site" android:pathPrefix="/auth" />
            </intent-filter>
"""
needle = '<intent-filter>\n                <action android:name="android.intent.action.MAIN" />'
if needle not in text:
    raise SystemExit("Could not patch AndroidManifest.xml for App Links")
path.write_text(text.replace(needle, block + needle, 1))
PY
fi

echo ">> Android branding applied (category=${APP_CATEGORY})"
