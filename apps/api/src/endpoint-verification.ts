import { createHmac, randomInt } from "node:crypto";

export const createVerificationCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashVerificationCode = (secret: string, code: string): string =>
  createHmac("sha256", secret).update(code).digest("hex");
