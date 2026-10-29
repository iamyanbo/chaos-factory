import { expect,test } from 'vitest';
import { Container } from 'pixi.js';
import { Camera } from '../../apps/show/src/engine/camera';
import { FixedLoop } from '../../apps/show/src/engine/loop';
import { Fx } from '../../apps/show/src/kit/fx';

test('full-frame fit cannot shrink a 22px marble below its readable radius',()=>{
  const layer=new Container(),camera=new Camera(layer);camera.setViewport({left:40,top:110,right:1660,bottom:1000,minZoom:1});camera.reserve({x:0,y:0,w:0,h:0});camera.fitBounds(200,-200,1720,1400);
  for(let n=0;n<120;n++)camera.update(1/60);
  expect(camera.zoom).toBeCloseTo(1,5);expect(22*camera.zoom).toBeGreaterThanOrEqual(22);layer.destroy();
});

test('a focused world point maps into the action viewport beside the depth ladder',()=>{
  const layer=new Container(),camera=new Camera(layer);camera.setViewport({left:40,top:110,right:1660,bottom:1000,minZoom:1});camera.reserve({x:0,y:0,w:0,h:0});camera.follow({x:960,y:650},1);
  camera.update(1/60);const x=(960-layer.pivot.x)*layer.scale.x+layer.x,y=(650-layer.pivot.y)*layer.scale.y+layer.y;
  expect(x).toBeCloseTo(850,5);expect(y).toBeCloseTo(555,5);layer.destroy();
});

test('presentation slow motion changes step frequency while preserving the fixed timestep',()=>{
  const fx=new Fx(),steps:number[]=[],loop=new FixedLoop(dt=>steps.push(dt),()=>{});fx.slowMo(.25,.4);loop.timeScale=fx.timeScale;
  for(let n=0;n<60;n++)loop.frame(1/60);
  expect(steps.length).toBeGreaterThanOrEqual(23);expect(steps.length).toBeLessThanOrEqual(24);expect(new Set(steps)).toEqual(new Set([1/60]));
  fx.update(.26);expect(fx.timeScale).toBe(1);fx.slowMo(.3,.3);fx.clear();expect(fx.timeScale).toBe(1);fx.destroy();
});

test('a configured webcam reservation moves the drama focus without shrinking marbles',()=>{
  const layer=new Container(),camera=new Camera(layer);camera.setViewport({left:40,top:110,right:1660,bottom:1000,minZoom:1});camera.reserve({x:1440,y:810,w:480,h:270});camera.follow({x:960,y:650},1);camera.update(1/60);
  const y=(650-layer.pivot.y)*layer.scale.y+layer.y;expect(y).toBeCloseTo(455,5);expect(camera.zoom).toBe(1);layer.destroy();
});
