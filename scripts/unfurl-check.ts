import { unfurl } from "../src/lib/unfurl";
async function main() {
  const urls = [
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://localhost:3000/",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://openstuff.co.il/",
    "https://example.com/",
    "https://example.com/file.pdf",
  ];
  for (const u of urls) {
    const t = Date.now();
    const r = await unfurl(u);
    console.log(u, "=>", JSON.stringify(r), `${Date.now() - t}ms`);
  }
}
main();
