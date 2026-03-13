import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Building dictionary with sizes and costs
const BUILDINGS = {
  SERVER_T1: { cost: 100, width: 1, height: 1, computePerTick: 1 },
  SERVER_T2: { cost: 500, width: 2, height: 1, computePerTick: 6 },
  DESK: { cost: 50, width: 1, height: 1, computePerTick: 0 }
};

// In-memory game state
let gameState = {
  money: 500,
  compute: 0,
  data: 0,
  users: 0,
  models: { quality: 1, name: 'Basic Model', tps: 0 }, // tps = training per second
  gridWidth: 20,
  gridHeight: 20,
  grid: [] // will represent buildings placed
};

app.get('/api/state', (req, res) => {
  res.json(gameState);
});

app.post('/api/build', (req, res) => {
  const { type, x, y } = req.body;
  
  const building = BUILDINGS[type];
  if (!building) {
    return res.status(400).json({ success: false, message: 'Invalid building type' });
  }

  // Basic bounds validation
  if (x < 0 || y < 0 || x + building.width > gameState.gridWidth || y + building.height > gameState.gridHeight) {
    return res.status(400).json({ success: false, message: 'Building out of bounds' });
  }
  
  // TODO: Add collision detection with other buildings later

  if (gameState.money >= building.cost) {
    gameState.money -= building.cost;
    gameState.grid.push({ type, x, y, width: building.width, height: building.height });
    res.json({ success: true, message: 'Building placed', gameState });
  } else {
    res.status(400).json({ success: false, message: 'Not enough money' });
  }
});

app.post('/api/train', (req, res) => {
  const { rate } = req.body; // Set a desired training rate per second
  
  if (typeof rate === 'number' && rate >= 0) {
    gameState.models.tps = rate;
    res.json({ success: true, message: `Training rate set to ${rate} compute/sec`, gameState });
  } else {
    res.status(400).json({ success: false, message: 'Invalid training rate' });
  }
});

app.post('/api/sell', (req, res) => {
  const amount = req.body.amount || gameState.data; // default to selling all if amount not provided
  
  if (amount > 0 && gameState.data >= amount) {
    gameState.data -= amount;
    const conversionRate = 2; // 1 data = $2
    gameState.money += amount * conversionRate; 
    res.json({ success: true, message: 'Data sold', gameState });
  } else {
    res.status(400).json({ success: false, message: 'Not enough data to sell' });
  }
});

// Game Loop (Server-Side Tick)
let tickInterval;
function startGameLoop() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    // Generate compute from servers in the grid
    let computeGained = 0;
    gameState.grid.forEach(building => {
      const bDef = BUILDINGS[building.type];
      if (bDef) {
        computeGained += bDef.computePerTick;
      }
    });
    gameState.compute += computeGained;
    
    // Train model (consume compute)
    if (gameState.models.tps > 0) {
      const actualTrainAmt = Math.min(gameState.compute, gameState.models.tps);
      gameState.compute -= actualTrainAmt;
      // 100 compute = 1 quality point
      gameState.models.quality += (actualTrainAmt / 100);
    }
    
    // Growth of users organically based on model quality
    // Example: (Quality ^ 1.5) * 0.1 new users per second
    const userGrowth = Math.pow(gameState.models.quality, 1.5) * 0.1;
    gameState.users += userGrowth;

    // Generate data from users
    // Example: each user gives 0.5 data per second
    const dataGained = gameState.users * 0.5;
    gameState.data += dataGained;
  }, 1000);
}

function stopGameLoop() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}

// For testing purposes
export { app, gameState, startGameLoop, stopGameLoop, BUILDINGS };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startGameLoop();
  });
}
