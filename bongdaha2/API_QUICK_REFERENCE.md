# API 快速参考指南

## 双 API 系统概览

```
┌─────────────────────────────────────────────────────────┐
│                    前端应用                              │
│              (不直接调用第三方 API)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  后端服务器                              │
│              (统一 API 接口)                             │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────┐
│   API-Football       │   │   SportMonks         │
│   (实时数据)         │   │   (数据库数据)       │
│                      │   │                      │
│ • Live matches       │   │ • Teams database     │
│ • Fixtures           │   │ • Players database   │
│ • Match events       │   │ • Squads             │
│ • Standings          │   │ • Player images      │
│ • H2H                │   │ • Team logos         │
└──────────────────────┘   └──────────────────────┘
```

## API 端点映射

### 🔴 实时数据 (API-Football Only)

| 端点 | 用途 | 缓存 |
|------|------|------|
| `GET /api/live` | 实时比赛 | 15秒 |
| `GET /api/fixtures?date=YYYY-MM-DD` | 按日期查询赛程 | 5分钟 |
| `GET /api/fixture-detail?id=123` | 比赛详情 | 无 |
| `GET /api/fixture-events?id=123` | 比赛事件 | 无 |
| `GET /api/h2h?h2h=33-34` | 历史交锋 | 无 |

### 🟢 数据库数据 (SportMonks → API-Football)

| 端点 | 用途 | 优先 API | 缓存 |
|------|------|---------|------|
| `GET /api/teams/search?name=xxx` | 搜索球队 | SportMonks | 12小时 |
| `GET /api/teams/:id/info` | 球队详情 | SportMonks | 12小时 |
| `GET /api/teams/:id/players` | 球队球员 | SportMonks | 12小时 |
| `GET /api/players/search?name=xxx` | 搜索球员 | SportMonks | 无 |

### 🟡 混合数据

| 端点 | 用途 | API | 缓存 |
|------|------|-----|------|
| `GET /api/teams/:id/fixtures` | 球队赛程 | API-Football | 无 |
| `GET /api/teams/:id/standings` | 球队积分榜 | API-Football | 无 |
| `GET /api/standings?league=39&season=2025` | 联赛积分榜 | API-Football | 30分钟 |

### 🔧 系统工具

| 端点 | 用途 |
|------|------|
| `GET /api/cache/stats` | 查看缓存统计 |
| `GET /api/cache/clear` | 清空所有缓存 |
| `GET /api/config` | 获取系统配置 |

## 数据源优先级

### 场景 1: 用户搜索球队
```
1. 前端调用: GET /api/teams/search?name=Manchester
2. 后端尝试: SportMonks API
3. 如果成功: 返回 SportMonks 数据 (高质量队徽)
4. 如果失败: 自动 fallback 到 API-Football
5. 响应包含: { teams: [...], source: 'sportmonks' }
```

### 场景 2: 用户查看球队球员
```
1. 前端调用: GET /api/teams/9568/players
2. 后端尝试: SportMonks Squads API
3. 如果成功: 返回 SportMonks 数据 (完整阵容 + 球员照片)
4. 如果失败: 尝试 API-Football 2025 season
5. 如果数据少: 自动 fallback 到 2024 season
6. 响应包含: { players: [...], season: 2025, source: 'sportmonks' }
```

### 场景 3: 用户查看实时比赛
```
1. 前端调用: GET /api/live
2. 后端调用: API-Football (唯一数据源)
3. 检查缓存: 如果15秒内有缓存，直接返回
4. 如果无缓存: 调用 API-Football
5. 过滤数据: 只返回真实的 Live 比赛
6. 设置缓存: 15秒 TTL
```

## 缓存策略详解

### 为什么需要缓存？
- 降低 API 调用成本
- 提高响应速度
- 避免超过 API 限制 (SportMonks: 3000/hour)

### 缓存时间设计

| 数据类型 | TTL | 原因 |
|---------|-----|------|
| Live matches | 15秒 | 比分变化快，需要准实时 |
| Fixtures | 5分钟 | 赛程基本固定，偶尔变化 |
| Teams | 12小时 | 球队信息很少变化 |
| Players | 12小时 | 球员信息稳定 |
| Squads | 12小时 | 阵容变化较少 |
| Standings | 30分钟 | 积分榜每轮更新 |
| Leagues | 24小时 | 联赛信息几乎不变 |

