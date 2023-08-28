export function defer(fn: any) {
  return requestAnimationFrame(fn);
}

export function cancelDefer(deferId: any) {
  cancelAnimationFrame(deferId);
}
