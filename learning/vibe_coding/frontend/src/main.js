import * as Phaser from 'phaser';
import { MainScene } from './scenes/MainScene.js';

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#2d2d2d',
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.RESIZE, // Automatically resize with window
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);
