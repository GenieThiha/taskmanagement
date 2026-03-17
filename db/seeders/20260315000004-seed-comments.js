'use strict';

const COMMENT_IDS = {
  c1: 'bbbbbbbb-2222-4000-a000-000000000001',
  c2: 'bbbbbbbb-2222-4000-a000-000000000002',
  c3: 'bbbbbbbb-2222-4000-a000-000000000003',
  c4: 'bbbbbbbb-2222-4000-a000-000000000004',
  c5: 'bbbbbbbb-2222-4000-a000-000000000005',
  c6: 'bbbbbbbb-2222-4000-a000-000000000006',
};

const TASK_IDS = {
  t1: 'aaaaaaaa-1111-4000-a000-000000000001',
  t2: 'aaaaaaaa-1111-4000-a000-000000000002',
  t5: 'aaaaaaaa-1111-4000-a000-000000000005',
  t6: 'aaaaaaaa-1111-4000-a000-000000000006',
};

const USER_IDS = {
  manager1: 'bbbbbbbb-0000-4000-a000-000000000002',
  manager2: 'cccccccc-0000-4000-a000-000000000003',
  member1:  'dddddddd-0000-4000-a000-000000000004',
  member2:  'eeeeeeee-0000-4000-a000-000000000005',
  member3:  'ffffffff-0000-4000-a000-000000000006',
};

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('comments', [
      {
        id: COMMENT_IDS.c1,
        task_id: TASK_IDS.t1,
        author_id: USER_IDS.member1,
        body: 'Wireframes are complete. Desktop and tablet versions are uploaded to the shared drive. Mobile version needs one more round of review.',
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMMENT_IDS.c2,
        task_id: TASK_IDS.t1,
        author_id: USER_IDS.manager1,
        body: 'Looks great! Approved. Moving this to done. Please start on the responsive navigation next.',
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMMENT_IDS.c3,
        task_id: TASK_IDS.t2,
        author_id: USER_IDS.member1,
        body: 'Navigation is about 70% done. Hamburger menu is working on mobile. Still need to add active state highlighting and keyboard accessibility.',
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMMENT_IDS.c4,
        task_id: TASK_IDS.t2,
        author_id: USER_IDS.manager1,
        body: 'Reminder: due date is tomorrow. Let me know if you need any help unblocking.',
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMMENT_IDS.c5,
        task_id: TASK_IDS.t5,
        author_id: USER_IDS.member3,
        body: 'JWT middleware is done and tested manually. Redis blocklist check is working — verified with a logged-out token that it correctly returns 401.',
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: COMMENT_IDS.c6,
        task_id: TASK_IDS.t6,
        author_id: USER_IDS.member3,
        body: 'GET /tasks (paginated) and POST /tasks are done. Working on PATCH and soft-delete now. Joi schemas are in place.',
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('comments', {
      id: [
        'bbbbbbbb-2222-4000-a000-000000000001',
        'bbbbbbbb-2222-4000-a000-000000000002',
        'bbbbbbbb-2222-4000-a000-000000000003',
        'bbbbbbbb-2222-4000-a000-000000000004',
        'bbbbbbbb-2222-4000-a000-000000000005',
        'bbbbbbbb-2222-4000-a000-000000000006',
      ],
    });
  },
};
