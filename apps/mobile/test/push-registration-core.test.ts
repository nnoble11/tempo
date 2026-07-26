import { describe, expect, it, vi } from "vitest";

import {
  registerPushEndpointWith,
  type PushRegistrationDependencies,
} from "../src/features/delivery/push-registration-core";

const dependencies = (
  overrides: Partial<PushRegistrationDependencies> = {},
): PushRegistrationDependencies => ({
  supported: true,
  projectId: "test-project",
  getPermissionStatus: vi.fn().mockResolvedValue("granted"),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  getToken: vi.fn().mockResolvedValue("ExpoPushToken[test-device]"),
  upsert: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("push registration", () => {
  it("upserts a fresh token when permission is already granted", async () => {
    const inputs = dependencies();

    await expect(registerPushEndpointWith(inputs)).resolves.toBe("registered");
    expect(inputs.requestPermission).not.toHaveBeenCalled();
    expect(inputs.getToken).toHaveBeenCalledWith("test-project");
    expect(inputs.upsert).toHaveBeenCalledWith("ExpoPushToken[test-device]");
  });

  it("requests permission and does not fetch a token when denied", async () => {
    const inputs = dependencies({
      getPermissionStatus: vi.fn().mockResolvedValue("undetermined"),
      requestPermission: vi.fn().mockResolvedValue("denied"),
    });

    await expect(registerPushEndpointWith(inputs)).resolves.toBe(
      "permission_denied",
    );
    expect(inputs.getToken).not.toHaveBeenCalled();
    expect(inputs.upsert).not.toHaveBeenCalled();
  });

  it("does not access native services on unsupported devices", async () => {
    const inputs = dependencies({ supported: false });

    await expect(registerPushEndpointWith(inputs)).resolves.toBe("unsupported");
    expect(inputs.getPermissionStatus).not.toHaveBeenCalled();
  });
});
