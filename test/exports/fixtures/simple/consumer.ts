// Import the math and logger fixture modules
import { add } from "./math";
import log, { debug } from "./logger";

const result = add(2, 3);
debug(`Result is ${result}`);

// Note: default export `log` is never used directly
export { result };
