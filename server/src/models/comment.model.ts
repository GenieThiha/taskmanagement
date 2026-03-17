import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  Sequelize,
} from 'sequelize';
import { Task } from './task.model';
import { User } from './user.model';

export class Comment extends Model<
  InferAttributes<Comment>,
  InferCreationAttributes<Comment>
> {
  declare id: CreationOptional<string>;
  declare task_id: ForeignKey<Task['id']>;
  declare author_id: ForeignKey<User['id']>;
  declare body: string;
  declare is_deleted: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof Comment {
    Comment.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        task_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'tasks', key: 'id' },
        },
        author_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        body: {
          type: DataTypes.TEXT,
          allowNull: false,
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
        tableName: 'comments',
        underscored: true,
      }
    );
    return Comment;
  }
}
