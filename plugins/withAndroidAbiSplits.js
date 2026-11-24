const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// [NekoChat] Generate stripped arm64-v8a APK';

/**
 * Configures Android Gradle ABI splits so release builds emit both a stripped
 * `arm64-v8a` APK (modern devices, ~60% smaller) and a `universal` fallback APK.
 */
module.exports = function withAndroidAbiSplits(config) {
  return withAppBuildGradle(config, modConfig => {
    if (modConfig.modResults.language !== 'groovy') {
      return modConfig;
    }

    let contents = modConfig.modResults.contents;
    if (contents.includes(MARKER)) {
      return modConfig;
    }

    const androidAnchor = 'android {';
    if (!contents.includes(androidAnchor)) {
      throw new Error('withAndroidAbiSplits: Could not locate "android {" block in app/build.gradle');
    }

    const splitsBlock = `android {
    ${MARKER}
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a"
            universalApk true
        }
    }`;

    contents = contents.replace(androidAnchor, splitsBlock);
    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
