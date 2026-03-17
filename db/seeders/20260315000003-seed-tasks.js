'use strict';

const TASK_IDS = {
  t1: 'aaaaaaaa-1111-4000-a000-000000000001',
  t2: 'aaaaaaaa-1111-4000-a000-000000000002',
  t3: 'aaaaaaaa-1111-4000-a000-000000000003',
  t4: 'aaaaaaaa-1111-4000-a000-000000000004',
  t5: 'aaaaaaaa-1111-4000-a000-000000000005',
  t6: 'aaaaaaaa-1111-4000-a000-000000000006',
  t7: 'aaaaaaaa-1111-4000-a000-000000000007',
  t8: 'aaaaaaaa-1111-4000-a000-000000000008',
};

const PROJECT_IDS = {
  websiteRedesign: '11111111-0000-4000-a000-000000000001',
  backendApiV2:    '22222222-0000-4000-a000-000000000002',
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
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    await queryInterface.bulkInsert('tasks', [
      // Website Redesign tasks
      {
        id: TASK_IDS.t1,
        title: 'Design homepage wireframes',
        description: 'Create low-fidelity wireframes for the new homepage layout. Must cover desktop, tablet, and mobile breakpoints.',
        project_id: PROJECT_IDS.websiteRedesign,
        assignee_id: USER_IDS.member1,
        reporter_id: USER_IDS.manager1,
        status: 'done',
        priority: 'high',
        due_date: lastWeek.toISOString().split('T')[0],
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: TASK_IDS.t2,
        title: 'Implement responsive navigation',
        description: 'Build the top navigation bar using Tailwind CSS. Hamburger menu on mobile. Active state highlighting.',
        project_id: PROJECT_IDS.websiteRedesign,
        assignee_id: USER_IDS.member1,
        reporter_id: USER_IDS.manager1,
        status: 'in_progress',
        priority: 'high',
        due_date: tomorrow.toISOString().split('T')[0],
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: TASK_IDS.t3,
        title: 'Write copy for About Us page',
        description: 'Draft updated company description and team bios for the About Us section. ~500 words.',
        project_id: PROJECT_IDS.websiteRedesign,
        assignee_id: USER_IDS.member2,
        reporter_id: USER_IDS.manager1,
        status: 'todo',
        priority: 'medium',
        due_date: nextWeek.toISOString().split('T')[0],
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: TASK_IDS.t4,
        title: 'SEO audit and meta tag update',
        description: 'Run Lighthouse audit. Update title tags, meta descriptions, and Open Graph tags across all pages.',
        project_id: PROJECT_IDS.websiteRedesign,
        assignee_id: USER_IDS.member2,
        reporter_id: USER_IDS.manager1,
        status: 'review',
        priority: 'low',
        due_date: nextWeek.toISOString().split('T')[0],
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      // Backend API v2 tasks
      {
        id: TASK_IDS.t5,
        title: 'Set up JWT auth middleware',
        description: 'Implement auth-guard.ts: verify Bearer token, check Redis blocklist, attach req.user. Handle 401 edge cases.',
        project_id: PROJECT_IDS.backendApiV2,
        assignee_id: USER_IDS.member3,
        reporter_id: USER_IDS.manager2,
        status: 'done',
        priority: 'critical',
        due_date: lastWeek.toISOString().split('T')[0],
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: TASK_IDS.t6,
        title: 'Implement /tasks CRUD endpoints',
        description: 'Full CRUD for tasks: GET list (paginated), GET by id, POST, PATCH, DELETE (soft). Apply Joi validation and requireRole middleware.',
        project_id: PROJECT_IDS.backendApiV2,
        assignee_id: USER_IDS.member3,
        reporter_id: USER_IDS.manager2,
        status: 'in_progress',
        priority: 'high',
        due_date: tomorrow.toISOString().split('T')[0],
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: TASK_IDS.t7,
        title: 'Add Redis-backed rate limiting',
        description: 'Configure express-rate-limit with RedisStore. Global: 100 req/min. Auth endpoints: 10 req/min. Test with artillery.',
        project_id: PROJECT_IDS.backendApiV2,
        assignee_id: USER_IDS.member1,
        reporter_id: USER_IDS.manager2,
        status: 'todo',
        priority: 'medium',
        due_date: nextWeek.toISOString().split('T')[0],
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: TASK_IDS.t8,
        title: 'Write integration tests for auth flow',
        description: 'Supertest tests covering: register, login, refresh token, logout, account lockout after 5 failed attempts.',
        project_id: PROJECT_IDS.backendApiV2,
        assignee_id: USER_IDS.member2,
        reporter_id: USER_IDS.manager2,
        status: 'todo',
        priority: 'high',
        due_date: nextWeek.toISOString().split('T')[0],
        is_deleted: false,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tasks', {
      id: Object.values({
        t1: 'aaaaaaaa-1111-4000-a000-000000000001',
        t2: 'aaaaaaaa-1111-4000-a000-000000000002',
        t3: 'aaaaaaaa-1111-4000-a000-000000000003',
        t4: 'aaaaaaaa-1111-4000-a000-000000000004',
        t5: 'aaaaaaaa-1111-4000-a000-000000000005',
        t6: 'aaaaaaaa-1111-4000-a000-000000000006',
        t7: 'aaaaaaaa-1111-4000-a000-000000000007',
        t8: 'aaaaaaaa-1111-4000-a000-000000000008',
      }),
    });
  },
};
