import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type TestPostgres = {
  connectionString: string;
  stop(): Promise<void>;
};

const findAvailablePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate a PostgreSQL test port."));
        return;
      }
      server.close((error) => {
        if (error === undefined) {
          resolve(address.port);
        } else {
          reject(error);
        }
      });
    });
  });

export const startTestPostgres = async (): Promise<TestPostgres> => {
  const configuredUrl = process.env.TEST_DATABASE_URL;
  if (configuredUrl !== undefined) {
    return {
      connectionString: configuredUrl,
      stop: async () => undefined,
    };
  }

  const dataDirectory = await mkdtemp(join(tmpdir(), "tempo-postgres-"));
  const port = await findAvailablePort();

  try {
    await execFileAsync("initdb", [
      "--auth=trust",
      "--encoding=UTF8",
      "--no-locale",
      "--username=postgres",
      `--pgdata=${dataDirectory}`,
    ]);
    await execFileAsync("pg_ctl", [
      `--pgdata=${dataDirectory}`,
      "start",
      "--wait",
      "--log",
      join(dataDirectory, "postgres.log"),
      "--options",
      `-F -p ${port} -h 127.0.0.1`,
    ]);
  } catch (error) {
    await rm(dataDirectory, { force: true, recursive: true });
    throw new Error(
      "Unable to start temporary PostgreSQL. Install PostgreSQL binaries or set TEST_DATABASE_URL.",
      { cause: error },
    );
  }

  let stopped = false;
  return {
    connectionString: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    stop: async () => {
      if (stopped) {
        return;
      }
      stopped = true;
      try {
        await execFileAsync("pg_ctl", [
          `--pgdata=${dataDirectory}`,
          "stop",
          "--wait",
          "--mode=fast",
        ]);
      } finally {
        await rm(dataDirectory, { force: true, recursive: true });
      }
    },
  };
};
