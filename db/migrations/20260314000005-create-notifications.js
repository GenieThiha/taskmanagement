'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize
      .query(
        `CREATE TYPE "enum_notifications_type" AS ENUM ('task_assigned', 'task_updated', 'task_commented', 'task_due_soon')`
      )
      .catch(() => {});

    await queryInterface.sequelize
      .query(
        `CREATE TYPE "enum_notifications_reference_type" AS ENUM ('task', 'comment')`
      )
      .catch(() => {});

    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      recipient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM(
          'task_assigned',
          'task_updated',
          'task_commented',
          'task_due_soon'
        ),
        allowNull: false,
      },
      reference_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      reference_type: {
        type: Sequelize.ENUM('task', 'comment'),
        allowNull: false,
      },
      message: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('notifications', ['recipient_id']);
    await queryInterface.addIndex('notifications', ['is_read']);
    await queryInterface.addIndex('notifications', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_notifications_type"'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_notifications_reference_type"'
    );
  },
};
