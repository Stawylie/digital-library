const path = require('path');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

// Ensure predictable env for tests
process.env.JWT_SECRET = 'test_secret_123';
process.env.APP_NAME = 'Digital Library Test';

// Build an absolute module path to the User model as required by Controllers/authController.js
const userModulePath = require.resolve(path.join('..', 'models', 'user'), {
  paths: [path.join(__dirname, '..', 'Controllers')]
});

// We will define mocks at runtime using doMock to avoid hoisting issues
let ctrl; // will be set in beforeAll
let MockedUser; // will be set in beforeAll

beforeAll(() => {
  jest.resetModules();
  // Mock the User model used by the controller with an in-factory class and internal store
  jest.doMock(userModulePath, () => {
    const store = new Map();
    let _id = 1;
    class MockUser {
      constructor(fields) {
        Object.assign(this, fields);
      }
      static async findOne({ where }) {
        for (const u of store.values()) {
          let match = true;
          for (const k of Object.keys(where)) {
            if (u[k] !== where[k]) { match = false; break; }
          }
          if (match) return new MockUser(u);
        }
        return null;
      }
      static async findByPk(id) {
        const u = store.get(Number(id));
        return u ? new MockUser(u) : null;
      }
      static async create(fields) {
        const rec = { id: _id++, ...fields };
        store.set(rec.id, rec);
        return new MockUser(rec);
      }
      static async count() { return store.size; }
      async save() {
        store.set(this.id, { ...store.get(this.id), ...this });
        return this;
      }
    }
    // Expose store for test introspection
    MockUser.__store = store;
    return MockUser;
  }, { virtual: true });

  // Now load the controller (after mocks are set up)
  ctrl = require(path.join('..', 'Controllers', 'authController'));
  MockedUser = require(userModulePath);
});

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

function makeReq({ body = {}, headers = {}, user = null } = {}) {
  return { body, headers, user };
}

describe('MFA authentication flow', () => {
  let userId;
  let password = 'Pa$$w0rd!';

  test('register a new user', async () => {
    const req = makeReq({ body: { email: 'test@example.com', password, name: 'Test' } });
    const res = mockRes();
    await ctrl.register(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id');
    userId = res.body.id;
    expect(MockedUser.__store.get(userId)).toBeTruthy();
    expect(MockedUser.__store.get(userId).mfaEnabled).toBe(false);
  });

  test('login without MFA returns access token', async () => {
    const req = makeReq({ body: { email: 'test@example.com', password } });
    const res = mockRes();
    await ctrl.login(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  let mfaSecret;
  test('setup MFA generates secret and QR', async () => {
    const req = makeReq({ user: { sub: userId } });
    const res = mockRes();
    await ctrl.mfaSetup(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('base32');
    expect(res.body).toHaveProperty('qrDataUrl');
    mfaSecret = MockedUser.__store.get(userId).mfaSecret;
    expect(typeof mfaSecret).toBe('string');
  });

  test('verify MFA with valid code enables MFA and returns token', async () => {
    const code = speakeasy.totp({ secret: mfaSecret, encoding: 'base32' });
    // Build a bearer token for the user
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const req = makeReq({ body: { code }, headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    await ctrl.mfaVerify(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('token');
    expect(MockedUser.__store.get(userId).mfaEnabled).toBe(true);
  });

  test('login with MFA enabled returns mfaRequired and mfaToken', async () => {
    const req = makeReq({ body: { email: 'test@example.com', password } });
    const res = mockRes();
    await ctrl.login(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('mfaRequired', true);
    expect(res.body).toHaveProperty('mfaToken');
  });

  test('verify with MFA challenge token returns full token', async () => {
    // First login to get mfaToken
    const loginRes = mockRes();
    await ctrl.login(makeReq({ body: { email: 'test@example.com', password } }), loginRes);
    const mfaToken = loginRes.body.mfaToken;
    const code = speakeasy.totp({ secret: mfaSecret, encoding: 'base32' });
    const res = mockRes();
    await ctrl.mfaVerify(makeReq({ body: { code }, headers: { authorization: `Bearer ${mfaToken}` } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('disable MFA with valid code', async () => {
    // code for current secret
    const code = speakeasy.totp({ secret: mfaSecret, encoding: 'base32' });
    const req = makeReq({ user: { sub: userId }, body: { code } });
    const res = mockRes();
    await ctrl.mfaDisable(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(MockedUser.__store.get(userId).mfaEnabled).toBe(false);
    expect(MockedUser.__store.get(userId).mfaSecret).toBeNull();
  });

  test('verify with wrong code fails with 401', async () => {
    // After disable, set up again to have a secret
    const setupRes = mockRes();
    await ctrl.mfaSetup(makeReq({ user: { sub: userId } }), setupRes);
    const wrongCode = '000000';
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const res = mockRes();
    await ctrl.mfaVerify(makeReq({ body: { code: wrongCode }, headers: { authorization: `Bearer ${token}` } }), res);
    expect(res.statusCode).toBe(401);
  });
});
