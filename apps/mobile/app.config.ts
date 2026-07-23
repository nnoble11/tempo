import type { ConfigContext, ExpoConfig } from "expo/config";

export const buildAppConfig = ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];

  if (process.env.TEMPO_ANDROID_USES_CLEARTEXT === "true") {
    plugins.push([
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ]);
  }

  return {
    ...config,
    plugins,
  };
};

export default buildAppConfig;
