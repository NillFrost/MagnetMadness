# Magnet Madness v3.12.1 — Android

This repository contains the actual HTML5 game plus a Java WebView wrapper. It builds an **installable, debug-signed APK** through GitHub Actions. All game assets are bundled offline.

## Download APK

After the [Build Magnet Madness APK](https://github.com/NillFrost/MagnetMadness/actions/workflows/build-apk.yml) workflow succeeds, the APK is published to the GitHub prerelease:

[**MagnetMadness-v3.12.1-debug.apk**](https://github.com/NillFrost/MagnetMadness/releases/download/v3.12.1-android-debug/MagnetMadness-v3.12.1-debug.apk)

The workflow also uploads a private-to-GitHub Actions `.zip` artifact containing `app-debug.apk`.

## Build locally

Requires JDK 17, Gradle 8.13 and Android SDK 36.

```bash
gradle --no-daemon :app:assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`.

## Notes

- Package: `com.nillfrost.magnetmadness`.
- Supported OS: Android 7.0+ (min API 24).
- Offline portrait immersive fullscreen; game progress is stored locally in WebView.
- Includes Orbit, Overdrive, Shatter, cosmetics, daily challenges and pause countdown.
- **This is a debug APK, not a signed Google Play release.**
- **Rewarded advertising is not integrated** with an actual ad SDK; revival behind a rewarded advertisement is unavailable in this build.
