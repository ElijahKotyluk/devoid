export type UsedExported = { id: string };
export type UnusedExported = { nope: true };

type UsedLocal = number;
type UnusedLocal = { x: 1 };

export type Wrapper = UsedLocal;
