'use strict';

// Pre-computed bcrypt hash (cost 12) of 'Password123!'
// Hard-coded so the seeder has no native-module dependency and can run
// from the host machine against the Docker-mapped postgres port.
const PASSWORD_HASH = '$2b$12$9L2yKMV.vBYTkHT997CeI.fpxAMWbydukwGpo8XwCir2nDPZ.pRNy';

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
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        id: USER_IDS.admin,
        email: 'admin@tma.internal',
        password_hash: PASSWORD_HASH,
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
        password_hash: PASSWORD_HASH,
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
        password_hash: PASSWORD_HASH,
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
        password_hash: PASSWORD_HASH,
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
        password_hash: PASSWORD_HASH,
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
        password_hash: PASSWORD_HASH,
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
