const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// react-native-gifted-charts reads Platform.constants.reactNativeVersion, which react-native-web lacks.
// Charts are native-only; the web build (dev preview) renders them as empty.
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-gifted-charts') {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'src/shims/gifted-charts.web.js') };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
