export async function waitForRobotModelJobs(jobs, timeoutMs) {
  const pending = jobs.filter((job) => job.status === "loading");
  if (!pending.length) return "settled";
  let timeoutHandle;
  try {
    return await Promise.race([
      Promise.all(pending.map((job) => job.promise)).then(() => "settled"),
      new Promise((resolve) => { timeoutHandle = globalThis.setTimeout(() => resolve("timeout"), Math.max(0, Number(timeoutMs) || 0)); })
    ]);
  } finally {
    if (timeoutHandle !== undefined) globalThis.clearTimeout(timeoutHandle);
  }
}
