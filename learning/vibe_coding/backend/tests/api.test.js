import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app, startGameLoop, stopGameLoop } from '../index.js';

// Helpers
let token; // auth token for test user
let testUsername = 'testplayer';
let testPassword = 'testpass123';

// Helper to register or login a user and return a token
async function getAuthToken(username = testUsername, password = testPassword) {
  // Try registering first
  let res = await request(app).post('/api/register').send({ username, password });
  if (res.body.success) return res.body.token;

  // If already exists, login
  res = await request(app).post('/api/login').send({ username, password });
  return res.body.token;
}

// Helper to make authenticated requests
function authGet(url, authToken = token) {
  return request(app).get(url).set('Authorization', `Bearer ${authToken}`);
}
function authPost(url, body, authToken = token) {
  return request(app).post(url).set('Authorization', `Bearer ${authToken}`).send(body);
}

beforeAll(async () => {
  // Wait for mongoose to connect
  while (mongoose.connection.readyState !== 1) {
    await new Promise(r => setTimeout(r, 200));
  }

  // Clean test database
  await mongoose.connection.dropDatabase();

  // Register test user
  token = await getAuthToken();
});

afterAll(async () => {
  stopGameLoop();
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// ---------------------------------------------------------
// EXISTING ENDPOINT TESTS (updated for auth + MongoDB)
// ---------------------------------------------------------
describe('Backend API - Core Endpoints', () => {
  beforeEach(async () => {
    // Reset the test user's game state before each test
    const GameState = mongoose.model('GameState');
    const User = mongoose.model('User');
    const user = await User.findOne({ username: testUsername });
    if (user) {
      await GameState.updateOne({ userId: user._id }, {
        $set: {
          money: 500,
          compute: 0,
          users: 0,
          models: { quality: 1, name: 'Basic Model', tps: 0 },
          gridWidth: 20,
          gridHeight: 20,
          unlockedTiles: (() => {
            const tiles = [];
            for (let x = 0; x < 10; x++) {
              for (let y = 0; y < 10; y++) {
                tiles.push(`${x},${y}`);
              }
            }
            return tiles;
          })(),
          grid: []
        }
      });
    }
  });

  it('GET /api/state should return current game state', async () => {
    const res = await authGet('/api/state');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('money', 500);
  });

  it('POST /api/build should subtract money and add to grid', async () => {
    const res = await authPost('/api/build', { type: 'SERVER_T1', x: 0, y: 0 });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.gameState.money).toBe(400); // 500 - 100
    expect(res.body.gameState.grid.length).toBe(1);
    expect(res.body.gameState.grid[0].type).toBe('SERVER_T1');
  });

  it('POST /api/build should fail if tile is not unlocked', async () => {
    const res = await authPost('/api/build', { type: 'SERVER_T1', x: 15, y: 15 });
    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Tile is not unlocked');
  });

  it('POST /api/build should fail if not enough money', async () => {
    // First drain money — set it to 50 via direct DB update
    const GameState = mongoose.model('GameState');
    const User = mongoose.model('User');
    const user = await User.findOne({ username: testUsername });
    await GameState.updateOne({ userId: user._id }, { $set: { money: 50 } });
    // Clear active session cache so loadState re-reads from DB
    const { activeSessions } = await import('../index.js');

    // Remove from active sessions to force reload
    for (const [key] of activeSessions) {
      activeSessions.delete(key);
    }

    const res = await authPost('/api/build', { type: 'SERVER_T1', x: 0, y: 0 });
    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Not enough money');
  });

  it('POST /api/expand should unlock a tile and cost money', async () => {
    const res = await authPost('/api/expand', { x: 10, y: 0 });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.gameState.unlockedTiles).toContain('10,0');
  });

  it('POST /api/expand should fail if not adjacent to unlocked tile', async () => {
    const res = await authPost('/api/expand', { x: 18, y: 18 });
    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Must expand adjacent to an unlocked tile');
  });

  it('GET /api/leaderboard should return leaderboard', async () => {
    const res = await authGet('/api/leaderboard');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.leaderboard).toBeInstanceOf(Array);
    expect(res.body.leaderboard.length).toBeGreaterThanOrEqual(1);
    expect(res.body.leaderboard[0]).toHaveProperty('username');
    expect(res.body.leaderboard[0]).toHaveProperty('money');
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).get('/api/state');
    expect(res.statusCode).toEqual(401);
  });
});

