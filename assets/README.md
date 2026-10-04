# Native app artwork

- **`icon.png`** — 1024×1024 launcher source (generated from `public/musicpromo-ai-icon.svg`).
- **`splash.png`** — splash screen source (defaults to same as icon).

Regenerate after SVG changes:

```bash
node scripts/generate-app-icon.mjs
cp assets/icon.png assets/splash.png   # if you want splash to match
npx @capacitor/assets generate --android
```

CI runs `scripts/apply-android-branding.sh` after each Android build.
