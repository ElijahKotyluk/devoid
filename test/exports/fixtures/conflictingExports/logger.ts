export default function createLogger() {
  return { log: (msg: string) => console.log(msg) };
}
