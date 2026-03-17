'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize
      .query(`CREATE TYPE "enum_tasks_status" AS ENUM ('todo', 'in_progress', 'review', 'done')`)
      .catch(() => {});

    await queryInterface.sequelize
      .query(`CREATE TYPE "enum_tasks_priority" AS ENUM ('low', 'medium', 'high', 'critical')`)
      .catch(() => {});

    await queryInterface.createTable('tasks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'projects',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      assignee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reporter_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.ENUM('todo', 'in_progress', 'review', 'done'),
        defaultValue: 'todo',
        allowNull: false,
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium',
        allowNull: false,
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('tasks', ['project_id']);
    await queryInterface.addIndex('tasks', ['assignee_id']);
    await queryInterface.addIndex('tasks', ['reporter_id']);
    await queryInterface.addIndex('tasks', ['status']);
    await queryInterface.addIndex('tasks', ['is_deleted']);
    await queryInterface.addIndex('tasks', ['due_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tasks_priority"');
  },
};
