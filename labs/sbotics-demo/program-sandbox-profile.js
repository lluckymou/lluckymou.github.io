// Versioned limits for local, nonjudged Program execution in IMP-UX.03.
// Keep the protocol, worker, simulator queue and user-visible output budgets aligned.
export const PROGRAM_SANDBOX_PROFILE_V1 = Object.freeze({
  id: "local-program-sandbox-v1",
  protocolVersion: 1,
  workerMessagesPerSecond: 100,
  hostMessagesPerSecond: 200,
  maxMessageBytes: 524_288,
  maxProgramModuleBytes: 1_048_576,
  maxPendingRequests: 32,
  maxQueuedComponentCommands: 128,
  maxCameraResultBytes: 128 * 128 * 4,
  cameraCaptureRetryIntervalMs: 100,
  cameraCaptureRetryLimit: 50,
  cameraRequestTimeoutMs: 15_000,
  maxWaitSimulationMs: 3_600_000,
  maxConsoleLines: 2_500,
  maxConsoleUtf8Bytes: 524_288,
  maxConsoleMessagesPerSecond: 100,
  maxConsoleEntryBytes: 16_384,
  sandboxReadyTimeoutMs: 10_000,
  programStartTimeoutMs: 15_000,
  heartbeatIntervalMs: 1_000,
  heartbeatTimeoutMs: 10_000,
  noProgressTimeoutMs: 30_000,
  watchdogCheckIntervalMs: 500
});
