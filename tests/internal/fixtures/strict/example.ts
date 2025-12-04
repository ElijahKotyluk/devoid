// Strict mode sample: typed variables & multiple declarations

function compute(a: number, b: number) {
  return a + b;
}

function neverCalled(a: number, b: number) {
  return a - b;
}

const result: number = compute(1, 2);
const neverUsed: number = 42;

export { result };
