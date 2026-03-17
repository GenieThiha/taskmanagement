import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Sequelize,
} from 'sequelize';

export type UserRole = 'admin' | 'manager' | 'member';

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare password_hash: string;
  declare full_name: string;
  declare role: CreationOptional<UserRole>;
  declare is_active: CreationOptional<boolean>;
  declare failed_login_attempts: CreationOptional<number>;
  declare locked_until: CreationOptional<Date | null>;
  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof User {
    User.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: true,
          validate: { isEmail: true },
        },
        password_hash: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        full_name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        role: {
          type: DataTypes.ENUM('admin', 'manager', 'member'),
          defaultValue: 'member',
          allowNull: false,
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          allowNull: false,
        },
        failed_login_attempts: {
          type: DataTypes.SMALLINT,
          defaultValue: 0,
          allowNull: false,
        },
        locked_until: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: 'users',
        underscored: true,
        defaultScope: {
          attributes: { exclude: ['password_hash'] },
        },
        scopes: {
          withPassword: {
            attributes: { include: ['password_hash'] },
          },
        },
      }
    );
    return User;
  }
}
