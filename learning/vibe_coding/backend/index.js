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
  SERVER_T1: { cost: 100, width: 1, height: 1, computePerTick: 1 },
  SERVER_T2: { cost: 500, width: 2, height: 1, computePerTick: 6 },
  DESK: { cost: 50, width: 1, height: 1, computePerTick: 0 }
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
  data: { type: Number, default: 0 },
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
  for (let x = 7; x < 12; x++) {
    for (let y = 7; y < 12; y++) {
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
      if (bx < 0 || by < 0 || bx >= state.gridWidth || by >= state.gridHeight) {
        return res.status(400).json({ success: false, message: 'Building out of bounds' });
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
  const { x, y } = req.body;
  const state = await loadState(req.userId);

  if (x < 0 || y < 0 || x >= state.gridWidth || y >= state.gridHeight) {
    return res.status(400).json({ success: false, message: 'Tile out of bounds' });
  }

  const tileKey = `${x},${y}`;
  if (state.unlockedTiles.includes(tileKey)) {
    return res.status(400).json({ success: false, message: 'Tile already unlocked' });
  }

  // Check if adjacent to an already unlocked tile
  const isAdjacent = 
    state.unlockedTiles.includes(`${x-1},${y}`) ||
    state.unlockedTiles.includes(`${x+1},${y}`) ||
    state.unlockedTiles.includes(`${x},${y-1}`) ||
    state.unlockedTiles.includes(`${x},${y+1}`);

  if (!isAdjacent) {
    return res.status(400).json({ success: false, message: 'Must expand adjacent to an unlocked tile' });
  }

  const expandedCount = Math.max(0, state.unlockedTiles.length - 25);
  const cost = 50 + (expandedCount * 10);

  if (state.money >= cost) {
    state.money -= cost;
    state.unlockedTiles.push(tileKey);
    state.markModified('unlockedTiles');
    res.json({ success: true, message: 'Tile unlocked', gameState: state });
  } else {
    res.status(400).json({ success: false, message: 'Not enough money to expand' });
  }
});

app.post('/api/train', authMiddleware, async (req, res) => {
  const { rate } = req.body;
  const state = await loadState(req.userId);
  
  if (typeof rate === 'number' && rate >= 0) {
    state.models.tps = rate;
    state.markModified('models');
    res.json({ success: true, message: `Training rate set to ${rate} compute/sec`, gameState: state });
  } else {
    res.status(400).json({ success: false, message: 'Invalid training rate' });
  }
});

app.post('/api/sell', authMiddleware, async (req, res) => {
  const state = await loadState(req.userId);
  const amount = req.body.amount || state.data; 
  
  if (amount > 0 && state.data >= amount) {
    state.data -= amount;
    const conversionRate = 2; // 1 data = $2
    state.money += amount * conversionRate; 
    
    // Explicitly force a save when selling, as it's a major event for the leaderboard
    await state.save();

    res.json({ success: true, message: 'Data sold', gameState: state });
  } else {
    res.status(400).json({ success: false, message: 'Not enough data to sell' });
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

      // Generate compute
      let computeGained = 0;
      state.grid.forEach(building => {
        const bDef = BUILDINGS[building.type];
        if (bDef) computeGained += bDef.computePerTick;
      });
      state.compute += computeGained;
      
      // Train model
      if (state.models.tps > 0) {
        const actualTrainAmt = Math.min(state.compute, state.models.tps);
        state.compute -= actualTrainAmt;
        state.models.quality += (actualTrainAmt / 100);
      }
      
      // Growth of users organically
      const userGrowth = Math.pow(state.models.quality, 1.5) * 0.1;
      state.users += userGrowth;

      // Generate data
      const dataGained = state.users * 0.5;
      state.data += dataGained;
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

export { app, gameState, startGameLoop, stopGameLoop, BUILDINGS };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startGameLoop();
  });
}
