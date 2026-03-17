import nodemailer from 'nodemailer';
import { Notification, NotificationType, NotificationReferenceType } from '../../models/notification.model';
import { User } from '../../models/user.model';
import { env } from '../../config/env';
import { logger } from '../../logger/logger';
import { getIo } from '../../socket/socket-server';

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

  // Send email notifications
  try {
    const recipients = await User.findAll({
      where: { id: recipientIds },
      attributes: ['email', 'full_name'],
    });

    const transporter = nodemailer.createTransport({
      host: `email-smtp.${env.SES_REGION}.amazonaws.com`,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SES_SMTP_USER,
        pass: process.env.SES_SMTP_PASS,
      },
    });

    await Promise.all(
      recipients.map((user) =>
        transporter.sendMail({
          from: env.SES_FROM,
          to: user.email,
          subject: `TMA Notification: ${type.replace(/_/g, ' ')}`,
          html: `<p>Hello ${user.full_name},</p><p>${message}</p>`,
        })
      )
    );
  } catch (err) {
    logger.warn('Email notification failed', { err });
  }
}

export async function getNotificationsForUser(userId: string) {
  const notifications = await Notification.findAll({
    where: { recipient_id: userId },
    order: [
      ['is_read', 'ASC'],
      ['created_at', 'DESC'],
    ],
    limit: 50,
  });

  const unread_count = notifications.filter((n) => !n.is_read).length;

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
