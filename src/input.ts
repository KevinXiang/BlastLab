export interface InputState {
  rotateLeft: boolean;
  rotateRight: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
  detonate: boolean;
  reset: boolean;
  mouseDown: boolean;
  spraying: boolean;
  mouseX: number;
  mouseY: number;
  rightMouseDown: boolean;
  scrollDelta: number;
  detonateGroup1: boolean;
  detonateGroup2: boolean;
  detonateGroup3: boolean;
  togglePanel: boolean;
}

export function createInputState(): InputState {
  return {
    rotateLeft: false,
    rotateRight: false,
    zoomIn: false,
    zoomOut: false,
    detonate: false,
    reset: false,
    mouseDown: false,
    spraying: false,
    mouseX: 0,
    mouseY: 0,
    rightMouseDown: false,
    scrollDelta: 0,
    detonateGroup1: false,
    detonateGroup2: false,
    detonateGroup3: false,
    togglePanel: false,
  };
}

export function setupInput(input: InputState, canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'q': input.rotateLeft = true; break;
      case 'e': input.rotateRight = true; break;
      case '=':
      case '+': input.zoomIn = true; break;
      case '-': input.zoomOut = true; break;
      case ' ': input.detonate = true; break;
      case 'r': input.reset = true; break;
      case '1': input.detonateGroup1 = true; break;
      case '2': input.detonateGroup2 = true; break;
      case '3': input.detonateGroup3 = true; break;
      case '`': input.togglePanel = true; break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
      case 'q': input.rotateLeft = false; break;
      case 'e': input.rotateRight = false; break;
      case '=':
      case '+': input.zoomIn = false; break;
      case '-': input.zoomOut = false; break;
      case ' ': input.detonate = false; break;
      case 'r': input.reset = false; break;
      case '1': input.detonateGroup1 = false; break;
      case '2': input.detonateGroup2 = false; break;
      case '3': input.detonateGroup3 = false; break;
      case '`': input.togglePanel = false; break;
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target === canvas) input.mouseDown = true;
    if (e.button === 2) input.rightMouseDown = true;
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
    if (e.button === 2) input.rightMouseDown = false;
  });

  window.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });

  window.addEventListener('wheel', (e) => {
    input.scrollDelta += e.deltaY;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());
}
