import { sequelize } from '../config/database';
import { User } from './user.model';
import { Project } from './project.model';
import { Task } from './task.model';
import { Comment } from './comment.model';
import { Notification } from './notification.model';

// Initialize models
User.initModel(sequelize);
Project.initModel(sequelize);
Task.initModel(sequelize);
Comment.initModel(sequelize);
Notification.initModel(sequelize);

// Associations
User.hasMany(Project, { foreignKey: 'owner_id', as: 'owned_projects' });
Project.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

User.hasMany(Task, { foreignKey: 'assignee_id', as: 'assigned_tasks' });
User.hasMany(Task, { foreignKey: 'reporter_id', as: 'reported_tasks' });
Task.belongsTo(User, { foreignKey: 'assignee_id', as: 'assignee' });
Task.belongsTo(User, { foreignKey: 'reporter_id', as: 'reporter' });

Project.hasMany(Task, { foreignKey: 'project_id', as: 'tasks' });
Task.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Task.hasMany(Comment, { foreignKey: 'task_id', as: 'comments' });
Comment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });

User.hasMany(Comment, { foreignKey: 'author_id', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'author_id', as: 'author' });

User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });

export { sequelize, User, Project, Task, Comment, Notification };
