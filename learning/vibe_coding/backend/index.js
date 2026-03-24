import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-123';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mukworld';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

// Building dictionary with sizes and costs
const BUILDINGS = {
  SERVER_T1: { cost: 100, width: 1, height: 1, computePerTick: 1, usersSoldPerTick: 0, computeConsumedPerTick: 0 },
  SERVER_T2: { cost: 500, width: 2, height: 1, computePerTick: 6, usersSoldPerTick: 0, computeConsumedPerTick: 0 },
  SERVER_T2_ROTATED: { cost: 500, width: 1, height: 2, computePerTick: 6, usersSoldPerTick: 0, computeConsumedPerTick: 0 },
  DESK: { cost: 50, width: 1, height: 1, computePerTick: 0, usersSoldPerTick: 0, computeConsumedPerTick: 0 },
  SELLER_T1: { cost: 150, width: 1, height: 1, computePerTick: 0, usersSoldPerTick: 1, computeConsumedPerTick: 0 },
  SELLER_T2: { cost: 750, width: 1, height: 1, computePerTick: 0, usersSoldPerTick: 5, computeConsumedPerTick: 0 },
  SELLER_T3: { cost: 2000, width: 2, height: 1, computePerTick: 0, usersSoldPerTick: 15, computeConsumedPerTick: 0 },
  SELLER_T3_ROTATED: { cost: 2000, width: 1, height: 2, computePerTick: 0, usersSoldPerTick: 15, computeConsumedPerTick: 0 },
  TRAINER_T1: { cost: 200, width: 1, height: 1, computePerTick: 0, usersSoldPerTick: 0, computeConsumedPerTick: 2 },
  TRAINER_T2: { cost: 800, width: 1, height: 1, computePerTick: 0, usersSoldPerTick: 0, computeConsumedPerTick: 8 },
  TRAINER_T3: { cost: 2500, width: 2, height: 1, computePerTick: 0, usersSoldPerTick: 0, computeConsumedPerTick: 20 },
  TRAINER_T3_ROTATED: { cost: 2500, width: 1, height: 2, computePerTick: 0, usersSoldPerTick: 0, computeConsumedPerTick: 20 }
};

// ---------------------------------------------------------
// DATABASE SCHEMAS
// ---------------------------------------------------------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

const gameStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  money: { type: Number, default: 500 },
  compute: { type: Number, default: 0 },
  users: { type: Number, default: 0 },
  models: {
    quality: { type: Number, default: 1 },
    name: { type: String, default: 'Basic Model' },
    tps: { type: Number, default: 0 }
  },
  gridWidth: { type: Number, default: 20 },
  gridHeight: { type: Number, default: 20 },
  unlockedTiles: { type: [String], default: [] },
  grid: { type: Array, default: [] } // { type, x, y, width, height }
});
const GameState = mongoose.model('GameState', gameStateSchema);

// ---------------------------------------------------------
// SERVER-SIDE MEMORY STATE
// ---------------------------------------------------------
const activeSessions = new Map(); // userId (string) -> { state: MongooseDoc, lastActive: Date.now() }

// Helpers to load a default state for new registrations
function getDefaultUnlockedTiles() {
  const tiles = [];
  // 10x10 starting block from (0,0) to (9,9)
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      tiles.push(`${x},${y}`);
    }
  }
  return tiles;
}

// Ensure player is loaded into memory
async function loadState(userIdStr) {
  if (activeSessions.has(userIdStr)) {
    const session = activeSessions.get(userIdStr);
    session.lastActive = Date.now();
    return session.state;
  }

  // Try to load from DB
  let state = await GameState.findOne({ userId: userIdStr });
  if (!state) {
    state = new GameState({
      userId: userIdStr,
      unlockedTiles: getDefaultUnlockedTiles()
    });
    await state.save();
  }
  activeSessions.set(userIdStr, { state, lastActive: Date.now() });
  return state;
}

// ---------------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// ---------------------------------------------------------
const authMiddleware = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ success: false, message: 'No auth token provided' });

  const token = header.split(' ')[1]; // "Bearer TOKEN"
  if (!token) return res.status(401).json({ success: false, message: 'Invalid auth token format' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: 'Failed to authenticate token' });
    req.userId = decoded.id;
    next();
  });
};

// ---------------------------------------------------------
// AUTHENTICATION ROUTES
// ---------------------------------------------------------
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ success: false, message: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 8);
    const user = new User({ username, password: hashedPassword });
    await user.save();

    // Create default state
    const state = new GameState({
      userId: user._id,
      unlockedTiles: getDefaultUnlockedTiles()
    });
    await state.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, message: 'User registered', token });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error', error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, message: 'Logged in', token });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error', error: e.message });
  }
});

// ---------------------------------------------------------
// GAME ROUTES
// ---------------------------------------------------------

app.get('/api/state', authMiddleware, async (req, res) => {
  try {
    const state = await loadState(req.userId);
    res.json(state);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error loading state' });
  }
});