### 缓存键格式
```javascript
// 示例
"live:{}"
"fixtures:{\"date\":\"2025-01-16\"}"
"team-search:{\"name\":\"Manchester\"}"
"team-players:{\"id\":\"9568\",\"season\":\"2025\"}"
```

## API 响应格式

### 球队搜索响应
```json
[
  {
    "team": {
      "id": 9568,
      "name": "Inter Miami CF",
      "code": "MIA",
      "country": "USA",
      "founded": 2018,
      "logo": "https://..."
    },
    "venue": {
      "id": 1234,
      "name": "DRV PNK Stadium",
      "city": "Fort Lauderdale"
    }
  }
]
```

### 球员数据响应
```json
{
  "players": [
    {
      "player": {
        "id": 154,
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

## 错误处理

### 自动降级策略
```
SportMonks 失败
    ↓
尝试 API-Football
    ↓
如果也失败
    ↓
返回空数组/对象
    ↓
应用不会崩溃
```

### 错误日志
所有错误都会记录在服务器控制台：
```
SportMonks API error (/teams/search/Manchester): Request failed
API-Football error (/teams): Network timeout
```

## 性能优化建议

### 1. 预加载常用数据
```javascript
// 应用启动时预加载热门球队
const popularTeams = [33, 9568, 529, 541, 50];
popularTeams.forEach(id => {
  fetch(`/api/teams/${id}/info`);
  fetch(`/api/teams/${id}/players`);
});
```

### 2. 批量请求
```javascript
// 不好: 逐个请求
teams.forEach(id => fetch(`/api/teams/${id}/info`));

// 好: 使用 Promise.all
await Promise.all(
  teams.map(id => fetch(`/api/teams/${id}/info`))
);
```

### 3. 监控缓存效率
```javascript
// 定期检查缓存命中率
setInterval(async () => {
  const stats = await fetch('/api/cache/stats').then(r => r.json());
  console.log('Cache size:', stats.size);
}, 60000);
```

## 测试清单

- [ ] 搜索球队 (Manchester, Real Madrid, Barcelona)
- [ ] 查看球队详情 (Inter Miami CF, Al-Nassr)
- [ ] 查看球员列表 (验证 Messi, Ronaldo 出现)
- [ ] 搜索球员 (Messi, Ronaldo, Neymar)
- [ ] 查看实时比赛
- [ ] 查看赛程
- [ ] 查看积分榜
- [ ] 检查缓存统计
- [ ] 清空缓存后重新测试

## 监控指标

### 每小时 API 调用估算

假设 100 个活跃用户：
- 查看首页: 1 次 live API (缓存15秒) = ~240 calls/hour
- 搜索球队: 10 次 (缓存12小时) = ~10 calls/hour
- 查看球员: 20 次 (缓存12小时) = ~20 calls/hour
- 查看赛程: 30 次 (缓存5分钟) = ~360 calls/hour

**总计**: ~630 calls/hour (远低于 3000 限制)

## 故障排除

### 问题: SportMonks 返回空数据
```bash
# 1. 检查 API Key
echo $SPORTMONKS_API_KEY

# 2. 清空缓存
curl http://localhost:3000/api/cache/clear

# 3. 重新测试
curl "http://localhost:3000/api/teams/search?name=Manchester"
```

### 问题: 球员数据不完整
```bash
# 1. 检查数据源
curl "http://localhost:3000/api/teams/9568/players" | grep source

# 2. 如果是 api-football，检查 SportMonks
# 查看服务器日志，应该有 "SportMonks failed" 消息

# 3. 手动测试 SportMonks
curl "https://api.sportmonks.com/v3/football/squads/seasons/2025/teams/9568?api_token=YOUR_KEY"
```

### 问题: 超过 API 限制
```bash
# 1. 检查缓存使用
curl http://localhost:3000/api/cache/stats

# 2. 增加缓存时间 (在 server.js 中)
const CACHE_TTL = {
  TEAMS: 86400,  // 从 12小时 增加到 24小时
  PLAYERS: 86400
};
```

## 相关文档

- `DUAL_API_SYSTEM.md` - 完整系统架构
- `SPORTMONKS_SETUP.md` - 设置指南
- `test_sportmonks.html` - 测试工具