// ---------------------------------------------------------
// PHASE A: VISIT / PLAYER DISCOVERY TESTS
// ---------------------------------------------------------
describe('Backend API - Visit & Player Discovery', () => {
  let player2Token;
  const player2Username = 'visitplayer2';
  const player3Username = 'searchable_player';
  let player3Token;

  beforeAll(async () => {
    // Create additional test players
    player2Token = await getAuthToken(player2Username, 'password123');
    player3Token = await getAuthToken(player3Username, 'password456');

    // Build something in player2's room so we can verify it when visiting
    await request(app)
      .post('/api/build')
      .set('Authorization', `Bearer ${player2Token}`)
      .send({ type: 'DESK', x: 0, y: 0 });
  });

  describe('GET /api/player/:username', () => {
    it('should return a specific player\'s full state', async () => {
      const res = await authGet(`/api/player/${player2Username}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.username).toBe(player2Username);
      expect(res.body).toHaveProperty('money');
      expect(res.body).toHaveProperty('compute');
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('models');
      expect(res.body).toHaveProperty('grid');
      expect(res.body).toHaveProperty('unlockedTiles');
      expect(res.body.grid.length).toBeGreaterThanOrEqual(1); // The DESK we built
    });

    it('should return 404 for non-existent player', async () => {
      const res = await authGet('/api/player/nonexistentplayer999');
      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Player not found');
    });

    it('should require authentication', async () => {
      const res = await request(app).get(`/api/player/${player2Username}`);
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/players', () => {
    it('should return a paginated list of players', async () => {
      const res = await authGet('/api/players');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.players).toBeInstanceOf(Array);
      expect(res.body.players.length).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 20);
      expect(res.body).toHaveProperty('totalCount');
      expect(res.body).toHaveProperty('totalPages');

      // Each player should have summary fields
      const player = res.body.players[0];
      expect(player).toHaveProperty('username');
      expect(player).toHaveProperty('money');
      expect(player).toHaveProperty('users');
      expect(player).toHaveProperty('modelQuality');
      expect(player).toHaveProperty('gridSummary');
      expect(player.gridSummary).toHaveProperty('buildingCount');
      expect(player.gridSummary).toHaveProperty('tileCount');
    });

    it('should respect pagination params', async () => {
      const res = await authGet('/api/players?page=1&limit=2');
      expect(res.statusCode).toEqual(200);
      expect(res.body.players.length).toBeLessThanOrEqual(2);
      expect(res.body.limit).toBe(2);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/players');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/players/search', () => {
    it('should find players by partial username match', async () => {
      const res = await authGet('/api/players/search?q=searchable');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.players).toBeInstanceOf(Array);
      expect(res.body.players.length).toBeGreaterThanOrEqual(1);
      expect(res.body.players.some(p => p.username === player3Username)).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const res = await authGet('/api/players/search?q=SEARCHABLE');
      expect(res.statusCode).toEqual(200);
      expect(res.body.players.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for no matches', async () => {
      const res = await authGet('/api/players/search?q=zzzznonexistent');
      expect(res.statusCode).toEqual(200);
      expect(res.body.players).toEqual([]);
    });

    it('should return 400 for empty search query', async () => {
      const res = await authGet('/api/players/search?q=');
      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/players/search?q=test');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/players/random', () => {
    it('should return a random player', async () => {
      const res = await authGet('/api/players/random');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('username');
      expect(res.body).toHaveProperty('money');
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('modelQuality');
      expect(res.body).toHaveProperty('gridSummary');
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/players/random');
      expect(res.statusCode).toEqual(401);
    });
  });
});
