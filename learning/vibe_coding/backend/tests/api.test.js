import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, gameState } from '../index.js';

describe('Backend API', () => {
  beforeEach(() => {
    gameState.money = 500;
    gameState.compute = 0;
    gameState.data = 0;
    gameState.users = 0;
    gameState.models = { quality: 1, name: 'Basic Model', tps: 0 };
    gameState.gridWidth = 20;
    gameState.gridHeight = 20;
    gameState.grid = [];
  });

  it('GET /api/state should return current game state', async () => {
    const res = await request(app).get('/api/state');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('money', 500);
  });

  it('POST /api/build should subtract money and add to grid', async () => {
    const res = await request(app).post('/api/build').send({ type: 'SERVER_T1', x: 0, y: 0 });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(gameState.money).toBe(400); // 500 - 100
    expect(gameState.grid.length).toBe(1);
    expect(gameState.grid[0].type).toBe('SERVER_T1');
  });

  it('POST /api/build should fail if out of bounds', async () => {
    const res = await request(app).post('/api/build').send({ type: 'SERVER_T1', x: 20, y: 0 });
    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/build should fail if not enough money', async () => {
    gameState.money = 50; 
    const res = await request(app).post('/api/build').send({ type: 'SERVER_T1', x: 0, y: 0 });
    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/train should set training rate', async () => {
    const res = await request(app).post('/api/train').send({ rate: 5 });
    expect(res.statusCode).toEqual(200);
    expect(gameState.models.tps).toBe(5);
  });

  it('POST /api/sell should convert data to money', async () => {
    gameState.data = 10;
    const res = await request(app).post('/api/sell').send({ amount: 10 });
    expect(res.statusCode).toEqual(200);
    expect(gameState.data).toBe(0);
    expect(gameState.money).toBe(520); // 500 + (10 * 2)
  });
});