app.post('/api/build', authMiddleware, async (req, res) => {
  const { type, x, y } = req.body;
  const state = await loadState(req.userId);

  const building = BUILDINGS[type];
  if (!building) {
    return res.status(400).json({ success: false, message: 'Invalid building type' });
  }

  // Basic bounds validation and unlocked tiles
  for (let bx = x; bx < x + building.width; bx++) {
    for (let by = y; by < y + building.height; by++) {
      // Allow building anywhere down the positive axis as long as it's unlocked
      if (bx < 0 || by < 0) {
        return res.status(400).json({ success: false, message: 'Building out of bounds (must be >= 0)' });
      }
      if (!state.unlockedTiles.includes(`${bx},${by}`)) {
        return res.status(400).json({ success: false, message: 'Tile is not unlocked' });
      }
    }
  }

  // Collision detection
  const isColliding = state.grid.some(b => {
    return x < b.x + b.width && x + building.width > b.x &&
      y < b.y + b.height && y + building.height > b.y;
  });

  if (isColliding) {
    return res.status(400).json({ success: false, message: 'Building collides with another building' });
  }

  if (state.money >= building.cost) {
    state.money -= building.cost;
    // Save object
    state.grid.push({ type, x, y, width: building.width, height: building.height });
    state.markModified('grid'); // Need this since grid is an array of mixed objects
    res.json({ success: true, message: 'Building placed', gameState: state });
  } else {
    res.status(400).json({ success: false, message: 'Not enough money' });
  }
});

app.post('/api/expand', authMiddleware, async (req, res) => {
  const { x, y, size = 1 } = req.body;
  const state = await loadState(req.userId);

  if (x < 0 || y < 0) {
    return res.status(400).json({ success: false, message: 'Tile out of bounds (must be >= 0)' });
  }

  // Find all tiles in the N x N block that need to be unlocked
  const tilesToUnlockKeyList = [];
  let isAdjacent = false;

  const unlockedSet = new Set(state.unlockedTiles);

  for (let bx = x; bx < x + size; bx++) {
    for (let by = y; by < y + size; by++) {
      const tileKey = `${bx},${by}`;
      if (!unlockedSet.has(tileKey)) {
        tilesToUnlockKeyList.push(tileKey);
      } else {
        // If it overlaps with an unlocked tile, it's connected implicitly!
        isAdjacent = true;
      }

      // Check adjacency for this tile
      if (!isAdjacent) {
        if (unlockedSet.has(`${bx - 1},${by}`) ||
          unlockedSet.has(`${bx + 1},${by}`) ||
          unlockedSet.has(`${bx},${by - 1}`) ||
          unlockedSet.has(`${bx},${by + 1}`)) {
          isAdjacent = true;
        }
      }
    }
  }

  if (tilesToUnlockKeyList.length === 0) {
    return res.status(400).json({ success: false, message: 'All given tiles are already unlocked' });
  }

  if (!isAdjacent) {
    return res.status(400).json({ success: false, message: 'Must expand adjacent to an unlocked tile' });
  }

  // Calculate total progressive cost for the batch
  let totalCost = 0;
  let simulatedUnlockedCount = state.unlockedTiles.length;

  for (let i = 0; i < tilesToUnlockKeyList.length; i++) {
    const expandedCount = Math.max(0, simulatedUnlockedCount - 100);
    totalCost += 50 + (expandedCount * 10);
    simulatedUnlockedCount++;
  }

  if (state.money >= totalCost) {
    state.money -= totalCost;
    state.unlockedTiles.push(...tilesToUnlockKeyList);

    // Update bounds
    state.gridWidth = Math.max(state.gridWidth, x + size);
    state.gridHeight = Math.max(state.gridHeight, y + size);

    state.markModified('unlockedTiles');

    res.json({ success: true, message: `Unlocked ${tilesToUnlockKeyList.length} tile(s)`, gameState: state });
  } else {
    res.status(400).json({ success: false, message: `Not enough money. Need $${totalCost} for this batch.` });
  }
});

// LEADERBOARD ROUTE
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Top 50 users by money
    // Try to get their username as well
    const topStates = await GameState.find()
      .sort({ money: -1 })
      .limit(50)
      .populate('userId', 'username');

    const leaderboard = topStates.map((doc, idx) => ({
      rank: idx + 1,
      username: doc.userId ? doc.userId.username : 'Unknown', // safely handle orphans
      money: doc.money,
      users: doc.users,
      modelQuality: doc.models.quality,
    }));

    res.json({ success: true, leaderboard });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error fetching leaderboard' });
  }
});

// ---------------------------------------------------------
// VISIT / PLAYER DISCOVERY ROUTES
// ---------------------------------------------------------

