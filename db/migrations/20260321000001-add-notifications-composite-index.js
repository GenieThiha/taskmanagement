'use strict';

// Adds the composite index required by the primary notifications query:
// GET /notifications returns unread-first, ordered by created_at DESC, per recipient.
// Without this covering index PostgreSQL falls back to three separate single-column
// index scans, which is significantly slower at scale.
//
// Spec reference: data-model.md — notifications indexes table.

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(
      'notifications',
      ['recipient_id', 'is_read', 'created_at'],
      { name: 'notifications_recipient_read_created_idx' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'notifications',
      'notifications_recipient_read_created_idx'
    );
  },
};
