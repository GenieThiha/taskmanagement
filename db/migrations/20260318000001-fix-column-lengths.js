'use strict';

// Aligns tasks.title (VARCHAR 200) and projects.name (VARCHAR 150)
// with the lengths documented in the data model spec.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tasks', 'title', {
      type: Sequelize.STRING(200),
      allowNull: false,
    });

    await queryInterface.changeColumn('projects', 'name', {
      type: Sequelize.STRING(150),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tasks', 'title', {
      type: Sequelize.STRING(300),
      allowNull: false,
    });

    await queryInterface.changeColumn('projects', 'name', {
      type: Sequelize.STRING(200),
      allowNull: false,
    });
  },
};
