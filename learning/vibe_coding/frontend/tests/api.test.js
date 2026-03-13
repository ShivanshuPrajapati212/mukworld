import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchState, buildInfrastructure, expandRoom } from '../src/api/index.js';

describe('Frontend API Utils', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchState should call GET /api/state', async () => {
    const mockData = { money: 100 };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    const res = await fetchState();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/state');
    expect(res).toEqual(mockData);
  });

  it('buildInfrastructure should call POST /api/build', async () => {
    const mockData = { success: true };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    const res = await buildInfrastructure('DESK', 1, 2);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/build', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ type: 'DESK', x: 1, y: 2 })
    }));
    expect(res).toEqual(mockData);
  });

  it('expandRoom should call POST /api/expand', async () => {
    const mockData = { success: true };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    const res = await expandRoom(3, 4);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/expand', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ x: 3, y: 4 })
    }));
    expect(res).toEqual(mockData);
  });
});
