export default function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send("google.com, pub-1304668609520202, DIRECT, f08c47fec0942fa0\n");
}