// GET /api/player/:username — Fetch a specific player's full state by username
app.get('/api/player/:username', authMiddleware, async (req, res) => {
  try {
    const targetUser = await User.findOne({ username: req.params.username });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    // Load their state (this also puts them in activeSessions for real-time ticking)
    const state = await loadState(targetUser._id.toString());
    res.json({
      success: true,
      username: targetUser.username,
      money: state.money,
      compute: state.compute,
      users: state.users,
      models: state.models,
      gridWidth: state.gridWidth,
      gridHeight: state.gridHeight,
      unlockedTiles: state.unlockedTiles,
      grid: state.grid
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/players — Paginated list of players for world map
app.get('/api/players', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const totalCount = await GameState.countDocuments();
    const states = await GameState.find()
      .sort({ money: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username');

    const players = states
      .filter(doc => doc.userId) // filter out orphan states
      .map(doc => ({
        username: doc.userId.username,
        money: doc.money,
        users: doc.users,
        modelQuality: doc.models.quality,
        gridSummary: {
          buildingCount: doc.grid.length,
          tileCount: doc.unlockedTiles.length
        }
      }));

    res.json({
      success: true,
      players,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/players/search?q=<query> — Search players by username
app.get('/api/players/search', authMiddleware, async (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    // Case-insensitive partial match
    const matchedUsers = await User.find({
      username: { $regex: query, $options: 'i' }
    }).limit(20);

    const userIds = matchedUsers.map(u => u._id);
    const states = await GameState.find({ userId: { $in: userIds } })
      .populate('userId', 'username');

    const players = states
      .filter(doc => doc.userId)
      .map(doc => ({
        username: doc.userId.username,
        money: doc.money,
        users: doc.users,
        modelQuality: doc.models.quality,
        gridSummary: {
          buildingCount: doc.grid.length,
          tileCount: doc.unlockedTiles.length
        }
      }));

    res.json({ success: true, players });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/players/random — Get a random player
app.get('/api/players/random', authMiddleware, async (req, res) => {
  try {
    const count = await GameState.countDocuments();
    if (count === 0) {
      return res.status(404).json({ success: false, message: 'No players found' });
    }

    const randomIndex = Math.floor(Math.random() * count);
    const randomState = await GameState.findOne()
      .skip(randomIndex)
      .populate('userId', 'username');

    if (!randomState || !randomState.userId) {
      return res.status(404).json({ success: false, message: 'No players found' });
    }

    res.json({
      success: true,
      username: randomState.userId.username,
      money: randomState.money,
      users: randomState.users,
      modelQuality: randomState.models.quality,
      gridSummary: {
        buildingCount: randomState.grid.length,
        tileCount: randomState.unlockedTiles.length
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ---------------------------------------------------------
// SERVER-SIDE TICK & PERSISTENCE
// ---------------------------------------------------------
let tickInterval;
let saveTickCounter = 0;

function startGameLoop() {
  if (tickInterval) return;
  tickInterval = setInterval(async () => {
    saveTickCounter++;
    const now = Date.now();

    for (const [userIdStr, session] of activeSessions.entries()) {
      const state = session.state;

      // Stop ticking if they haven't been active for 5 minutes
      if (now - session.lastActive > 5 * 60 * 1000) {
        await state.save();
        activeSessions.delete(userIdStr);
        continue; // skip logic for this tick
      }

      // Generate compute from servers
      let computeGained = 0;
      let usersSoldTotal = 0;
      let computeConsumedTotal = 0;
      state.grid.forEach(building => {
        const bDef = BUILDINGS[building.type];
        if (bDef) {
          computeGained += bDef.computePerTick;
          usersSoldTotal += (bDef.usersSoldPerTick || 0);
          computeConsumedTotal += bDef.computeConsumedPerTick;
        }
      });
      // Compute acts as an absolute level of computing power, not an accumulating resource
      state.compute = computeGained;

      // Auto-train model via trainer buildings using available compute level each tick
      if (computeConsumedTotal > 0) {
        // You can't consume more compute power than you have
        const actualTrain = Math.min(state.compute, computeConsumedTotal);
        // We do NOT subtract from state.compute since it is a persistent level
        // Introduce diminishing returns: as Quality gets higher, it takes exponentially more compute to improve it
        // e.g. at Quality 1 it takes 100 compute to gain 1 point. At Quality 10 it takes 10,000 compute.
        state.models.quality += (actualTrain / (100 * Math.pow(state.models.quality, 2)));
      }

      // Growth of users organically
      const userGrowth = Math.pow(state.models.quality, 1.5) * 0.1;
      state.users += userGrowth;

      // Auto-generate money via seller buildings based on user base
      // Users are the source of money but they are NOT consumed; they provide passive income
      if (usersSoldTotal > 0) {
        const actualSold = Math.min(state.users, usersSoldTotal);
        const conversionRate = 2; // Each user (up to seller capacity) generates $2/sec
        state.money += actualSold * conversionRate;
      }
    }

    // Save all active states every 5 ticks (5 seconds)
    if (saveTickCounter >= 5) {
      saveTickCounter = 0;
      for (const session of activeSessions.values()) {
        session.state.save().catch(err => console.error("Auto-save failed:", err));
      }
    }
  }, 1000);
}

function stopGameLoop() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}

// Ensure backwards compatibility with old tests if they use memory export by default
let gameState = {}; // Placeholder if tests check it directly

export { app, gameState, startGameLoop, stopGameLoop, BUILDINGS, activeSessions };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startGameLoop();
  });
}
