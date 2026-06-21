const assert = require('node:assert/strict');
const test = require('node:test');
const { createWindowManager } = require('../main/windowManager');

class FakeBrowserWindow {
  static instances = [];

  constructor(options) {
    this.bounds = {
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height
    };
    this.destroyed = false;
    this.visible = false;
    this.ignoreMouseEvents = false;
    this.ignoreMouseEventsCalls = [];
    this.webContents = { send: () => {} };
    FakeBrowserWindow.instances.push(this);
  }

  async loadFile() {}

  async loadURL() {}

  on() {}

  once() {}

  setAlwaysOnTop() {}

  setIgnoreMouseEvents(enabled, options) {
    this.ignoreMouseEvents = enabled;
    this.ignoreMouseEventsCalls.push({ enabled, options });
  }

  showInactive() {
    this.visible = true;
  }

  show() {
    this.visible = true;
  }

  focus() {}

  hide() {
    this.visible = false;
  }

  isVisible() {
    return this.visible;
  }

  isDestroyed() {
    return this.destroyed;
  }

  getBounds() {
    return { ...this.bounds };
  }

  setSize(width, height) {
    this.bounds.width = width;
    this.bounds.height = height;
  }

  setPosition(x, y) {
    this.bounds.x = x;
    this.bounds.y = y;
  }

  getPosition() {
    return [this.bounds.x, this.bounds.y];
  }
}

function createTestManager(workArea = { x: 0, y: 0, width: 800, height: 600 }) {
  FakeBrowserWindow.instances = [];
  return createWindowManager({
    BrowserWindow: FakeBrowserWindow,
    Menu: { buildFromTemplate: () => ({ popup: () => {} }) },
    app: { getAppPath: () => __dirname },
    screen: { getPrimaryDisplay: () => ({ workArea }) },
    preloadPath: 'preload.js',
    onMainWindowClose: () => {}
  });
}

test('wide transparent window still drags by visible character bounds', async () => {
  const manager = createTestManager();
  await manager.createMainWindow({
    isMainWindowVisible: true,
    windowPosition: { x: 20, y: 300 }
  });

  const window = FakeBrowserWindow.instances[0];
  manager.resizeMainWindow({
    width: 760,
    height: 280,
    dragBounds: { x: 12, y: 68, width: 170, height: 200 }
  });
  manager.beginDrag({ x: 0, y: 0 });
  manager.moveDrag({ x: 1000, y: 0 });

  assert.equal(window.getBounds().x, 618);
  manager.endDrag();
});

test('resize preserves the character anchor instead of clamping the whole window', async () => {
  const manager = createTestManager();
  await manager.createMainWindow({
    isMainWindowVisible: true,
    windowPosition: { x: 20, y: 300 }
  });

  const window = FakeBrowserWindow.instances[0];
  manager.resizeMainWindow({
    width: 520,
    height: 280,
    dragBounds: { x: 12, y: 68, width: 170, height: 200 }
  });
  manager.beginDrag({ x: 0, y: 0 });
  manager.moveDrag({ x: 1000, y: 0 });
  manager.endDrag();

  const before = window.getBounds();
  const characterLeft = before.x + 12;
  const characterBottom = before.y + 68 + 200;

  manager.resizeMainWindow({
    width: 760,
    height: 400,
    dragBounds: { x: 12, y: 188, width: 170, height: 200 }
  });

  const after = window.getBounds();
  assert.equal(after.x + 12, characterLeft);
  assert.equal(after.y + 188 + 200, characterBottom);
});

test('reset places the visible character at the bottom-left margin', async () => {
  const manager = createTestManager();
  await manager.createMainWindow({
    isMainWindowVisible: true,
    windowPosition: { x: 300, y: 100 }
  });

  const window = FakeBrowserWindow.instances[0];
  manager.resizeMainWindow({
    width: 760,
    height: 400,
    dragBounds: { x: 12, y: 188, width: 170, height: 200 }
  });

  const position = manager.resetMainWindowPosition();
  const bounds = window.getBounds();

  assert.deepEqual(position, { x: 8, y: 192 });
  assert.equal(bounds.x + 12, 20);
  assert.equal(bounds.y + 188 + 200, 580);
});

test('click-through cannot be enabled while a drag is active', async () => {
  const manager = createTestManager();
  await manager.createMainWindow({
    isMainWindowVisible: true,
    windowPosition: { x: 20, y: 300 }
  });

  const window = FakeBrowserWindow.instances[0];
  manager.beginDrag({ x: 10, y: 10 });
  manager.setClickThrough(true);

  assert.equal(window.ignoreMouseEvents, false);
  assert.deepEqual(window.ignoreMouseEventsCalls, []);

  manager.endDrag();
  manager.setClickThrough(true);

  assert.equal(window.ignoreMouseEvents, true);
  assert.equal(window.ignoreMouseEventsCalls.length, 1);
});

test('main window visibility changes clear click-through state', async () => {
  const manager = createTestManager();
  await manager.createMainWindow({
    isMainWindowVisible: true,
    windowPosition: { x: 20, y: 300 }
  });

  const window = FakeBrowserWindow.instances[0];
  manager.setClickThrough(true);
  manager.hideMainWindow();

  assert.equal(window.ignoreMouseEvents, false);
  assert.deepEqual(window.ignoreMouseEventsCalls.at(-1), {
    enabled: false,
    options: undefined
  });

  manager.setClickThrough(true);
  manager.showMainWindow();

  assert.equal(window.ignoreMouseEvents, false);
  assert.deepEqual(window.ignoreMouseEventsCalls.at(-1), {
    enabled: false,
    options: undefined
  });
});
