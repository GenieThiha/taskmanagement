import pLimit from 'p-limit';
import { Notification, NotificationType, NotificationReferenceType } from '../../models/notification.model';
import { User } from '../../models/user.model';
import { mailer } from '../../config/mailer';
import { env } from '../../config/env';
import { logger } from '../../logger/logger';
import { getIo } from '../../socket/socket-server';

const emailLimit = pLimit(10);

// Send emails detached from the main DB-write path so that slow or failing
// SMTP calls don't block or error-out task/project operations.
async function sendNotificationEmails(
  recipientIds: string[],
  type: NotificationType,
  message: string
): Promise<void> {
  const recipients = await User.findAll({
    where: { id: recipientIds },
    attributes: ['email', 'full_name'],
  });

  await Promise.all(
    recipients.map((user) =>
      emailLimit(() =>
        mailer.sendMail({
          from: env.SES_FROM,
          to: user.email,
          subject: `TMA Notification: ${type.replace(/_/g, ' ')}`,
          html: `<p>Hello ${user.full_name},</p><p>${message}</p>`,
        })
      )
    )
  );
}

export async function notify(
  type: NotificationType,
  referenceId: string,
  referenceType: NotificationReferenceType,
  recipientIds: string[],
  message: string
): Promise<void> {
  if (recipientIds.length === 0) return;

  // Insert notifications in bulk
  const rows = await Notification.bulkCreate(
    recipientIds.map((recipient_id) => ({
      recipient_id,
      type,
      reference_id: referenceId,
      reference_type: referenceType,
      message,
    }))
  );

  // Emit via Socket.io
  try {
    const io = getIo();
    for (const row of rows) {
      io.to(`user:${row.recipient_id}`).emit('notification:new', row.toJSON());
    }
  } catch (err) {
    logger.warn('Socket.io emit failed', { err });
  }

  // Fire-and-forget: email delivery is intentionally detached from this function
  // so that SMTP latency or failures don't propagate to the caller.
  sendNotificationEmails(recipientIds, type, message).catch((err) =>
    logger.warn('Email notification failed', { err })
  );
}

export async function getNotificationsForUser(userId: string) {
  // Run both queries in parallel: one for the rows, one for the accurate
  // unread count (counting in JS over a limited result set would be wrong
  // if the user has more unread notifications than the fetch limit).
  const [notifications, unread_count] = await Promise.all([
    Notification.findAll({
      where: { recipient_id: userId },
      order: [
        ['is_read', 'ASC'],
        ['created_at', 'DESC'],
      ],
      limit: 50,
    }),
    Notification.count({ where: { recipient_id: userId, is_read: false } }),
  ]);

  return { data: notifications, meta: { unread_count } };
}

export async function markAsRead(id: string, userId: string) {
  const notification = await Notification.findOne({
    where: { id, recipient_id: userId },
  });

  if (!notification) {
    const err = new Error('Notification not found');
    (err as any).status = 404;
    throw err;
  }

  await notification.update({ is_read: true });
  return notification;
}
