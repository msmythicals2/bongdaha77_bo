export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Missing fixture id" });
  }

  try {
    const url = `https://v3.football.api-sports.io/fixtures?id=${id}`;

    const r = await fetch(url, {
      headers: {
        "x-apisports-key": process.env.FOOTBALL_API_KEY
      }
    });

    if (!r.ok) {
      return res.status(r.status).json({ error: "API request failed" });
    }

    const json = await r.json();
    res.status(200).json(json);

  } catch (err) {
    console.error("fixture-detail error", err);
    res.status(500).json({ error: "Server error" });
  }
}
