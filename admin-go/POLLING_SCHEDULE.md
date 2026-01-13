# 定时任务调度表

## 📅 每日任务时间表

```
时间          任务                    频率        说明
─────────────────────────────────────────────────────────────
01:00         syncTeams              月初        球队信息更新
02:00         syncLeagues            周一        联赛信息更新
03:00         syncFixtures           每天        未开始/已结束比赛
03:00         syncStandings          每天        积分榜更新
03:00         syncTopScorers         每天        射手榜更新
每 5 分钟      syncLiveFixtures       实时        进行中的比赛
21:00         syncStandings          每天        积分榜更新（晚间）
```

---

## 🎯 按优先级排序

### 高优先级（必须）
1. **syncLiveFixtures** - 每 5 分钟
   - 用户最关心的实时数据
   - 影响用户体验

2. **syncFixtures** - 每天 03:00
   - 比赛基本信息
   - 用于显示赛程

### 中优先级（重要）
3. **syncStandings** - 每天 03:00 和 21:00
   - 积分榜数据
   - 用于显示排名

4. **syncTopScorers** - 每天 03:00
   - 射手榜数据
   - 用于显示统计

### 低优先级（可选）
5. **syncLeagues** - 每周一 02:00
   - 联赛信息
   - 变化不频繁

6. **syncTeams** - 月初 01:00
   - 球队信息
   - 变化不频繁

---

## 📊 API 调用成本分析

### 按任务分类

| 任务 | 调用次数/天 | 调用次数/月 | 说明 |
|------|-----------|-----------|------|
| syncLeagues | 0.14 | 1 | 周一 1 次 |
| syncTeams | 0.03 | 1 | 月初 1 次 |
| syncFixtures | 1 | 30 | 每天 1 次 |
| syncLiveFixtures | 288 | 8,640 | 每 5 分钟（赛季期间） |
| syncStandings | 2 | 60 | 每天 2 次 |
| syncTopScorers | 1 | 30 | 每天 1 次 |
| **总计（赛季）** | **292.17** | **8,762** | |
| **总计（非赛季）** | **4.17** | **122** | |

### 成本优化建议

#### 方案 A：基础版（推荐）
- 禁用 syncLiveFixtures
- 成本: 4.17 次/天 = 125 次/月
- 适合: 免费计划

#### 方案 B：标准版
- 启用 syncLiveFixtures（仅赛季期间）
- 成本: 292 次/天（赛季）= 8,760 次/月
- 适合: 基础付费计划（1,000 次/月）

#### 方案 C：高级版
- 启用所有功能
- 启用 Redis 缓存
- 成本: 292 次/天（赛季）= 8,760 次/月
- 适合: 专业付费计划（10,000 次/月）

---

## 🔧 配置调整

### 禁用 Live 轮询

在 `handlers/polling.go` 中注释掉：

```go
// go scheduleEveryNMinutes(5, syncLiveFixtures)
```

### 调整轮询频率

修改 `scheduleEveryNMinutes` 的参数：

```go
// 从 5 分钟改为 10 分钟
go scheduleEveryNMinutes(10, syncLiveFixtures)

// 从 5 分钟改为 1 分钟
go scheduleEveryNMinutes(1, syncLiveFixtures)
```

### 调整任务时间

修改 `scheduleDailyTask` 的时间参数：

```go
// 从 03:00 改为 04:00
go scheduleDailyTask("04:00", syncFixtures)

// 从 21:00 改为 22:00
go scheduleDailyTask("22:00", syncStandings)
```

---

## 📈 性能指标

### 预期性能

| 指标 | 值 | 说明 |
|------|-----|------|
| 平均响应时间 | 50-100ms | 从数据库读取 |
| 最大响应时间 | 500ms | 包括网络延迟 |
| 数据库查询时间 | 10-50ms | 优化后 |
| API 调用时间 | 500-2000ms | 外部 API |

### 监控指标

```sql
-- 查看平均执行时间
SELECT sync_type, AVG(execution_time_ms) as avg_time
FROM api_sync_logs
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY sync_type;

-- 查看成功率
SELECT sync_type, 
       SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
       ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as success_rate
FROM api_sync_logs
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY sync_type;
```

---

## 🚨 告警规则

### 建议的告警阈值

| 告警类型 | 阈值 | 说明 |
|---------|------|------|
| 同步失败 | 连续 3 次失败 | 可能的 API 问题 |
| 执行时间 | > 5000ms | 性能下降 |
| 数据延迟 | > 1 小时 | 数据不是最新的 |
| API 错误率 | > 10% | API 服务不稳定 |

### 告警实现

```go
func checkSyncHealth() {
    // 检查最近的同步状态
    var lastSync struct {
        SyncType string
        Status   string
        CreatedAt time.Time
    }
    
    // 如果最后一次同步失败，发送告警
    if lastSync.Status == "failed" {
        sendAlert("Sync failed for " + lastSync.SyncType)
    }
    
    // 如果最后一次同步超过 1 小时，发送告警
    if time.Since(lastSync.CreatedAt) > 1*time.Hour {
        sendAlert("Sync data is stale for " + lastSync.SyncType)
    }
}
```

---

## 📝 日志示例

### 成功的同步日志

```
2026-01-09 03:00:00 Starting syncFixtures...
2026-01-09 03:00:05 Completed syncFixtures
2026-01-09 03:00:05 Synced 45 fixtures in 5 seconds
```

### 失败的同步日志

```
2026-01-09 03:00:00 Starting syncFixtures...
2026-01-09 03:00:30 Error: API request failed: 429 Too Many Requests
2026-01-09 03:00:30 Sync failed, will retry in 5 minutes
```

---

## 🔄 故障恢复

### 自动重试机制

```go
func syncWithRetry(syncFunc func(), maxRetries int) {
    for i := 0; i < maxRetries; i++ {
        err := syncFunc()
        if err == nil {
            return
        }
        
        // 指数退避
        backoff := time.Duration(math.Pow(2, float64(i))) * time.Minute
        log.Printf("Retry in %v", backoff)
        time.Sleep(backoff)
    }
}
```

### 手动触发同步

```go
// 在 handlers 中添加手动触发端点
func TriggerSync(c *gin.Context) {
    syncType := c.Query("type") // "fixtures", "standings", etc.
    
    switch syncType {
    case "fixtures":
        go syncFixtures()
    case "standings":
        go syncStandings()
    // ...
    }
    
    c.JSON(200, gin.H{"message": "Sync triggered"})
}
```

---

## 📞 支持

如有问题，请查看：
1. `IMPLEMENTATION_GUIDE.md` - 详细实现指南
2. `DATABASE_SCHEMA_PLAN.md` - 数据库设计
3. `api_sync_logs` 表 - 同步日志

