import RSSParser from "rss-parser";
const parser = new RSSParser();

export default async function handler(req, res) {
  try {
    const feed = await parser.parseURL(
      "https://vnexpress.net/rss/the-thao.rss"
    );

    // ✅ Cache：10 分钟
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=3600"
    );

    res.status(200).json(feed.items.slice(0, 10));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
}
