import cron from 'node-cron';
import { Op } from 'sequelize';
import { Task } from '../../models/task.model';
import { redisClient } from '../../config/redis';
import { notify } from './notification-service';
import { logger } from '../../logger/logger';

// TTL for the dedup key: 25 hours so a task that is due in exactly 24 hours
// only ever triggers one notification, even across consecutive hourly runs.
const DEDUP_TTL_SECONDS = 25 * 60 * 60;

export function startDueSoonJob(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
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

      for (const task of tasks) {
        if (!task.assignee_id) continue;

        // Guard against duplicate notifications across hourly runs.
        // NX = only set if key does not already exist.
        const dedupKey = `notified_due_soon:${task.id}`;
        const set = await redisClient.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
        if (!set) {
          // Already notified within the dedup window — skip.
          continue;
        }

        await notify(
          'task_due_soon',
          task.id,
          'task',
          [task.assignee_id],
          `Task "${task.title}" is due within 24 hours`
        );
      }
    } catch (err) {
      logger.error('Due-soon job error', { err });
    }
  });

  logger.info('Due-soon notification job scheduled (every hour)');
}
