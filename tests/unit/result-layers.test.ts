import { expect, test } from 'vitest';
import { Container } from 'pixi.js';
import { Renderer } from '../../apps/show/src/engine/render';

test('game score animations hide at intermission while the result HUD remains visible', () => {
  const renderer = new Renderer();
  const receipt = new Container();
  const result = new Container();
  renderer.gameLayers.hud.addChild(receipt);
  renderer.stage.hud.addChild(result);
  expect(renderer.gameLayers.hud).not.toBe(renderer.stage.hud);
  expect(renderer.gameLayers.world).toBe(renderer.stage.world);
  renderer.setIntermission(true);
  expect(renderer.gameLayers.hud.visible).toBe(false);
  expect(renderer.stage.hud.visible).toBe(true);
  renderer.setIntermission(false);
  expect(renderer.gameLayers.hud.visible).toBe(true);
  renderer.gameLayers.hud.destroy({ children: true });
  renderer.stage.hud.destroy({ children: true });
});
