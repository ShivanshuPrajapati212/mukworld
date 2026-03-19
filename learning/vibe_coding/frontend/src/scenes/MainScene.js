import * as Phaser from 'phaser';
import { fetchState, buildInfrastructure, expandRoom, login, register, fetchLeaderboard } from '../api/index.js';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.gameState = null;
    this.mode = 'idle'; // 'idle', 'build', 'expand'
    this.buildType = null;
    this.buildWidth = 1;
    this.buildHeight = 1;
  }

  preload() {
    // Generate placeholder graphics for tiles and buildings
    this.generateIsoGraphics();
  }

  generateIsoGraphics() {
    const graphics = this.add.graphics();
    this.textureOrigins = {};
    
    // Draw base tile
    graphics.fillStyle(0x888888, 1);
    graphics.lineStyle(1, 0xaaaaaa, 1);
    this.drawIsoDiamond(graphics, TILE_WIDTH, TILE_HEIGHT);
    graphics.generateTexture('tile', TILE_WIDTH, TILE_HEIGHT);
    graphics.clear();
    this.textureOrigins['tile'] = { originX: 0.5, originY: 0 };

    // Draw locked tile
    graphics.fillStyle(0x333333, 1);
    graphics.lineStyle(1, 0x555555, 1);
    this.drawIsoDiamond(graphics, TILE_WIDTH, TILE_HEIGHT);
    graphics.generateTexture('tile-locked', TILE_WIDTH, TILE_HEIGHT);
    graphics.clear();
    this.textureOrigins['tile-locked'] = { originX: 0.5, originY: 0 };

    // Draw SERVER_T1 shape (1x1, height 40, blue)
    this.generateIsoBlockTexture('SERVER_T1', graphics, 1, 1, 40, 0x3498db);

    // Draw SERVER_T2 shape (2x1, height 40, purple)
    this.generateIsoBlockTexture('SERVER_T2', graphics, 2, 1, 40, 0x9b59b6);

    // Draw DESK shape (1x1, height 15, green)
    this.generateIsoBlockTexture('DESK', graphics, 1, 1, 15, 0x2ecc71);

    // Draw SELLER_T1 shape (1x1, height 30, warm amber)
    this.generateIsoBlockTexture('SELLER_T1', graphics, 1, 1, 30, 0xe67e22);

    // Draw SELLER_T2 shape (1x1, height 35, deep orange)
    this.generateIsoBlockTexture('SELLER_T2', graphics, 1, 1, 35, 0xd35400);

    // Draw SELLER_T3 shape (2x1, height 40, rich red-orange)
    this.generateIsoBlockTexture('SELLER_T3', graphics, 2, 1, 40, 0xc0392b);

    // Draw TRAINER_T1 shape (1x1, height 30, teal)
    this.generateIsoBlockTexture('TRAINER_T1', graphics, 1, 1, 30, 0x1abc9c);

    // Draw TRAINER_T2 shape (1x1, height 35, darker teal)
    this.generateIsoBlockTexture('TRAINER_T2', graphics, 1, 1, 35, 0x16a085);

    // Draw TRAINER_T3 shape (2x1, height 40, deep cyan)
    this.generateIsoBlockTexture('TRAINER_T3', graphics, 2, 1, 40, 0x0e6655);
  }

  generateIsoBlockTexture(key, graphics, w, h, z, baseColor) {
    graphics.clear();
    
    // Lighten and darken helpers
    const colorObj = Phaser.Display.Color.IntegerToColor(baseColor);
    const topColor = colorObj.clone().lighten(15).color;
    const leftColor = colorObj.color;
    const rightColor = colorObj.clone().darken(15).color;

    // We need to shift all coordinates by (-minX, -minY) to fit on canvas
    const minX = -h * 32;
    const minY = -z;
    const shiftX = -minX;
    const shiftY = -minY;

    const pT = { x: shiftX, y: shiftY };
    const pR = { x: w * 32 + shiftX, y: w * 16 + shiftY };
    const pB = { x: (w - h) * 32 + shiftX, y: (w + h) * 16 + shiftY };
    const pL = { x: -h * 32 + shiftX, y: h * 16 + shiftY };

    // Draw Right Face
    if (z > 0) {
      graphics.fillStyle(rightColor, 1);
      graphics.lineStyle(1, 0x000000, 0.2); // subtle border
      graphics.beginPath();
      graphics.moveTo(pR.x, pR.y);
      graphics.lineTo(pB.x, pB.y);
      graphics.lineTo(pB.x, pB.y - z);
      graphics.lineTo(pR.x, pR.y - z);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }

    // Draw Left Face
    if (z > 0) {
      graphics.fillStyle(leftColor, 1);
      graphics.lineStyle(1, 0x000000, 0.2);
      graphics.beginPath();
      graphics.moveTo(pL.x, pL.y);
      graphics.lineTo(pB.x, pB.y);
      graphics.lineTo(pB.x, pB.y - z);
      graphics.lineTo(pL.x, pL.y - z);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }

    // Draw Top Face
    graphics.fillStyle(topColor, 1);
    graphics.lineStyle(1, 0x000000, 0.2);
    graphics.beginPath();
    graphics.moveTo(pT.x, pT.y - z);
    graphics.lineTo(pR.x, pR.y - z);
    graphics.lineTo(pB.x, pB.y - z);
    graphics.lineTo(pL.x, pL.y - z);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    const texWidth = (w + h) * 32;
    const texHeight = (w + h) * 16 + z;
    
    // Generate the texture
    graphics.generateTexture(key, texWidth, texHeight);
    graphics.clear();
    
    // Store origin info so we can set it when applying the texture
    this.textureOrigins[key] = {
      originX: shiftX / texWidth,
      originY: shiftY / texHeight
    };
  }

  drawIsoDiamond(graphics, width, height) {
    graphics.beginPath();
    graphics.moveTo(width / 2, 0);
    graphics.lineTo(width, height / 2);
    graphics.lineTo(width / 2, height);
    graphics.lineTo(0, height / 2);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  async create() {
    // Basic camera setup
    this.cameras.main.setBackgroundColor('#2d2d2d');
    this.cameras.main.setZoom(1);

    this.gridGroup = this.add.group();
    this.buildingGroup = this.add.group();

    // Create a hover indicator
    this.hoverIndicator = this.add.sprite(0, 0, 'tile').setOrigin(0.5, 0).setAlpha(0.6).setDepth(100);
    this.hoverIndicator.setVisible(false);

    this.checkAuthAndInit();
  }

  async checkAuthAndInit() {
    const token = localStorage.getItem('token');
    if (!token) {
      document.getElementById('auth-overlay').style.display = 'flex';
      this.setupAuthUI();
      return;
    }

    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('leaderboard-mini').style.display = 'block';

    // Fetch initial state
    try {
      this.gameState = await fetchState();
      if (this.gameState.success === false) {
        // Token likely invalid or expired
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        this.checkAuthAndInit(); // Loop back to auth
        return;
      }
    } catch (e) {
      this.showError('Could not connect to server.');
      return;
    }

    this.drawWorld();

    // Input handlers
    this.setupInputs();

    // Setup HTML UI bindings
    this.setupUI();

    // Poll server state every 2 seconds to keep HUD updated
    this.time.addEvent({
      delay: 2000,
      callback: async () => {
        try {
          const res = await fetchState();
          if (res.success === false) return; // Silent fail on invalid auth mid-game
          
          this.gameState = res;
          this.updateHUD();
          // Ideally we'd only redraw what changed, but for now redraw world
          this.drawWorld();
          this.updateLeaderboardUI();
        } catch (e) {
          // silent fail on poll if server goes down
        }
      },
      loop: true
    });

    // Initial leaderboard load
    this.updateLeaderboardUI();
  }

  setupAuthUI() {
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const inputUser = document.getElementById('auth-username');
    const inputPass = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error');

    const handleAuth = async (action) => {
      const username = inputUser.value;
      const password = inputPass.value;
      if (!username || !password) {
        errorMsg.innerText = 'Username and password required';
        errorMsg.style.display = 'block';
        return;
      }
      try {
        const res = await (action === 'login' ? login : register)(username, password);
        if (res.success) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('username', username);
          errorMsg.style.display = 'none';
          this.checkAuthAndInit(); // Re-init
        } else {
          errorMsg.innerText = res.message;
          errorMsg.style.display = 'block';
        }
      } catch (e) {
        errorMsg.innerText = 'Server Error';
        errorMsg.style.display = 'block';
      }
    };

    btnLogin.onclick = () => handleAuth('login');
    btnRegister.onclick = () => handleAuth('register');
  }

  async updateLeaderboardUI() {
    try {
      const res = await fetchLeaderboard();
      if (!res.success) return;
      
      const lb = res.leaderboard;
      const myUsername = localStorage.getItem('username');
      
      // Update Mini
      const miniContent = document.getElementById('lb-mini-content');
      let miniHTML = '';
      for (let i = 0; i < Math.min(3, lb.length); i++) {
        miniHTML += `<div class="lb-row"><div>${i+1}. ${lb[i].username}</div><div>$${Math.floor(lb[i].money)}</div></div>`;
      }
      miniContent.innerHTML = miniHTML;
      
      const myIndex = lb.findIndex(x => x.username === myUsername);
      const myRankEl = document.getElementById('lb-my-rank');
      if (myIndex !== -1) {
        myRankEl.innerText = `Your Rank: ${myIndex + 1}`;
      } else {
        myRankEl.innerText = `Your Rank: 50+`;
      }

      // Update Full Modal if visible
      if (document.getElementById('leaderboard-full-modal').style.display === 'block') {
        const fullContent = document.getElementById('lb-full-content');
        let fullHTML = '';
        lb.forEach(row => {
          fullHTML += `<div class="lb-full-row">
            <span style="width:10%">${row.rank}</span>
            <span style="flex:1; color:${row.username===myUsername?'#4CAF50':'inherit'}">${row.username}</span>
            <span style="width:30%; text-align:right">$${Math.floor(row.money)}</span>
          </div>`;
        });
        fullContent.innerHTML = fullHTML;
      }
      
    } catch (e) {
      console.error('Failed to fetch leaderboard', e);
    }
  }

  drawWorld() {
    if (!this.gameState || !this.gameState.grid) return;

    this.gridGroup.clear(true, true);
    this.buildingGroup.clear(true, true);

    const { unlockedTiles, grid } = this.gameState;

    // Draw grid map
    unlockedTiles.forEach(tileKey => {
      const [xStr, yStr] = tileKey.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      const isoPos = this.cartesianToIsometric(x, y);
      
      const tile = this.add.sprite(isoPos.x, isoPos.y, 'tile').setOrigin(0.5, 0);
      tile.setDepth(x + y);
      this.gridGroup.add(tile);
    });

    // Sort grid by Y to render back-to-front
    this.gridGroup.children.entries.sort((a, b) => a.y - b.y);

    // Draw buildings
    grid.forEach(b => {
      const isoPos = this.cartesianToIsometric(b.x, b.y);
      const origin = this.textureOrigins[b.type] || { originX: 0.5, originY: 1 };
      const buildingSprite = this.add.sprite(isoPos.x, isoPos.y, b.type).setOrigin(origin.originX, origin.originY);
      // Adjust depth so it overlays tiles correctly
      buildingSprite.setDepth(b.x + b.width + b.y + b.height + 1);
      this.buildingGroup.add(buildingSprite);
    });

    this.updateHUD();
  }

  cartesianToIsometric(x, y) {
    return {
      x: (x - y) * (TILE_WIDTH / 2),
      y: (x + y) * (TILE_HEIGHT / 2)
    };
  }

  isometricToCartesian(screenX, screenY) {
    return {
      x: Math.floor((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2),
      y: Math.floor((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2)
    };
  }

  setupInputs() {
    this.input.mouseGroup = this.add.group();
    
    // Zooming
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      const zoomValue = this.cameras.main.zoom - (deltaY * 0.001);
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoomValue, 0.5, 2));
    });

    // Panning (Drag)
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      // If we are in build/expand mode, don't pan on drag
      if (this.mode !== 'idle') return;

      this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
    });

    // Hover
    this.input.on('pointermove', (pointer) => {
      if (this.mode === 'idle') {
        this.hoverIndicator.setVisible(false);
        return;
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cartPos = this.isometricToCartesian(worldPoint.x, worldPoint.y);
      
      const isoPos = this.cartesianToIsometric(cartPos.x, cartPos.y);
      this.hoverIndicator.setPosition(isoPos.x, isoPos.y);
      this.hoverIndicator.setVisible(true);

      if (this.mode === 'build') {
        // Change graphic depending on build size (using scaling or different texture)
        this.hoverIndicator.setTexture(this.buildType);
        const origin = this.textureOrigins[this.buildType] || { originX: 0.5, originY: 1 };
        this.hoverIndicator.setOrigin(origin.originX, origin.originY);
        this.hoverIndicator.setScale(1);
        this.hoverIndicator.setDepth(1000); // always on top
        
        let isValid = this.isValidPlacement(cartPos.x, cartPos.y, this.buildWidth, this.buildHeight);
        this.hoverIndicator.setTint(isValid ? 0x00ff00 : 0xff0000);
      } else if (this.mode === 'expand') {
        this.hoverIndicator.setTexture('tile');
        this.hoverIndicator.setOrigin(0.5, 0);
        this.hoverIndicator.setScale(1);
        this.hoverIndicator.setDepth(1000);
        
        let isValid = this.isValidExpansion(cartPos.x, cartPos.y);
        this.hoverIndicator.setTint(isValid ? 0x00ff00 : 0xff0000);
      }
    });

    // Click to place
    this.input.on('pointerdown', async (pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cartPos = this.isometricToCartesian(worldPoint.x, worldPoint.y);

      if (this.mode === 'idle') {
        if (!this.gameState) return;
        const clickedBuilding = this.gameState.grid.find(b => {
          return cartPos.x >= b.x && cartPos.x < b.x + b.width &&
                 cartPos.y >= b.y && cartPos.y < b.y + b.height;
        });

        const infoPanel = document.getElementById('info-panel');
        if (clickedBuilding) {
           const infoTitle = document.getElementById('info-title');
           const infoDesc = document.getElementById('info-desc');
           infoTitle.innerText = `${clickedBuilding.type.replace('_', ' ')}`;
           infoDesc.innerText = `Position: (${clickedBuilding.x}, ${clickedBuilding.y})\nDimensions: ${clickedBuilding.width}x${clickedBuilding.height}`;
           infoPanel.style.display = 'block';
        } else {
           if (infoPanel) infoPanel.style.display = 'none';
        }
        return;
      }
      
      if (this.mode === 'build') {
        if (!this.isValidPlacement(cartPos.x, cartPos.y, this.buildWidth, this.buildHeight)) {
          this.showError('Invalid placement or insufficient funds');
          return;
        }

        try {
          const res = await buildInfrastructure(this.buildType, cartPos.x, cartPos.y);
          if (res.success) {
            this.gameState = res.gameState;
            this.drawWorld();
          } else {
            this.showError(res.message);
          }
        } catch (e) {
          this.showError('Server Error');
        }
      } else if (this.mode === 'expand') {
        if (!this.isValidExpansion(cartPos.x, cartPos.y)) {
          this.showError('Invalid expansion or insufficient funds');
          return;
        }

        try {
          const res = await expandRoom(cartPos.x, cartPos.y);
          if (res.success) {
            this.gameState = res.gameState;
            this.drawWorld();
          } else {
            this.showError(res.message);
          }
        } catch (e) {
          this.showError('Server Error');
        }
      }
    });
  }

  isValidPlacement(x, y, w, h) {
    if (!this.gameState) return false;
    // Check bounds
    if (x < 0 || y < 0) return false;
    
    // Check unlocked
    for (let bx = x; bx < x + w; bx++) {
      for (let by = y; by < y + h; by++) {
        if (!this.gameState.unlockedTiles.includes(`${bx},${by}`)) return false;
      }
    }
    
    // Check collision
    const isColliding = this.gameState.grid.some(b => {
      return x < b.x + b.width && x + w > b.x &&
             y < b.y + b.height && y + h > b.y;
    });

    if (isColliding) return false;
    return true;
  }

  isValidExpansion(x, y) {
    if (!this.gameState) return false;
    if (x < 0 || y < 0) return false;
    if (this.gameState.unlockedTiles.includes(`${x},${y}`)) return false;
    
    const isAdjacent = 
      this.gameState.unlockedTiles.includes(`${x-1},${y}`) ||
      this.gameState.unlockedTiles.includes(`${x+1},${y}`) ||
      this.gameState.unlockedTiles.includes(`${x},${y-1}`) ||
      this.gameState.unlockedTiles.includes(`${x},${y+1}`);
      
    return isAdjacent;
  }

  update(time, delta) {
    // Camera movement is handled by mouse drag in setupInputs()
  }

  showError(msg) {
    const popup = document.getElementById('error-popup');
    if (!popup) return;
    popup.innerText = msg;
    popup.style.display = 'block';
    popup.style.opacity = 1;
    
    if (this.errorTimeout) clearTimeout(this.errorTimeout);
    this.errorTimeout = setTimeout(() => {
      popup.style.opacity = 0;
      setTimeout(() => popup.style.display = 'none', 300);
    }, 3000);
  }

  updateHUD() {
    if (!this.gameState) return;
    const moneyEl = document.getElementById('hud-money');
    const computeEl = document.getElementById('hud-compute');
    const dataEl = document.getElementById('hud-data');
    const usersEl = document.getElementById('hud-users');
    const qualityEl = document.getElementById('hud-quality');

    if (moneyEl) moneyEl.innerText = `Money: $${Math.floor(this.gameState.money)}`;
    if (computeEl) computeEl.innerText = `Compute: ${Math.floor(this.gameState.compute)}`;
    if (usersEl) usersEl.innerText = `Users: ${Math.floor(this.gameState.users)}`;
    if (qualityEl) qualityEl.innerText = `Quality: ${this.gameState.models.quality.toFixed(2)}`;
  }

  setupUI() {
    const btnCancel = document.getElementById('btn-cancel');
    const btnBuildS1 = document.getElementById('btn-build-server1');
    const btnBuildS2 = document.getElementById('btn-build-server2');
    const btnBuildDesk = document.getElementById('btn-build-desk');
    const btnBuildSeller1 = document.getElementById('btn-build-seller1');
    const btnBuildSeller2 = document.getElementById('btn-build-seller2');
    const btnBuildSeller3 = document.getElementById('btn-build-seller3');
    const btnBuildTrainer1 = document.getElementById('btn-build-trainer1');
    const btnBuildTrainer2 = document.getElementById('btn-build-trainer2');
    const btnBuildTrainer3 = document.getElementById('btn-build-trainer3');
    const btnExpand = document.getElementById('btn-expand');
    
    const allBtns = [btnCancel, btnBuildS1, btnBuildS2, btnBuildDesk, btnBuildSeller1, btnBuildSeller2, btnBuildSeller3, btnBuildTrainer1, btnBuildTrainer2, btnBuildTrainer3, btnExpand];

    const setMode = (mode, buildType = null, w = 1, h = 1) => {
      this.mode = mode;
      this.buildType = buildType;
      this.buildWidth = w;
      this.buildHeight = h;
      this.hoverIndicator.setVisible(false);

      allBtns.forEach(b => { if (b) b.classList.remove('active'); });
    };

    btnCancel.onclick = () => { setMode('idle'); btnCancel.classList.add('active'); };
    btnBuildS1.onclick = () => { setMode('build', 'SERVER_T1', 1, 1); btnBuildS1.classList.add('active'); };
    btnBuildS2.onclick = () => { setMode('build', 'SERVER_T2', 2, 1); btnBuildS2.classList.add('active'); };
    btnBuildDesk.onclick = () => { setMode('build', 'DESK', 1, 1); btnBuildDesk.classList.add('active'); };
    if (btnBuildSeller1) btnBuildSeller1.onclick = () => { setMode('build', 'SELLER_T1', 1, 1); btnBuildSeller1.classList.add('active'); };
    if (btnBuildSeller2) btnBuildSeller2.onclick = () => { setMode('build', 'SELLER_T2', 1, 1); btnBuildSeller2.classList.add('active'); };
    if (btnBuildSeller3) btnBuildSeller3.onclick = () => { setMode('build', 'SELLER_T3', 2, 1); btnBuildSeller3.classList.add('active'); };
    if (btnBuildTrainer1) btnBuildTrainer1.onclick = () => { setMode('build', 'TRAINER_T1', 1, 1); btnBuildTrainer1.classList.add('active'); };
    if (btnBuildTrainer2) btnBuildTrainer2.onclick = () => { setMode('build', 'TRAINER_T2', 1, 1); btnBuildTrainer2.classList.add('active'); };
    if (btnBuildTrainer3) btnBuildTrainer3.onclick = () => { setMode('build', 'TRAINER_T3', 2, 1); btnBuildTrainer3.classList.add('active'); };
    btnExpand.onclick = () => { setMode('expand'); btnExpand.classList.add('active'); };

    const btnInfoClose = document.getElementById('btn-info-close');
    const btnInfoUpgrade = document.getElementById('btn-info-upgrade');
    const infoPanel = document.getElementById('info-panel');

    const btnShowFullLb = document.getElementById('btn-show-full-lb');
    const btnCloseLb = document.getElementById('btn-close-lb');
    const fullLbModal = document.getElementById('leaderboard-full-modal');

    if (btnShowFullLb) {
      btnShowFullLb.onclick = () => {
        fullLbModal.style.display = 'block';
        this.updateLeaderboardUI();
      };
    }
    if (btnCloseLb) {
      btnCloseLb.onclick = () => {
        fullLbModal.style.display = 'none';
      };
    }

    if (btnInfoClose) {
      btnInfoClose.onclick = () => {
        if (infoPanel) infoPanel.style.display = 'none';
      };
    }

    if (btnInfoUpgrade) {
      btnInfoUpgrade.onclick = () => {
        this.showError('Upgrade action not implemented in backend yet.');
      };
    }
  }
}
