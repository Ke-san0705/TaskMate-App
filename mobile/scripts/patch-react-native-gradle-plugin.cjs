const fs = require("fs");
const path = require("path");

const settingsPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-native",
  "gradle-plugin",
  "settings.gradle.kts",
);

const oldSnippet =
  'id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")';
const newSnippet =
  'id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")';

if (!fs.existsSync(settingsPath)) {
  console.warn(
    "[TaskMate Mobile] React Native Gradle plugin settings were not found; skipping Gradle 9 Foojay patch.",
  );
  process.exit(0);
}

const source = fs.readFileSync(settingsPath, "utf8");

if (source.includes(newSnippet)) {
  console.log("[TaskMate Mobile] Gradle 9 Foojay patch is already applied.");
  process.exit(0);
}

if (!source.includes(oldSnippet)) {
  console.warn(
    "[TaskMate Mobile] Expected Foojay plugin version was not found; React Native may have changed its Gradle plugin template.",
  );
  process.exit(0);
}

fs.writeFileSync(settingsPath, source.replace(oldSnippet, newSnippet));
console.log("[TaskMate Mobile] Patched React Native Foojay resolver for Gradle 9.");
