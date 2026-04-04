export function getUser(id: string) {
  return { id, name: "Alice" };
}

export function createUser(name: string) {
  return { id: "new", name };
}
