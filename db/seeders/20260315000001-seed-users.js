'use strict';

const bcrypt = require('bcrypt');

const COST = 12;
const PASSWORD = 'Password123!';

// Fixed UUIDs so FK relationships work across seeders
const USER_IDS = {
  admin:    'aaaaaaaa-0000-4000-a000-000000000001',
  manager1: 'bbbbbbbb-0000-4000-a000-000000000002',
  manager2: 'cccccccc-0000-4000-a000-000000000003',
  member1:  'dddddddd-0000-4000-a000-000000000004',
  member2:  'eeeeeeee-0000-4000-a000-000000000005',
  member3:  'ffffffff-0000-4000-a000-000000000006',
};

module.exports = {
  async up(queryInterface) {
    const hash = await bcrypt.hash(PASSWORD, COST);
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        id: USER_IDS.admin,
        email: 'admin@tma.internal',
        password_hash: hash,
        full_name: 'Alice Admin',
        role: 'admin',
        is_active: true,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: USER_IDS.manager1,
        email: 'bob.manager@tma.internal',
        password_hash: hash,
        full_name: 'Bob Manager',
        role: 'manager',
        is_active: true,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: USER_IDS.manager2,
        email: 'carol.manager@tma.internal',
        password_hash: hash,
        full_name: 'Carol Manager',
        role: 'manager',
        is_active: true,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: USER_IDS.member1,
        email: 'david.member@tma.internal',
        password_hash: hash,
        full_name: 'David Member',
        role: 'member',
        is_active: true,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: USER_IDS.member2,
        email: 'eve.member@tma.internal',
        password_hash: hash,
        full_name: 'Eve Member',
        role: 'member',
        is_active: true,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: USER_IDS.member3,
        email: 'frank.member@tma.internal',
        password_hash: hash,
        full_name: 'Frank Member',
        role: 'member',
        is_active: true,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      id: Object.values({
        admin:    'aaaaaaaa-0000-4000-a000-000000000001',
        manager1: 'bbbbbbbb-0000-4000-a000-000000000002',
        manager2: 'cccccccc-0000-4000-a000-000000000003',
        member1:  'dddddddd-0000-4000-a000-000000000004',
        member2:  'eeeeeeee-0000-4000-a000-000000000005',
        member3:  'ffffffff-0000-4000-a000-000000000006',
      }),
    });
  },
};
