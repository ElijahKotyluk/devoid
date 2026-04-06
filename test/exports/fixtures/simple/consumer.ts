// Import the math and logger fixture modules
import { debug } from "./logger";
import { add } from "./math";

const result = add(2, 3);
debug(`Result is ${result}`);

// Note: default export `log` is never used directly
export { result };
