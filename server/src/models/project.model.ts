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

export type ProjectStatus = 'active' | 'archived' | 'completed';

export class Project extends Model<
  InferAttributes<Project>,
  InferCreationAttributes<Project>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare description: CreationOptional<string | null>;
  declare owner_id: ForeignKey<User['id']>;
  declare status: CreationOptional<ProjectStatus>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof Project {
    Project.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        owner_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        status: {
          type: DataTypes.ENUM('active', 'archived', 'completed'),
          defaultValue: 'active',
          allowNull: false,
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: 'projects',
        underscored: true,
      }
    );
    return Project;
  }
}
