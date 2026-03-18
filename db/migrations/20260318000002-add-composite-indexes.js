'use strict';

// Composite indexes for the most frequent multi-column query patterns on tasks.
// Individual single-column indexes already exist; these covering indexes eliminate
// table lookups for common filter combinations used by the task list and due-soon job.

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(
      'tasks',
      ['project_id', 'status', 'is_deleted'],
      { name: 'tasks_project_status_deleted_idx' }
    );

    await queryInterface.addIndex(
      'tasks',
      ['assignee_id', 'status', 'is_deleted'],
      { name: 'tasks_assignee_status_deleted_idx' }
    );

    // Used by the due-soon cron job: due_date BETWEEN + status != done + is_deleted = false
    await queryInterface.addIndex(
      'tasks',
      ['due_date', 'status', 'is_deleted'],
      { name: 'tasks_due_status_deleted_idx' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tasks', 'tasks_project_status_deleted_idx');
    await queryInterface.removeIndex('tasks', 'tasks_assignee_status_deleted_idx');
    await queryInterface.removeIndex('tasks', 'tasks_due_status_deleted_idx');
  },
};
