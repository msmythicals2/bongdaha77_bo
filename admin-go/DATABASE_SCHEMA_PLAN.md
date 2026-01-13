# 足球数据库设计方案

## 📊 新增数据库表

### 1. **leagues** - 联赛表
存储所有联赛/杯赛信息

```sql
CREATE TABLE IF NOT EXISTS leagues (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  api_id INT UNIQUE NOT NULL,           -- 外部API的league_id
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,            -- 'League', 'Cup', 'International'
  country VARCHAR(100),
  country_code VARCHAR(10),
  logo TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_api_id (api_id),
  INDEX idx_type (type),
  INDEX idx_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**更新频率**: 每周 1 次（周一凌晨 2:00）
- 联赛信息变化不频繁
- 主要是新赛季开始时更新

---

### 2. **fixtures** - 赛事表
存储所有比赛信息

```sql
CREATE TABLE IF NOT EXISTS fixtures (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  api_id INT UNIQUE NOT NULL,           -- 外部API的fixture_id
  league_id BIGINT NOT NULL,
  season INT,
  round VARCHAR(100),
  home_team_id INT,
  away_team_id INT,
  home_team_name VARCHAR(255),
  away_team_name VARCHAR(255),
  home_team_logo TEXT,
  away_team_logo TEXT,
  status VARCHAR(50),                   -- 'NS', 'TBD', '1H', 'HT', '2H', 'ET', 'P', 'FT', 'AET', 'PEN'
  status_short VARCHAR(10),
  home_goals INT,
  away_goals INT,
  fixture_date DATETIME,
  venue VARCHAR(255),
  referee VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  INDEX idx_api_id (api_id),
  INDEX idx_league_id (league_id),
  INDEX idx_fixture_date (fixture_date),
  INDEX idx_status (status),
  INDEX idx_season (season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**更新频率**:
- 未开始的比赛: 每天 1 次（凌晨 3:00）
- 进行中的比赛: 每 5 分钟
- 已结束的比赛: 每天 1 次（凌晨 3:00）

---

### 3. **fixture_events** - 赛事事件表
存储比赛中的事件（进球、黄牌、红牌等）

```sql
CREATE TABLE IF NOT EXISTS fixture_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  fixture_id BIGINT NOT NULL,
  api_event_id VARCHAR(255),
  event_type VARCHAR(50),               -- 'Goal', 'Card', 'Substitution', 'Var'
  event_minute INT,
  event_extra_minute INT,
  team_id INT,
  team_name VARCHAR(255),
  player_id INT,
  player_name VARCHAR(255),
  player_number INT,
  assist_player_id INT,
  assist_player_name VARCHAR(255),
  detail VARCHAR(255),                  -- 'Yellow Card', 'Red Card', 'Own Goal', etc.
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE,
  INDEX idx_fixture_id (fixture_id),
  INDEX idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**更新频率**: 每 5 分钟（仅更新进行中的比赛）

---

### 4. **teams** - 球队表
存储所有球队信息

```sql
CREATE TABLE IF NOT EXISTS teams (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  api_id INT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(10),
  country VARCHAR(100),
  founded INT,
  logo TEXT,
  venue_name VARCHAR(255),
  venue_city VARCHAR(255),
  venue_capacity INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_api_id (api_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**更新频率**: 每月 1 次（月初）
- 球队基本信息变化不频繁

---

### 5. **standings** - 积分榜表
存储联赛积分榜

```sql
CREATE TABLE IF NOT EXISTS standings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  league_id BIGINT NOT NULL,
  season INT,
  team_id BIGINT NOT NULL,
  rank INT,
  points INT,
  played INT,
  wins INT,
  draws INT,
  losses INT,
  goals_for INT,
  goals_against INT,
  goal_difference INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE KEY unique_league_season_team (league_id, season, team_id),
  INDEX idx_league_season (league_id, season),
  INDEX idx_rank (rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**更新频率**: 每天 2 次（凌晨 3:00 和 晚上 21:00）
- 每场比赛后积分榜会更新

---

### 6. **top_scorers** - 射手榜表
存储联赛射手榜

```sql
CREATE TABLE IF NOT EXISTS top_scorers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  league_id BIGINT NOT NULL,
  season INT,
  player_id INT,
  player_name VARCHAR(255),
  team_id BIGINT,
  team_name VARCHAR(255),
  goals INT,
  assists INT,
  player_image TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE KEY unique_league_season_player (league_id, season, player_id),
  INDEX idx_league_season (league_id, season),
  INDEX idx_goals (goals)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**更新频率**: 每天 1 次（凌晨 3:00）
- 每场比赛后更新

---

### 7. **api_sync_logs** - API同步日志表
记录每次API调用的情况

```sql
CREATE TABLE IF NOT EXISTS api_sync_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sync_type VARCHAR(100),               -- 'leagues', 'fixtures', 'events', 'teams', 'standings', 'scorers'
  status VARCHAR(50),                   -- 'success', 'failed', 'partial'
  records_synced INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  error_message TEXT,
  api_calls_made INT DEFAULT 1,
  execution_time_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sync_type (sync_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**用途**: 监控和调试API同步

---

## 📅 更新频率总结表

| 表名 | 更新频率 | 时间 | 说明 |
|------|---------|------|------|
| leagues | 每周 1 次 | 周一 02:00 | 联赛信息变化不频繁 |
| fixtures | 每天 1 次 | 凌晨 03:00 | 未开始/已结束的比赛 |
| fixtures | 每 5 分钟 | 实时 | 进行中的比赛（live） |
| fixture_events | 每 5 分钟 | 实时 | 仅更新进行中的比赛 |
| teams | 每月 1 次 | 月初 01:00 | 球队基本信息 |
| standings | 每天 2 次 | 03:00, 21:00 | 每场比赛后更新 |
| top_scorers | 每天 1 次 | 凌晨 03:00 | 每场比赛后更新 |

---

## 🔄 定时任务调度方案

### 使用 Go 的 `time.Ticker` 实现

```go
// 在 main.go 中启动定时任务
func startPollingTasks() {
  // 每周更新联赛信息（周一 02:00）
  go scheduleWeeklyTask("02:00", "Monday", syncLeagues)
  
  // 每天更新未开始/已结束的比赛（凌晨 03:00）
  go scheduleDailyTask("03:00", syncFixtures)
  
  // 每 5 分钟更新进行中的比赛
  go scheduleEveryNMinutes(5, syncLiveFixtures)
  
  // 每月更新球队信息（月初 01:00）
  go scheduleMonthlyTask("01:00", 1, syncTeams)
  
  // 每天更新积分榜（03:00 和 21:00）
  go scheduleDailyTask("03:00", syncStandings)
  go scheduleDailyTask("21:00", syncStandings)
  
  // 每天更新射手榜（凌晨 03:00）
  go scheduleDailyTask("03:00", syncTopScorers)
}
```

---

## 💡 API 配额优化

### 当前情况（无缓存）
```
100 个用户 × 10 次请求 = 1000 次 API 调用
超过免费配额 10 倍！
```

### 优化后（有定时轮询）
```
每周: 1 次 (leagues)
每天: 1 次 (fixtures) + 2 次 (standings) + 1 次 (scorers) = 4 次
每 5 分钟: 1 次 (live fixtures) = 288 次/天

总计: 1 + 4 + 288 = 293 次/天 ≈ 8,790 次/月

仍然超过免费配额，但可以：
1. 只在赛季期间启用 live 轮询
2. 升级到付费计划
3. 使用 WebSocket 实时推送（如果API支持）
```

---

## 🚀 实现步骤

### 第一阶段：创建表结构
1. 创建 `leagues`, `teams`, `fixtures` 表
2. 创建 `api_sync_logs` 表用于监控

### 第二阶段：实现基础同步
1. 实现 `syncLeagues()` 函数
2. 实现 `syncTeams()` 函数
3. 实现 `syncFixtures()` 函数

### 第三阶段：实现高级功能
1. 实现 `syncLiveFixtures()` 函数
2. 实现 `syncStandings()` 函数
3. 实现 `syncTopScorers()` 函数

### 第四阶段：优化和监控
1. 添加错误处理和重试机制
2. 添加 API 调用监控
3. 添加数据库查询优化

