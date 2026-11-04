# Arcade Physics Branch

This branch builds the **Arcade** test APK with the shared rendering and UI fixes and gentler forces, stronger horizontal damping, softer collision boxes, and slower fall speed. The workflow runs `python3 tools/apply_variant.py arcade` before Gradle. Package ID: `com.nillfrost.magnetmadness.arcade`. Both builds can coexist on Android.

The `classic` branch runs `python3 tools/apply_variant.py classic` and keeps the original physics. Debug APKs are published as separate GitHub Releases.
