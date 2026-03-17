import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  Sequelize,
} from 'sequelize';
import { User } from './user.model';

export type NotificationType =
  | 'task_assigned'
  | 'task_updated'
  | 'task_commented'
  | 'task_due_soon';

export type NotificationReferenceType = 'task' | 'comment';

export class Notification extends Model<
  InferAttributes<Notification>,
  InferCreationAttributes<Notification>
> {
  declare id: CreationOptional<string>;
  declare recipient_id: ForeignKey<User['id']>;
  declare type: NotificationType;
  declare reference_id: string;
  declare reference_type: NotificationReferenceType;
  declare message: string;
  declare is_read: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof Notification {
    Notification.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        recipient_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        type: {
          type: DataTypes.ENUM(
            'task_assigned',
            'task_updated',
            'task_commented',
            'task_due_soon'
          ),
          allowNull: false,
        },
        reference_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        reference_type: {
          type: DataTypes.ENUM('task', 'comment'),
          allowNull: false,
        },
        message: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        is_read: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        created_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: 'notifications',
        underscored: true,
        updatedAt: false,
      }
    );
    return Notification;
  }
}
