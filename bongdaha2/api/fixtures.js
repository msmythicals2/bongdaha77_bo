export default async function handler(req, res) {
  try {
    const { date, league } = req.query;

    const API_KEY = process.env.FOOTBALL_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (league) params.append("league", league);

    // 自动 season
    const year = date
      ? new Date(date).getMonth() >= 6
        ? new Date(date).getFullYear()
        : new Date(date).getFullYear() - 1
      : new Date().getFullYear();

    params.append("season", year);

    const url = `https://v3.football.api-sports.io/fixtures?${params.toString()}`;

    const r = await fetch(url, {
      headers: { "x-apisports-key": API_KEY }
    });

    if (!r.ok) {
      console.error("Fixtures API failed:", r.status);
      return res.status(500).json([]);
    }

    const data = await r.json();

    // ✅ Cache：1 分钟
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    // ✅ 只返回 response（给 main.js 用）
    res.status(200).json(data.response || []);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
}
