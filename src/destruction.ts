export type DestroyType = 'building' | 'vehicle' | 'tree';

type DestroyCallback = (type: DestroyType, id: number) => void;

let callback: DestroyCallback | null = null;

export function setDestroyCallback(fn: DestroyCallback): void {
  callback = fn;
}

export function notifyDestroy(type: DestroyType, id: number): void {
  callback?.(type, id);
}
