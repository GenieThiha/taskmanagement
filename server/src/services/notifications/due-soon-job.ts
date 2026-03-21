import cron from 'node-cron';
import { Op } from 'sequelize';
import pLimit from 'p-limit';
import { Task } from '../../models/task.model';
import { redisClient } from '../../config/redis';
import { notify } from './notification-service';
import { logger } from '../../logger/logger';

// TTL for the dedup key: 25 hours so a task that is due in exactly 24 hours
// only ever triggers one notification, even across consecutive hourly runs.
const DEDUP_TTL_SECONDS = 25 * 60 * 60;
// Distributed lock TTL: slightly shorter than the cron interval (55s < 60s)
// so the lock always expires before the next run on any instance.
const LOCK_TTL_SECONDS = 55;
const LOCK_KEY = 'due_soon_lock';

const limit = pLimit(10);

export function startDueSoonJob(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    // Distributed lock: only one EC2 instance should run this job per cycle.
    // NX = only set if the key does not exist. Returns null if another instance
    // already holds the lock.
    const acquired = await redisClient.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (!acquired) {
      logger.info('Due-soon job skipped — lock held by another instance');
      return;
    }

    logger.info('Running due-soon notification job');

    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const tasks = await Task.findAll({
        where: {
          due_date: { [Op.between]: [now, in24h] },
          status: { [Op.ne]: 'done' },
          is_deleted: false,
          assignee_id: { [Op.ne]: null },
        },
      });

      logger.info(`Found ${tasks.length} tasks due soon`);

      await Promise.all(
        tasks.map((task) =>
          limit(async () => {
            if (!task.assignee_id) return;

            // Guard against duplicate notifications across hourly runs.
            // NX = only set if key does not already exist.
            const dedupKey = `notified_due_soon:${task.id}`;
            const set = await redisClient.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
            if (!set) return; // Already notified within the dedup window

            await notify(
              'task_due_soon',
              task.id,
              'task',
              [task.assignee_id],
              `Task "${task.title}" is due within 24 hours`
            );
          })
        )
      );
    } catch (err) {
      logger.error('Due-soon job error', { err });
    }
  });

  logger.info('Due-soon notification job scheduled (every hour)');
}
