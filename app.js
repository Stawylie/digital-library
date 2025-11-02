const express = require('express');
const cors = require('cors');
const logger = require('morgan');
const createError = require('http-errors');
require('dotenv').config();
const path = require('path');

const indexRouter = require('./routes/index');
// const usersRouter = require('./routes/users'); // remove if unused

const app = express();

const { requireAdmin } = require('./middleware/auth');

const apiRoutes = require('./routes/api');

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// Global middleware must be registered before any routes so CORS and parsers apply everywhere
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Serve static files (e.g., public/admin.html)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});
app.get('/user/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/user-home.html'));
});


// Helper to report config status without requiring Sequelize
function getDbConfigStatus() {
    const {
        DATABASE_URL,
        DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT,
        PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT,
        PGSSL
    } = process.env;

    if (DATABASE_URL) {
        return { ok: true, mode: 'url', missing: [], vars: { DATABASE_URL: true } };
    }

    const hasDbDiscrete = DB_HOST && DB_NAME && DB_USER && (DB_PASS != null && DB_PASS !== '');
    const hasPgVars = PGHOST && PGDATABASE && PGUSER && (PGPASSWORD != null && PGPASSWORD !== '');

    if (hasDbDiscrete) {
        return {
            ok: true,
            mode: 'discrete',
            missing: [],
            vars: {
                DB_HOST: !!DB_HOST,
                DB_NAME: !!DB_NAME,
                DB_USER: !!DB_USER,
                DB_PASS: DB_PASS != null && DB_PASS !== '',
                DB_PORT: !!DB_PORT,
                PGSSL: String(PGSSL || '').toLowerCase() === 'true'
            }
        };


    }

    if (hasPgVars) {
        return {
            ok: true,
            mode: 'pg',
            missing: [],
            vars: {
                PGHOST: !!PGHOST,
                PGDATABASE: !!PGDATABASE,
                PGUSER: !!PGUSER,
                PGPASSWORD: PGPASSWORD != null && PGPASSWORD !== '',
                PGPORT: !!PGPORT,
                PGSSL: String(PGSSL || '').toLowerCase() === 'true'
            }
        };
    }

    // Report missing for DB_* by default
    const missing = [];
    if (!DB_HOST) missing.push('DB_HOST');
    if (!DB_NAME) missing.push('DB_NAME');
    if (!DB_USER) missing.push('DB_USER');
    if (DB_PASS == null || DB_PASS === '') missing.push('DB_PASS');

    return {
        ok: false,
        mode: 'discrete',
        missing,
        vars: {
            DATABASE_URL: !!DATABASE_URL,
            DB_HOST: !!DB_HOST,
            DB_NAME: !!DB_NAME,
            DB_USER: !!DB_USER,
            DB_PASS: DB_PASS != null && DB_PASS !== '',
            DB_PORT: !!DB_PORT,
            PGHOST: !!PGHOST,
            PGDATABASE: !!PGDATABASE,
            PGUSER: !!PGUSER,
            PGPASSWORD: PGPASSWORD != null && PGPASSWORD !== '',
            PGPORT: !!PGPORT,
            PGSSL: String(PGSSL || '').toLowerCase() === 'true'
        }
    };
}

const configStatus = getDbConfigStatus();
let sequelize, User, Resource, Notification;

