import * as Controllers from "./index";

export function buildRoutes() {
  const user = Controllers.getUser("123");
  const created = Controllers.createUser(user.name);
  
  return { user, created };
}
