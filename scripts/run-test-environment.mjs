import { spawn } from "node:child_process";

const children = new Set();
let stopping = false;
let interval;
let cycleRunning = false;

const start = (name, args, env = process.env) => {
  const child = spawn("pnpm", args, {
    env,
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", (code) => {
    children.delete(child);
    if (!stopping && code !== 0) {
      process.stderr.write(`${name} exited with code ${code ?? "unknown"}.\n`);
      stop(1);
    }
  });
  return child;
};

const runCycle = () => {
  if (cycleRunning) {
    process.stdout.write(
      "Skipping worker tick because the prior cycle is still running.\n",
    );
    return;
  }
  cycleRunning = true;
  const cycle = start("test worker cycle", [
    "--filter",
    "@tempo/intelligence-runner",
    "process",
  ]);
  cycle.once("exit", (code) => {
    if (code === 0 && !stopping) {
      const generation = start("briefing generation cycle", [
        "--filter",
        "@tempo/generation-runner",
        "generate",
      ]);
      generation.once("exit", () => {
        cycleRunning = false;
      });
    } else {
      cycleRunning = false;
    }
  });
};

const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  clearInterval(interval);
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500).unref();
};

start("Tempo API", ["dev:api"]);
start("Tempo web", ["dev:web"], { ...process.env, PORT: "3000" });
start("Tempo mobile", ["dev:mobile"]);
runCycle();
interval = setInterval(runCycle, 60_000);

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
