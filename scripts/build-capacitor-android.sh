#!/usr/bin/env bash
# Build Capacitor Android APK/AAB in CI or locally (requires Android SDK + JDK 17).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VARIANT="${ANDROID_BUILD_VARIANT:-debug}"
if [[ "$VARIANT" != "debug" && "$VARIANT" != "release" ]]; then
  echo "ANDROID_BUILD_VARIANT must be debug or release (got: $VARIANT)"
  exit 1
fi

if [[ -z "${VITE_SUPABASE_URL:-}" || -z "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  exit 1
fi

GS_JSON="${GOOGLE_SERVICES_JSON_PATH:-$ROOT/android/app/google-services.json}"
if [[ ! -f "$GS_JSON" ]]; then
  echo "Missing google-services.json at $GS_JSON (set GOOGLE_SERVICES_JSON_PATH or write android/app/google-services.json)"
  exit 1
fi

echo ">> npm ci"
npm ci

echo ">> vite build"
npm run build

if [[ -d android ]]; then
  echo ">> removing existing android/ (fresh cap add)"
  rm -rf android
fi

echo ">> cap add android"
npx cap add android

mkdir -p android/app
cp "$GS_JSON" android/app/google-services.json

echo ">> cap sync android"
npx cap sync android

echo ">> launcher icon, splash, app category"
chmod +x scripts/apply-android-branding.sh
scripts/apply-android-branding.sh

if [[ -n "${ANDROID_VERSION_CODE:-}" ]]; then
  sed -i "s/versionCode [0-9]*/versionCode ${ANDROID_VERSION_CODE}/" android/app/build.gradle
fi
if [[ -n "${ANDROID_VERSION_NAME:-}" ]]; then
  sed -i "s/versionName \"[^\"]*\"/versionName \"${ANDROID_VERSION_NAME}\"/" android/app/build.gradle
fi

if [[ "$VARIANT" == "release" ]]; then
  if [[ -z "${ANDROID_KEYSTORE_PATH:-}" || ! -f "${ANDROID_KEYSTORE_PATH}" ]]; then
    echo "Release build requires ANDROID_KEYSTORE_PATH pointing to an existing keystore file"
    exit 1
  fi
  for v in ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
    if [[ -z "${!v:-}" ]]; then
      echo "Release build requires $v"
      exit 1
    fi
  done
  cp "$ROOT/scripts/android-ci-release-signing.gradle" android/app/ci-release-signing.gradle
  if ! grep -q "ci-release-signing.gradle" android/app/build.gradle; then
    echo "apply from: 'ci-release-signing.gradle'" >> android/app/build.gradle
  fi
fi

SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -n "$SDK_DIR" && -d "$SDK_DIR" ]]; then
  printf 'sdk.dir=%s\n' "$SDK_DIR" > android/local.properties
fi

cd android
chmod +x gradlew

if [[ "$VARIANT" == "debug" ]]; then
  echo ">> assembleDebug"
  ./gradlew assembleDebug --no-daemon
  OUT="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
else
  echo ">> bundleRelease"
  ./gradlew bundleRelease --no-daemon
  OUT="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
fi

echo "BUILD_OUTPUT=$OUT"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  KS="${HOME}/.android/debug.keystore"
  if [[ -f "$KS" ]]; then
    FP="$(keytool -list -v -keystore "$KS" -storepass android -alias androiddebugkey 2>/dev/null | awk -F': ' '/SHA256:/ {print $2; exit}' | tr -d '[:space:]')"
    if [[ -n "$FP" ]]; then
      {
        echo "### Android App Links (Google sign-in return to app)"
        echo ""
        echo "Copy this **SHA-256** into \`public/.well-known/assetlinks.json\`, commit, merge, wait for Deploy, then rebuild the APK:"
        echo ""
        echo "\`$FP\`"
        echo ""
        echo "See \`docs/android-assetlinks.example.json\`."
      } >> "$GITHUB_STEP_SUMMARY"
    fi
  fi
fi
