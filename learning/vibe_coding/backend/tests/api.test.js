import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, gameState } from '../index.js';

describe('Backend API', () => {
  beforeEach(() => {
    gameState.money = 500;
    gameState.compute = 0;
    gameState.data = 0;
    gameState.users = 0;
    gameState.grid = [];
  });

  it('GET /api/state should return current game state', async () => {
    const res = await request(app).get('/api/state');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('money', 500);
  });
});
