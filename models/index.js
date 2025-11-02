const { Sequelize } = require('sequelize');
require('dotenv').config();

// Build a robust Sequelize instance that provides clear errors when env vars are missing
function buildSequelize() {
    const {
        DATABASE_URL,
        DB_HOST,
        DB_PORT,
        DB_NAME,
        DB_USER,
        DB_PASS,
        DB_PASSWORD,
        PGHOST,
        PGPORT,
        PGDATABASE,
        PGUSER,
        PGPASSWORD,
        PGSSL
    } = process.env;

    const resolvedDbPass = DB_PASS || DB_PASSWORD;

    const commonOptions = {
        dialect: 'postgres',
        logging: false,
    };

    // Optional SSL for hosted providers; enable by setting PGSSL=true
    const useSSL = String(PGSSL || '').toLowerCase() === 'true';
    if (useSSL) {
        commonOptions.dialectOptions = {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        };
    }

    // 1) DATABASE_URL takes precedence
    if (DATABASE_URL) {
        return new Sequelize(DATABASE_URL, commonOptions);
    }

    // 2) Discrete DB_* variables
    const hasDbDiscrete = DB_HOST && DB_NAME && DB_USER && (resolvedDbPass != null && resolvedDbPass !== '');
    if (hasDbDiscrete) {
        const port = DB_PORT ? parseInt(DB_PORT, 10) : 5432;
        return new Sequelize(DB_NAME, DB_USER, resolvedDbPass, {
            host: DB_HOST,
            port,
            ...commonOptions,
        });
    }

    // 3) Support standard PostgreSQL PG* environment variables
    const hasPgVars = PGHOST && PGDATABASE && PGUSER && (PGPASSWORD != null && PGPASSWORD !== '');
    if (hasPgVars) {
        const port = PGPORT ? parseInt(PGPORT, 10) : 5432;
        return new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
            host: PGHOST,
            port,
            ...commonOptions,
        });
    }

    // If we reach here, config is missing
    const msg = 'Database configuration missing. Provide one of:\n' +
        '- DATABASE_URL\n' +
        '- DB_HOST, DB_NAME, DB_USER, DB_PASS or DB_PASSWORD (and optional DB_PORT, PGSSL)\n' +
        '- PGHOST, PGDATABASE, PGUSER, PGPASSWORD (and optional PGPORT, PGSSL)';
    throw new Error(msg);
}

const sequelize = buildSequelize();

// Load models
const Notification = require('./Notification')(sequelize, Sequelize.DataTypes);
const User = require('./User')(sequelize, Sequelize.DataTypes);
const Book = require('./Book')(sequelize, Sequelize.DataTypes);
const Resource = require('./Resource')(sequelize, Sequelize.DataTypes); // ✅ Added Resource model

// Define associations
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

// Optional: If books or resources are linked to users later, you can add associations like:
// User.hasMany(Book, { foreignKey: 'userId' });
// Book.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
    sequelize,
    Sequelize,
    User,
    Notification,
    Book,
    Resource // ✅ Exported Resource model
};