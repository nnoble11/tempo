export type PushRegistrationResult =
  "registered" | "unsupported" | "not_configured" | "permission_denied";

export type PushRegistrationDependencies = {
  supported: boolean;
  projectId: string | undefined;
  getPermissionStatus(): Promise<string>;
  requestPermission(): Promise<string>;
  getToken(projectId: string): Promise<string>;
  upsert(destination: string): Promise<void>;
};

export const registerPushEndpointWith = async (
  dependencies: PushRegistrationDependencies,
): Promise<PushRegistrationResult> => {
  if (!dependencies.supported) {
    return "unsupported";
  }
  if (
    dependencies.projectId === undefined ||
    dependencies.projectId.length === 0
  ) {
    return "not_configured";
  }

  const currentStatus = await dependencies.getPermissionStatus();
  const status =
    currentStatus === "granted"
      ? currentStatus
      : await dependencies.requestPermission();
  if (status !== "granted") {
    return "permission_denied";
  }

  const destination = await dependencies.getToken(dependencies.projectId);
  await dependencies.upsert(destination);
  return "registered";
};
