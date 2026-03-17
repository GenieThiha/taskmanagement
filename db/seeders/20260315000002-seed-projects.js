'use strict';

const PROJECT_IDS = {
  websiteRedesign: '11111111-0000-4000-a000-000000000001',
  backendApiV2:    '22222222-0000-4000-a000-000000000002',
  mobileAppMvp:    '33333333-0000-4000-a000-000000000003',
};

const USER_IDS = {
  manager1: 'bbbbbbbb-0000-4000-a000-000000000002',
  manager2: 'cccccccc-0000-4000-a000-000000000003',
};

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('projects', [
      {
        id: PROJECT_IDS.websiteRedesign,
        name: 'Website Redesign',
        description: 'Full redesign of the public-facing marketing website with new branding and improved UX.',
        owner_id: USER_IDS.manager1,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        id: PROJECT_IDS.backendApiV2,
        name: 'Backend API v2',
        description: 'Rewrite of the legacy REST API using Node.js/Express with proper auth, rate limiting, and Sequelize ORM.',
        owner_id: USER_IDS.manager2,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      {
        id: PROJECT_IDS.mobileAppMvp,
        name: 'Mobile App MVP',
        description: 'Minimum viable product for the iOS/Android companion app. Out of scope for TMA-2026 — parked for planning.',
        owner_id: USER_IDS.manager1,
        status: 'archived',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('projects', {
      id: [
        '11111111-0000-4000-a000-000000000001',
        '22222222-0000-4000-a000-000000000002',
        '33333333-0000-4000-a000-000000000003',
      ],
    });
  },
};
