export default async function handler(req, res) {
  try {
    const API_KEY = process.env.FOOTBALL_API_KEY;
    if (!API_KEY) {
      return res.status(500).json([]);
    }

    const r = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers: { "x-apisports-key": API_KEY }
      }
    );

    if (!r.ok) {
      console.error("Live API failed:", r.status);
      return res.status(500).json([]);
    }

    const data = await r.json();

    // ✅ Cache：15 秒
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=15, stale-while-revalidate=60"
    );

    res.status(200).json(data.response || []);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
}
