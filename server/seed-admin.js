const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const sequelize = new Sequelize('postgresql://tma:tma@localhost:5433/tma_dev', {
  dialect: 'postgres',
  logging: false,
});

async function seed() {
  const email = 'admin@tma.internal';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuidv4();
  
  try {
    await sequelize.query(`
      INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, {
      replacements: [id, email, passwordHash, 'System Admin', 'admin', true]
    });
    
    console.log('SUCCESS: Admin user created.');
    console.log('Email: ' + email);
    console.log('Password: ' + password);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      console.log('User already exists.');
    } else {
      throw err;
    }
  } finally {
    await sequelize.close();
  }
}

seed().catch(err => {
  console.error('FAILED to seed admin user:', err);
  process.exit(1);
});
