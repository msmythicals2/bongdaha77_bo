# 双 API 系统架构文档

## 概述
本系统同时使用 **API-Football** 和 **SportMonks** 两个 API，以获得最完整和最新的足球数据。

## API 密钥配置

在 `.env` 文件中配置：
```env
FOOTBALL_API_KEY=your_api_football_key
SPORTMONKS_API_KEY=your_sportmonks_key
```

**重要**: `.env` 文件已在 `.gitignore` 中，不会上传到 Git。

## API 分工策略

### 1. API-Football 负责实时数据
- ✅ Live matches (实时比赛)
- ✅ Fixtures by date (按日期查询赛程)
- ✅ Match results (比赛结果)
- ✅ Match events (比赛事件)
- ✅ Match statistics (比赛统计)
- ✅ Live refresh (实时刷新)
- ✅ Head to head (历史交锋)
- ✅ Standings (积分榜)

### 2. SportMonks 负责数据库数据
- ✅ Teams database + team logos (球队数据库 + 队徽)
- ✅ Players database + player images (球员数据库 + 球员照片)
- ✅ Squads (球队阵容列表)
- ✅ League/Season info (联赛/赛季信息)
- ✅ Player positions and details (球员位置和详细信息)

### 3. 数据优先级策略

| 数据类型 | 优先 API | 备用 API | 说明 |
|---------|---------|---------|------|
| Live scores | API-Football | - | 实时比分最准确 |
| Match status | API-Football | - | 比赛状态最新 |
| Fixtures | API-Football | - | 赛程数据完整 |
| Team info | SportMonks | API-Football | 球队信息更详细 |
| Player info | SportMonks | API-Football | 球员照片质量更好 |
| Squads | SportMonks | API-Football | 阵容数据更完整 |
| Lineups | API-Football | - | 首发阵容实时 |

**冲突处理**: 如果两边数据有冲突，以 API-Football 的比分/状态为准。

## 缓存策略

为了降低 API 调用成本和提高响应速度，系统实现了智能缓存：

| 数据类型 | 缓存时间 | 原因 |
|---------|---------|------|
| Live matches | 15 秒 | 需要实时更新 |
| Fixtures by date | 5 分钟 | 赛程变化不频繁 |
| Teams database | 12 小时 | 球队信息稳定 |
| Players database | 12 小时 | 球员信息稳定 |
| Squads | 12 小时 | 阵容变化较少 |
| Standings | 30 分钟 | 积分榜定期更新 |
| Leagues | 24 小时 | 联赛信息很少变化 |

### 缓存管理 API

```bash
# 查看缓存统计
GET /api/cache/stats

# 清空所有缓存
GET /api/cache/clear
```

## API 端点说明

### 实时数据端点 (API-Football)

```bash
# 实时比赛
GET /api/live

# 按日期查询赛程
GET /api/fixtures?date=2025-01-16

# 比赛详情
GET /api/fixture-detail?id=12345

# 比赛事件
GET /api/fixture-events?id=12345

# 历史交锋
GET /api/h2h?h2h=33-34

# 积分榜
GET /api/standings?league=39&season=2025
```

### 数据库端点 (SportMonks → API-Football)

```bash
# 搜索球队 (优先 SportMonks)
GET /api/teams/search?name=Manchester

# 球队信息 (优先 SportMonks)
GET /api/teams/123/info

# 球队球员/阵容 (优先 SportMonks)
GET /api/teams/123/players

# 搜索球员 (优先 SportMonks)
GET /api/players/search?name=Messi
GET /api/players/search?id=12345
```

### 混合端点

```bash
# 球队赛程 (API-Football)
GET /api/teams/123/fixtures

# 球队积分榜 (API-Football)
GET /api/teams/123/standings
```

## 统一输出格式

后端统一输出格式给前端，前端不直接调用第三方 API。

### 球员数据格式示例

```json
{
  "players": [
    {
      "player": {
        "id": 12345,
        "name": "Lionel Messi",
        "firstname": "Lionel",
        "lastname": "Messi",
        "age": 36,
        "nationality": "Argentina",
        "photo": "https://..."
      },
      "statistics": [{
        "team": {
          "id": 9568,
          "name": "Inter Miami CF",
          "logo": "https://..."
        },
        "games": {
          "appearences": 20,
          "lineups": 18,
          "minutes": 1620,
          "number": 10,
          "position": "Attacker",
          "captain": true
        },
        "goals": {
          "total": 15,
          "assists": 8
        }
      }]
    }
  ],
  "season": 2025,
  "source": "sportmonks"
}
```

## API 限制

### API-Football
- 免费版: 100 requests/day
- 付费版: 根据订阅计划

### SportMonks
- 你的计划: **3000 requests/hour**
- 非常充足，适合作为主要数据源

## 成本优化建议

1. **缓存优先**: 系统已实现智能缓存，大部分请求会从缓存返回
2. **按需加载**: 只在用户请求时才调用 API
3. **批量请求**: 尽可能使用批量查询接口
4. **监控使用**: 定期检查 `/api/cache/stats` 了解缓存效率

## 错误处理

系统实现了自动降级策略：

1. 优先尝试 SportMonks API
2. 如果失败或无数据，自动降级到 API-Football
3. 如果两个都失败，返回空数组/对象
4. 所有错误都会记录到控制台

## 安全规则

✅ API keys 只存在后端 `.env` 文件
✅ `.env` 文件在 `.gitignore` 中，不会上传到 Git
✅ 前端不直接调用第三方 API
✅ 所有请求通过后端统一处理

## 测试建议

```bash
# 测试 SportMonks 球队搜索
curl "http://localhost:3000/api/teams/search?name=Manchester"

# 测试 SportMonks 球员数据
curl "http://localhost:3000/api/teams/33/players"

# 测试缓存
curl "http://localhost:3000/api/cache/stats"

# 清空缓存重新测试
curl "http://localhost:3000/api/cache/clear"
```

## 监控和调试

服务器启动时会显示：
```
===========================================
Bongdaha Server Running (Dual API System)
http://localhost:3000
===========================================
API Strategy:
- Live/Fixtures/Scores: API-Football
- Teams/Players/Squads: SportMonks → API-Football
- Cache: Live 15s, Fixtures 5m, Teams/Players 12h
===========================================
```

每个 API 调用都会在控制台输出日志，包括：
- 使用的 API 源 (SportMonks/API-Football)
- 是否从缓存返回
- 返回的数据量
- 任何错误信息

## 未来优化

1. **Redis 缓存**: 如果需要多服务器部署，可以使用 Redis 替代内存缓存
2. **请求队列**: 实现请求队列避免 API 限制
3. **数据同步**: 定期同步常用数据到本地数据库
4. **CDN 缓存**: 对静态数据（球队logo、球员照片）使用 CDN
