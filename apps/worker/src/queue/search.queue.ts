import { Queue, Worker, Job, JobsOptions } from "bullmq";
import { Redis } from "ioredis";

export const SEARCH_QUEUE_NAME = "radar-search-targets";

export interface SearchJobData {
  targetId: string;
  triggerSource: "scheduler" | "api" | "manual";
  timestamp: string;
}

export interface QueueConfig {
  redisUrl?: string;
  redisOptions?: any;
  connection?: any;
}

export class SearchTargetQueue {
  private queue: Queue<SearchJobData>;
  private connection: Redis;

  constructor(config: QueueConfig = {}) {
    if (config.connection) {
      this.connection = config.connection;
    } else {
      const url = config.redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
      this.connection = new Redis(url, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: () => null,
        ...(config.redisOptions || {}),
      });
      this.connection.on("error", () => {});
    }

    this.queue = new Queue<SearchJobData>(SEARCH_QUEUE_NAME, {
      connection: this.connection,
    });
  }

  /**
   * Enqueues a SearchTarget for asynchronous background processing
   */
  async addTargetJob(
    targetId: string,
    triggerSource: "scheduler" | "api" | "manual" = "manual",
    jobOptions: JobsOptions = {}
  ): Promise<Job<SearchJobData>> {
    return this.queue.add(
      `sweep-${targetId}`,
      {
        targetId,
        triggerSource,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
        ...jobOptions,
      }
    );
  }

  getBullQueue(): Queue<SearchJobData> {
    return this.queue;
  }

  async close(): Promise<void> {
    try {
      await this.queue.close();
      if (this.connection.status !== "end") {
        this.connection.disconnect();
      }
    } catch {
      // Ignored during shutdown
    }
  }
}

export function createSearchWorker(
  processor: (job: Job<SearchJobData>) => Promise<any>,
  config: QueueConfig = {},
  concurrency: number = 2
): Worker<SearchJobData> {
  const connection =
    config.connection ??
    new Redis(config.redisUrl || process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
      ...(config.redisOptions || {}),
    });

  connection.on("error", () => {});

  return new Worker<SearchJobData>(SEARCH_QUEUE_NAME, processor, {
    connection,
    concurrency,
  });
}
