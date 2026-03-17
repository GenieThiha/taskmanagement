'use strict';

const USER_IDS = {
  admin:   'aaaaaaaa-0000-4000-a000-000000000001',
  manager1: 'bbbbbbbb-0000-4000-a000-000000000002',
  manager2: 'cccccccc-0000-4000-a000-000000000003',
  member1: 'dddddddd-0000-4000-a000-000000000004',
  member2: 'eeeeeeee-0000-4000-a000-000000000005',
  member3: 'ffffffff-0000-4000-a000-000000000006',
};

const TASK_IDS = {
  t1: 'aaaaaaaa-1111-4000-a000-000000000001',
  t2: 'aaaaaaaa-1111-4000-a000-000000000002',
  t5: 'aaaaaaaa-1111-4000-a000-000000000005',
  t6: 'aaaaaaaa-1111-4000-a000-000000000006',
  t7: 'aaaaaaaa-1111-4000-a000-000000000007',
  t8: 'aaaaaaaa-1111-4000-a000-000000000008',
};

const COMMENT_IDS = {
  c3: 'bbbbbbbb-2222-4000-a000-000000000003',
  c4: 'bbbbbbbb-2222-4000-a000-000000000004',
  c5: 'bbbbbbbb-2222-4000-a000-000000000005',
  c6: 'bbbbbbbb-2222-4000-a000-000000000006',
};

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('notifications', [
      // Admin notifications
      {
        id: 'cccccccc-3333-4000-a000-000000000007',
        recipient_id: USER_IDS.admin,
        type: 'task_assigned',
        reference_id: TASK_IDS.t1,
        reference_type: 'task',
        message: 'David Member has been assigned to "Design homepage wireframes".',
        is_read: true,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000008',
        recipient_id: USER_IDS.admin,
        type: 'task_updated',
        reference_id: TASK_IDS.t5,
        reference_type: 'task',
        message: 'Task "Set up JWT auth middleware" status changed to done.',
        is_read: true,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000009',
        recipient_id: USER_IDS.admin,
        type: 'task_due_soon',
        reference_id: TASK_IDS.t2,
        reference_type: 'task',
        message: 'Task "Implement responsive navigation" is due soon.',
        is_read: false,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000010',
        recipient_id: USER_IDS.admin,
        type: 'task_due_soon',
        reference_id: TASK_IDS.t6,
        reference_type: 'task',
        message: 'Task "Implement /tasks CRUD endpoints" is due soon.',
        is_read: false,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000011',
        recipient_id: USER_IDS.admin,
        type: 'task_commented',
        reference_id: COMMENT_IDS.c5,
        reference_type: 'comment',
        message: 'Frank Member commented on "Set up JWT auth middleware".',
        is_read: false,
        created_at: now,
      },
      // Manager1 notifications
      {
        id: 'cccccccc-3333-4000-a000-000000000012',
        recipient_id: USER_IDS.manager1,
        type: 'task_updated',
        reference_id: TASK_IDS.t1,
        reference_type: 'task',
        message: 'Task "Design homepage wireframes" status changed to done.',
        is_read: true,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000013',
        recipient_id: USER_IDS.manager1,
        type: 'task_commented',
        reference_id: COMMENT_IDS.c3,
        reference_type: 'comment',
        message: 'David Member commented on "Implement responsive navigation".',
        is_read: false,
        created_at: now,
      },
      // Manager2 notifications
      {
        id: 'cccccccc-3333-4000-a000-000000000014',
        recipient_id: USER_IDS.manager2,
        type: 'task_updated',
        reference_id: TASK_IDS.t5,
        reference_type: 'task',
        message: 'Task "Set up JWT auth middleware" status changed to done.',
        is_read: true,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000015',
        recipient_id: USER_IDS.manager2,
        type: 'task_commented',
        reference_id: COMMENT_IDS.c6,
        reference_type: 'comment',
        message: 'Frank Member commented on "Implement /tasks CRUD endpoints".',
        is_read: false,
        created_at: now,
      },
      // Member notifications
      {
        id: 'cccccccc-3333-4000-a000-000000000001',
        recipient_id: USER_IDS.member1,
        type: 'task_assigned',
        reference_id: TASK_IDS.t7,
        reference_type: 'task',
        message: 'You have been assigned to "Add Redis-backed rate limiting".',
        is_read: false,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000002',
        recipient_id: USER_IDS.member1,
        type: 'task_due_soon',
        reference_id: TASK_IDS.t2,
        reference_type: 'task',
        message: 'Task "Implement responsive navigation" is due soon.',
        is_read: false,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000003',
        recipient_id: USER_IDS.member1,
        type: 'task_commented',
        reference_id: COMMENT_IDS.c4,
        reference_type: 'comment',
        message: 'Bob Manager commented on "Implement responsive navigation".',
        is_read: true,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000004',
        recipient_id: USER_IDS.member2,
        type: 'task_assigned',
        reference_id: TASK_IDS.t8,
        reference_type: 'task',
        message: 'You have been assigned to "Write integration tests for auth flow".',
        is_read: false,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000005',
        recipient_id: USER_IDS.member3,
        type: 'task_due_soon',
        reference_id: TASK_IDS.t6,
        reference_type: 'task',
        message: 'Task "Implement /tasks CRUD endpoints" is due soon.',
        is_read: false,
        created_at: now,
      },
      {
        id: 'cccccccc-3333-4000-a000-000000000006',
        recipient_id: USER_IDS.member3,
        type: 'task_commented',
        reference_id: COMMENT_IDS.c6,
        reference_type: 'comment',
        message: 'Frank Member commented on "Implement /tasks CRUD endpoints".',
        is_read: true,
        created_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('notifications', {
      id: [
        'cccccccc-3333-4000-a000-000000000001',
        'cccccccc-3333-4000-a000-000000000002',
        'cccccccc-3333-4000-a000-000000000003',
        'cccccccc-3333-4000-a000-000000000004',
        'cccccccc-3333-4000-a000-000000000005',
        'cccccccc-3333-4000-a000-000000000006',
        'cccccccc-3333-4000-a000-000000000007',
        'cccccccc-3333-4000-a000-000000000008',
        'cccccccc-3333-4000-a000-000000000009',
        'cccccccc-3333-4000-a000-000000000010',
        'cccccccc-3333-4000-a000-000000000011',
        'cccccccc-3333-4000-a000-000000000012',
        'cccccccc-3333-4000-a000-000000000013',
        'cccccccc-3333-4000-a000-000000000014',
        'cccccccc-3333-4000-a000-000000000015',
      ],
    });
  },
};
