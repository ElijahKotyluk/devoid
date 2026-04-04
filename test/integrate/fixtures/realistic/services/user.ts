import { formatDate } from "../utils/date";

export function getUserProfile() {
  return {
    id: "123",
    createdAt: formatDate(Date.now())
  };
}

const unusedValue = true; // should be caught as unused local
