import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory game state
let gameState = {
  money: 500,
  compute: 0,
  data: 0,
  users: 0,
  grid: [] // will represent buildings placed
};

app.get('/api/state', (req, res) => {
  res.json(gameState);
});

// For testing purposes
export { app, gameState };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
