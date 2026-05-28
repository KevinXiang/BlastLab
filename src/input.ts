export interface InputState {
  rotateLeft: boolean;
  rotateRight: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
  detonate: boolean;
  reset: boolean;
  mouseDown: boolean;
  mouseX: number;
  mouseY: number;
  rightMouseDown: boolean;
  scrollDelta: number;
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
    mouseX: 0,
    mouseY: 0,
    rightMouseDown: false,
    scrollDelta: 0,
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
