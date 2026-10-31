import { fileURLToPath } from "node:url";
import { prisma as defaultPrisma, SearchTarget } from "@radar/database";
import { WorkerPipeline } from "./pipeline.js";

/**
 * Checks whether a SearchTarget is overdue for execution based on its intervalMinutes.
 * A target is due if:
 * 1. active is true
 * 2. lastRunAt is null/undefined (never executed)
 * 3. lastRunAt + intervalMinutes * 60 * 1000 <= now
 */
export function isTargetDue(
  target: { active: boolean; intervalMinutes?: number | null; lastRunAt?: Date | null },
  now: Date = new Date()
): boolean {
  if (!target.active) {
    return false;
  }

  if (!target.lastRunAt) {
    return true;
  }

  const intervalMinutes =
    typeof target.intervalMinutes === "number" && target.intervalMinutes > 0
      ? target.intervalMinutes
      : 60;

  const dueTime = new Date(target.lastRunAt).getTime() + intervalMinutes * 60 * 1000;
  return dueTime <= now.getTime();
}

export interface SchedulerDependencies {
  prisma?: any;
  pipeline?: Partial<Pick<WorkerPipeline, "init" | "close" | "processTarget" | "getActiveTargets">>;
  checkIntervalMs?: number;
  minHumanDelayMs?: number;
  maxHumanDelayMs?: number;
  headless?: boolean;
}

export class SweepScheduler {
  private prisma: any;
  private pipeline: Partial<Pick<WorkerPipeline, "init" | "close" | "processTarget" | "getActiveTargets">>;
  private checkIntervalMs: number;
  private minHumanDelayMs: number;
  private maxHumanDelayMs: number;
  private headless: boolean;

  private isRunning: boolean = false;
  private stopRequested: boolean = false;
  private currentTimeout: NodeJS.Timeout | null = null;
  private sleepResolve: (() => void) | null = null;
  private sigintListener: (() => void) | null = null;
  private sigtermListener: (() => void) | null = null;

  constructor(deps: SchedulerDependencies = {}) {
    this.prisma = deps.prisma ?? defaultPrisma;
    this.pipeline = deps.pipeline ?? new WorkerPipeline({ prisma: this.prisma });
    this.checkIntervalMs =
      deps.checkIntervalMs ??
      parseInt(process.env.SCHEDULER_CHECK_INTERVAL_MS || "30000", 10);
    this.minHumanDelayMs =
      deps.minHumanDelayMs ??
      parseInt(process.env.HUMAN_DELAY_MIN_MS || "2000", 10);
    this.maxHumanDelayMs =
      deps.maxHumanDelayMs ??
      parseInt(process.env.HUMAN_DELAY_MAX_MS || "5000", 10);
    this.headless = deps.headless ?? (process.env.HEADLESS !== "false");
  }

  /**
   * Retrieves all active SearchTargets whose scheduled run time has expired.
   * Targets that have never run (lastRunAt is null) are prioritized first,
   * followed by targets with the oldest due timestamp.
   */
  async getDueTargets(now: Date = new Date()): Promise<SearchTarget[]> {
    const activeTargets = await this.prisma.searchTarget.findMany({
      where: { active: true },
    });

    if (!activeTargets || activeTargets.length === 0) {
      return [];
    }

    const dueTargets = activeTargets.filter((target: SearchTarget) => isTargetDue(target, now));

    return dueTargets.sort((a: SearchTarget, b: SearchTarget) => {
      if (!a.lastRunAt && !b.lastRunAt) return 0;
      if (!a.lastRunAt) return -1;
      if (!b.lastRunAt) return 1;

      const aInterval = typeof a.intervalMinutes === "number" && a.intervalMinutes > 0 ? a.intervalMinutes : 60;
      const bInterval = typeof b.intervalMinutes === "number" && b.intervalMinutes > 0 ? b.intervalMinutes : 60;
      const aDue = new Date(a.lastRunAt).getTime() + aInterval * 60000;
      const bDue = new Date(b.lastRunAt).getTime() + bInterval * 60000;
      return aDue - bDue;
    });
  }

  /**
   * Calculates a randomized human-like delay between minHumanDelayMs and maxHumanDelayMs.
   */
  getRandomHumanDelay(): number {
    const min = Math.min(this.minHumanDelayMs, this.maxHumanDelayMs);
    const max = Math.max(this.minHumanDelayMs, this.maxHumanDelayMs);
    return Math.floor(min + Math.random() * (max - min));
  }

  /**
   * Interruptible sleep timer that immediately resolves when stop() is invoked.
   */
  async sleep(ms: number): Promise<void> {
    if (this.stopRequested) return;
    return new Promise((resolve) => {
      this.sleepResolve = resolve;
      this.currentTimeout = setTimeout(() => {
        this.sleepResolve = null;
        this.currentTimeout = null;
        resolve();
      }, ms);
    });
  }

