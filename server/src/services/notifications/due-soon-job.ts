import cron from 'node-cron';
import { Op } from 'sequelize';
import { Task } from '../../models/task.model';
import { notify } from './notification-service';
import { logger } from '../../logger/logger';

export function startDueSoonJob(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    logger.info('Running due-soon notification job');

    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const tasks = await Task.findAll({
        where: {
          due_date: {
            [Op.between]: [now, in24h],
          },
          status: { [Op.ne]: 'done' },
          is_deleted: false,
          assignee_id: { [Op.ne]: null },
        },
      });

      logger.info(`Found ${tasks.length} tasks due soon`);

      for (const task of tasks) {
        if (task.assignee_id) {
          await notify(
            'task_due_soon',
            task.id,
            'task',
            [task.assignee_id],
            `Task "${task.title}" is due within 24 hours`
          );
        }
      }
    } catch (err) {
      logger.error('Due-soon job error', { err });
    }
  });

  logger.info('Due-soon notification job scheduled (every hour)');
}