if (configStatus.ok) {
    // Only load DB-dependent modules and routes when config is present
    const resourceRoutes = require('./routes/resourceRoutes');
    const notificationRoutes = require('./routes/notificationRoutes');
    const adminRoutes = require('./routes/adminRoutes');
    const authRoutes = require('./routes/authRoutes');
    const db = require('./models');
    sequelize = db.sequelize;
    User = db.User;
    Resource = db.Resource;
    Notification = db.Notification;

    const bookRoutes = require('./routes/bookRoutes');
    app.use('/api/books', bookRoutes);

    app.use('/api/resources', resourceRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/auth', authRoutes);

    app.use(express.static(path.join(__dirname, 'public')));
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'landing.html'));
        app.get('/login', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
            app.get('/user/home', (req, res) => {
                res.sendFile(path.join(__dirname, 'public', 'user-home.html'));
            });
        });
    });


    sequelize.sync({ alter: true })
        .then(() => {
            console.log('✅ Database synced');
        })
        .catch((err) => {
            console.error('❌ Database sync failed:', err);
        });

    // DB health endpoint to check connection and table sync status
    app.get('/health/db', async (req, res) => {
        try {
            await sequelize.authenticate();
            const qi = sequelize.getQueryInterface();
            const models = [User, Resource, Notification];

            const results = await Promise.all(models.map(async (model) => {
                const tn = model.getTableName();
                const tableName = typeof tn === 'string' ? tn : (tn && (tn.tableName || tn.toString())) || 'unknown';
                try {
                    await qi.describeTable(tableName);
                    return { table: tableName, exists: true };
                } catch (e) {
                    return { table: tableName, exists: false, error: e.message };
                }
            }));

            const allExist = results.every(r => r.exists);
            res.json({ connected: true, synced: allExist, tables: results });
        } catch (err) {
            res.status(500).json({ connected: false, error: err.message });
        }
    });
} else {
    console.warn('⚠️  Database environment not configured. Server will start without DB. Visit /health/config for details.');
    // In limited mode (no DB), explicitly mount /api/auth with a helpful 503 response
    app.use('/api/auth', (req, res) => {
        res.status(503).json({
            error: 'Auth routes unavailable: database not configured',
            hint: 'Set DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASS in .env and restart the server.',
            tips: [
                'Open /health/config and /health/doctor for details.',
                'After configuring .env, restart the server so /api/auth/* routes can be mounted.'
            ]
        });
    });
}



app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Routes
app.use('/', indexRouter);
// Convenience route to serve the admin dashboard file
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
// Convenience route to serve the login demo (with MFA) file
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
// app.use('/users', usersRouter); // remove if unused

// Config health endpoint is always available
app.get('/health/config', (req, res) => {
    // Recompute status on each request to reflect latest env changes
    const status = getDbConfigStatus();
    const safeEnv = {
        PORT: process.env.PORT || '3000',
        DATABASE_URL: !!process.env.DATABASE_URL,
        DB_HOST: !!process.env.DB_HOST,
        DB_NAME: !!process.env.DB_NAME,
        DB_USER: !!process.env.DB_USER,
        DB_PASS: process.env.DB_PASS != null && process.env.DB_PASS !== '',
        DB_PORT: process.env.DB_PORT || '5432',
        PGSSL: String(process.env.PGSSL || '').toLowerCase() === 'true'
    };
    res.json({ ok: status.ok, mode: status.mode, missing: status.missing || [], env: safeEnv });
});

// Progress/heartbeat endpoint for quick, conclusive feedback
app.get('/health/progress', async (req, res) => {
    const startedAt = process.uptime(); // seconds
    const config = getDbConfigStatus();

    async function dbPingWithTimeout(ms) {
        if (!config.ok || !sequelize) return { available: false, reason: 'db_config_missing' };
        try {
            const start = Date.now();
            const p = sequelize.authenticate().then(() => ({
                available: true,
                latencyMs: Date.now() - start
            }));
            const timeout = new Promise((resolve) => setTimeout(() => resolve({ available: false, reason: 'timeout' }), ms));
            return await Promise.race([p, timeout]);
        } catch (e) {
            return { available: false, reason: 'error', message: e.message };
        }
    }

    const db = await dbPingWithTimeout(1500);

    const authRoutes = require('./routes/authRoutes');
    app.use('/api/auth', authRoutes);

    const status = {
        ok: true,
        message: 'Service responsive',
        uptimeSec: Math.round(startedAt),
        configReady: config.ok,
        db
    };

    // If DB configured but not reachable, mark not ok
    if (config.ok && (!db.available)) {
        status.ok = false;
        status.message = 'Service responsive, but database not reachable';
    }

    res.json(status);
});

