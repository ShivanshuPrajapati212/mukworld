import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchState, buildInfrastructure, expandRoom, fetchPlayerState, fetchPlayers, searchPlayers, fetchRandomPlayer } from '../src/api/index.js';

describe('Frontend API Utils', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    // Mock localStorage for getAuthHeaders()
    global.localStorage = {
      getItem: vi.fn(() => 'test-token'),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
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
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/state', expect.anything());
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
      body: JSON.stringify({ x: 3, y: 4, size: 1 })
    }));
    expect(res).toEqual(mockData);
  });

  // --- VISIT / DISCOVERY API TESTS ---

  it('fetchPlayerState should call GET /api/player/:username', async () => {
    const mockData = { success: true, username: 'testuser', money: 1000 };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    const res = await fetchPlayerState('testuser');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/player/testuser', expect.anything());
    expect(res).toEqual(mockData);
  });

  it('fetchPlayerState should encode special characters in username', async () => {
    const mockData = { success: true };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    await fetchPlayerState('user with spaces');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/player/user%20with%20spaces',
      expect.anything()
    );
  });

  it('fetchPlayers should call GET /api/players with pagination', async () => {
    const mockData = { success: true, players: [], page: 2, limit: 10 };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    const res = await fetchPlayers(2, 10);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/players?page=2&limit=10', expect.anything());
    expect(res).toEqual(mockData);
  });

  it('fetchPlayers should use defaults for page and limit', async () => {
    const mockData = { success: true, players: [] };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    await fetchPlayers();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/players?page=1&limit=20', expect.anything());
  });

  it('searchPlayers should call GET /api/players/search with query', async () => {
    const mockData = { success: true, players: [{ username: 'testuser' }] };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    const res = await searchPlayers('test');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/players/search?q=test', expect.anything());
    expect(res).toEqual(mockData);
  });

  it('searchPlayers should encode special characters', async () => {
    const mockData = { success: true, players: [] };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    await searchPlayers('test player');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/players/search?q=test%20player',
      expect.anything()
    );
  });

  it('fetchRandomPlayer should call GET /api/players/random', async () => {
    const mockData = { success: true, username: 'randomguy', money: 500 };
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    });

    const res = await fetchRandomPlayer();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/players/random', expect.anything());
    expect(res).toEqual(mockData);
  });
});

