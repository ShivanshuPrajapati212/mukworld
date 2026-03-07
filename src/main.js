import Phaser from "phaser"

class IsoScene extends Phaser.Scene {
  constructor() {
    super("IsoScene")
  }

  preload() {
    this.load.image("tile", "assets/tile.png")
  }

  create() {

    const tileWidth = 32
    const tileHeight = 16 

    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {

        const screenX = (x - y) * tileWidth / 2
        const screenY = (x + y) * tileHeight / 2

        this.add.image(
          400 + screenX,
          100 + screenY,
          "tile"
        )
      }
    }

  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: IsoScene
}

new Phaser.Game(config)
