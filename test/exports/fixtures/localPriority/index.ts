export * from "./utils";

// Should overwrite the wildcard export
export const add = (a: number, b: number): number => {
    return a + b;
}

