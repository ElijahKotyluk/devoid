// Basic internal usage sample: some used, some unused

function usedFunction() {
  return 1;
}

function unusedFunction() {
  return 2;
}

const usedValue = usedFunction();
const unusedValue = 42;

export { usedValue };