  /**
   * Processes the queue of overdue SearchTargets sequentially:
   * - Executes processTarget for each overdue target.
   * - Records lastRunAt in database on completion.
   * - Respects human-like jitter delays between targets.
   * - Aborts cleanly if a shutdown was requested.
   */
  async processQueue(now: Date = new Date()): Promise<number> {
    const dueTargets = await this.getDueTargets(now);
    if (dueTargets.length === 0) {
      return 0;
    }

    console.log(`[Scheduler] 📋 Queue contains ${dueTargets.length} overdue SearchTarget(s).`);

    let processedCount = 0;
    for (let i = 0; i < dueTargets.length; i++) {
      if (this.stopRequested) {
        console.log("[Scheduler] 🛑 Stop requested. Aborting remaining queue items.");
        break;
      }

      const target = dueTargets[i];
      console.log(`\n[Scheduler] ⏳ [${i + 1}/${dueTargets.length}] Processing Target: "${target.name}" (ID: ${target.id})...`);

      try {
        if (this.pipeline.processTarget) {
          await this.pipeline.processTarget(target);
        }
        processedCount++;
      } catch (err) {
        console.error(`[Scheduler] ❌ Error processing target "${target.name}":`, err);
        // Ensure lastRunAt is updated on failure so it does not choke the queue in an immediate loop
        try {
          await this.prisma.searchTarget.update({
            where: { id: target.id },
            data: { lastRunAt: new Date() },
          });
        } catch {
          // Ignore secondary DB error
        }
      }

      // If more targets remain in queue and no stop requested, apply human jitter delay
      if (i < dueTargets.length - 1 && !this.stopRequested) {
        const jitter = this.getRandomHumanDelay();
        console.log(`[Scheduler] 💤 Human jitter delay: waiting ${(jitter / 1000).toFixed(1)}s before next target...`);
        await this.sleep(jitter);
      }
    }

    return processedCount;
  }

  /**
   * Starts the continuous daemon loop:
   * - Binds SIGINT and SIGTERM handlers for graceful shutdown.
   * - Initializes Playwright browser context once for continuous runs.
   * - Polls periodically for overdue SearchTargets.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stopRequested = false;

    console.log("==========================================");
    console.log("🕒 RADAR PRICE — Continuous Sweep Scheduler Daemon");
    console.log(`⏱️  Check interval: ${this.checkIntervalMs / 1000}s`);
    console.log(`⏱️  Human jitter delay: ${this.minHumanDelayMs / 1000}s - ${this.maxHumanDelayMs / 1000}s`);
    console.log("==========================================");

    const handleSignal = async (signal: string) => {
      console.log(`\n[Scheduler] 🔔 Caught ${signal}. Gracefully stopping daemon and Playwright...`);
      await this.stop();
      process.exit(0);
    };

    this.sigintListener = () => handleSignal("SIGINT");
    this.sigtermListener = () => handleSignal("SIGTERM");
    process.once("SIGINT", this.sigintListener);
    process.once("SIGTERM", this.sigtermListener);

    try {
      if (this.pipeline.init) {
        await this.pipeline.init(this.headless);
      }

      // Check for default target fallback if DB is empty
      if (this.pipeline.getActiveTargets) {
        await this.pipeline.getActiveTargets();
      }

      while (!this.stopRequested) {
        try {
          await this.processQueue();
        } catch (err) {
          console.error("[Scheduler] ❌ Error in sweep cycle:", err);
        }

        if (!this.stopRequested) {
          await this.sleep(this.checkIntervalMs);
        }
      }
    } finally {
      await this.stop();
    }
  }

  /**
   * Gracefully stops the scheduler daemon, unbinds signal listeners,
   * interrupts pending sleeps, and closes Playwright.
   */
  async stop(): Promise<void> {
    if (this.stopRequested && !this.isRunning) return;
    this.stopRequested = true;
    this.isRunning = false;

    if (this.sigintListener) {
      process.removeListener("SIGINT", this.sigintListener);
      this.sigintListener = null;
    }
    if (this.sigtermListener) {
      process.removeListener("SIGTERM", this.sigtermListener);
      this.sigtermListener = null;
    }

    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    if (this.sleepResolve) {
      this.sleepResolve();
      this.sleepResolve = null;
    }

    if (this.pipeline.close) {
      console.log("[Scheduler] 🧹 Closing Playwright browser context...");
      await this.pipeline.close();
    }
    console.log("[Scheduler] ✅ Scheduler stopped cleanly.");
  }
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

if (process.env.NODE_ENV !== "test" && isDirectExecution()) {
  const scheduler = new SweepScheduler();
  scheduler.start().catch((err) => {
    console.error("❌ Fatal error in SweepScheduler:", err);
    process.exit(1);
  });
}
