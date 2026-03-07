import './style.css' 
import Phaser from "phaser"

class IsoScene extends Phaser.Scene {
  constructor() {
    super("IsoScene")
    this.tiles = []
    this.tileWidth = 32
    this.tileHeight = 16
    this.isDragging = false
    this.lastPointerPos = { x: 0, y: 0 }
  }

  preload() {
    this.load.image("tile", "assets/tile.png")
  }

  create() {
    const mapWidth = Math.ceil(this.scale.width / this.tileWidth * 2) + 10
    const mapHeight = Math.ceil(this.scale.height / this.tileHeight * 2) + 10

    this.isoOffsetX = this.scale.width / 2
    this.isoOffsetY = 50

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const screenX = (x - y) * this.tileWidth / 2 + this.isoOffsetX
        const screenY = (x + y) * this.tileHeight / 2 + this.isoOffsetY
        
        const tile = this.add.image(screenX, screenY, "tile")
        tile.setData("gridX", x)
        tile.setData("gridY", y)
        this.tiles.push(tile)
      }
    }

    this.cameras.main.setBounds(-1000, -1000, 5000, 5000)

    this.input.on('pointerdown', (pointer) => {
      this.isDragging = true
      this.lastPointerPos = { x: pointer.x, y: pointer.y }
    })

    this.input.on('pointerup', () => {
      this.isDragging = false
    })

    this.input.on('pointermove', (pointer) => {
      if (this.isDragging) {
        const diffX = pointer.x - this.lastPointerPos.x
        const diffY = pointer.y - this.lastPointerPos.y
        this.cameras.main.scrollX -= diffX
        this.cameras.main.scrollY -= diffY
        this.lastPointerPos = { x: pointer.x, y: pointer.y }
      }
    })

    this.cameras.main.scrollX = -this.scale.width / 4
    this.cameras.main.scrollY = -this.scale.height / 4
  }

  update() {
    const cam = this.cameras.main
    const buffer = 100

    for (const tile of this.tiles) {
      const inView = 
        tile.x >= cam.scrollX - buffer &&
        tile.x <= cam.scrollX + cam.width + buffer &&
        tile.y >= cam.scrollY - buffer &&
        tile.y <= cam.scrollY + cam.height + buffer
      
      tile.setVisible(inView)
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  scene: IsoScene,
  backgroundColor: "#1a1a2e",
  scale: {
    mode: Phaser.Scale.RESIZE
  }
}

new Phaser.Game(config)