// Deep diagnostics endpoint: always responds with detailed checks and tips
app.get('/health/doctor', async (req, res) => {
    const config = getDbConfigStatus();

    function addTip(arr, text) { arr.push(text); }

    const result = {
        ok: true,
        summary: 'Diagnostics completed',
        configReady: config.ok,
        configMode: config.mode,
        missingEnv: config.missing || [],
        env: {
            PORT: process.env.PORT || '3000',
            DATABASE_URL: !!process.env.DATABASE_URL,
            DB_HOST: !!process.env.DB_HOST,
            DB_NAME: !!process.env.DB_NAME,
            DB_USER: !!process.env.DB_USER,
            DB_PASS: process.env.DB_PASS != null && process.env.DB_PASS !== '',
            DB_PORT: process.env.DB_PORT || '5432',
            PGHOST: !!process.env.PGHOST,
            PGDATABASE: !!process.env.PGDATABASE,
            PGUSER: !!process.env.PGUSER,
            PGPASSWORD: process.env.PGPASSWORD != null && process.env.PGPASSWORD !== '',
            PGPORT: process.env.PGPORT || '5432',
            PGSSL: String(process.env.PGSSL || '').toLowerCase() === 'true'
        },
        db: { available: false },
        tables: [],
        tips: []
    };

    if (!config.ok) {
        result.ok = false;
        result.summary = 'Database environment not configured';
        addTip(result.tips, 'Create .env with DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASS and restart the server.');
        addTip(result.tips, 'See README: Setup and Troubleshooting to configure PostgreSQL and environment variables.');
        return res.json(result);
    }



    // If DB is configured but sequelize may have failed to init at startup
    if (!sequelize) {
        result.ok = false;
        result.summary = 'Database configured but not initialized in app';
        addTip(result.tips, 'Check server startup logs for Sequelize initialization errors.');
        return res.json(result);
    }

    // Ping DB with timeout
    async function withTimeout(promise, ms) {
        return await Promise.race([
            promise.then(v => ({ ok: true, value: v })).catch(e => ({ ok: false, error: e })),
            new Promise(resolve => setTimeout(() => resolve({ ok: false, timeout: true }), ms))
        ]);
    }

    const ping = await withTimeout(sequelize.authenticate(), 2000);
    if (!ping.ok) {
        result.ok = false;
        result.db = { available: false, reason: ping.timeout ? 'timeout' : 'error', message: ping.error ? ping.error.message : undefined };
        result.summary = ping.timeout ? 'Database ping timed out' : 'Database connection error';
        addTip(result.tips, 'Verify PostgreSQL service is running and reachable at the configured host/port.');
        addTip(result.tips, 'Check firewall and credentials (DB_USER/DB_PASS).');
        return res.json(result);
    }

    result.db = { available: true };

    // Check tables
    try {
        const qi = sequelize.getQueryInterface();
        const models = [];
        if (typeof User !== 'undefined' && User) models.push(User);
        if (typeof Resource !== 'undefined' && Resource) models.push(Resource);
        if (typeof Notification !== 'undefined' && Notification) models.push(Notification);
        const checks = await Promise.all(models.map(async (model) => {
            const tn = model.getTableName();
            const tableName = typeof tn === 'string' ? tn : (tn && (tn.tableName || tn.toString())) || 'unknown';
            try {
                await qi.describeTable(tableName);
                return { table: tableName, exists: true };
            } catch (e) {
                return { table: tableName, exists: false, error: e.message };
            }
        }));
        result.tables = checks;
        const allExist = checks.every(c => c.exists);
        if (!allExist) {
            result.ok = false;
            result.summary = 'Some tables are missing';
            addTip(result.tips, 'Allow the server to run with sequelize.sync({ alter: true }) to create/update tables, or run migrations if applicable.');
        }
    } catch (e) {
        result.ok = false;
        result.summary = 'Failed to verify tables';
        addTip(result.tips, 'Review database permissions for the configured user; table inspection failed.');
    }

    if (result.ok) {
        result.summary = 'All health checks passed.';
    }

    res.json(result);
});

// 404 handler
app.use((req, res, next) => {
    next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        message: err.message,
        error: req.app.get('env') === 'development' ? err : {}
    });
});

module.exports = app;