import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  Sequelize,
} from 'sequelize';
import { Project } from './project.model';
import { User } from './user.model';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export class Task extends Model<
  InferAttributes<Task>,
  InferCreationAttributes<Task>
> {
  declare id: CreationOptional<string>;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare project_id: ForeignKey<Project['id']>;
  declare assignee_id: CreationOptional<ForeignKey<User['id']> | null>;
  declare reporter_id: ForeignKey<User['id']>;
  declare status: CreationOptional<TaskStatus>;
  declare priority: CreationOptional<TaskPriority>;
  declare due_date: CreationOptional<Date | null>;
  declare is_deleted: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof Task {
    Task.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        title: {
          type: DataTypes.STRING(300),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        project_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'projects', key: 'id' },
        },
        assignee_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
        },
        reporter_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        status: {
          type: DataTypes.ENUM('todo', 'in_progress', 'review', 'done'),
          defaultValue: 'todo',
          allowNull: false,
        },
        priority: {
          type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
          defaultValue: 'medium',
          allowNull: false,
        },
        due_date: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        is_deleted: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: 'tasks',
        underscored: true,
      }
    );
    return Task;
  }
}
