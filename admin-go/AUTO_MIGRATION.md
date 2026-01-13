# 自动数据库迁移指南

## ✨ 新功能：启动时自动创建表

现在程序启动时会自动创建所有必需的数据库表，**无需手动运行 SQL 脚本**！

---

## 🚀 快速开始（只需 1 步）

### 启动程序
```bash
cd admin-go
go run main.go
```

**就这样！** 程序会自动：
1. ✅ 连接到数据库
2. ✅ 创建所有现有表（admins, articles, categories 等）
3. ✅ 创建所有足球数据表（leagues, teams, fixtures 等）
4. ✅ 创建所有索引
5. ✅ 插入初始数据
6. ✅ 启动定时任务

---

## 📊 自动创建的表

### 现有表（8 张）
- admins
- visitor_logs
- daily_stats
- realtime_stats
- articles
- uploaded_images
- categories
- ip_blacklist
- ip_whitelist

### 新增足球数据表（7 张）
- leagues - 联赛信息
- teams - 球队信息
- fixtures - 赛事信息
- fixture_events - 赛事事件
- standings - 积分榜
- top_scorers - 射手榜
- api_sync_logs - 同步日志

---

## 🔄 自动迁移流程

### 启动时执行的步骤

```
1. 加载配置
   ↓
2. 连接数据库
   ↓
3. 创建现有表（如果不存在）
   ↓
4. 创建足球数据表（如果不存在）
   ↓
5. 创建索引（如果不存在）
   ↓
6. 插入初始数据（如果表为空）
   ↓
7. 启动定时任务
   ↓
8. 监听端口
```

---

## 📝 代码实现

### 主要函数

#### `InitDB()` - 数据库初始化
```go
func InitDB() {
    // 连接数据库
    // 创建现有表
    createTables()
    
    // 创建足球数据表 ← 新增
    createFootballTables()
    
    // 插入初始数据
    seedData()
}
```

#### `createFootballTables()` - 创建足球数据表
```go
func createFootballTables() {
    // 创建 7 张足球数据表
    // 创建复合索引
    // 插入初始数据
}
```

#### `createFootballIndexes()` - 创建索引
```go
func createFootballIndexes() {
    // 创建复合索引以优化查询性能
}
```

#### `seedFootballData()` - 插入初始数据
```go
func seedFootballData() {
    // 插入主要联赛信息
    // 包括 Premier League, La Liga, Champions League 等
}
```

---

## ✅ 验证自动迁移

### 查看日志输出

启动程序时，你应该看到类似的日志：

```
Connected to MySQL database successfully
Creating football data tables...
Football data tables created successfully
Seeding initial football data...
Football data seeded successfully
Starting polling tasks...
Next weekly task scheduled at 2026-01-13 02:00:00 (in 96h45m30s)
...
Admin API Server running on port 8080
```

### 验证表创建

```sql
-- 连接到数据库后运行
SHOW TABLES;

-- 应该看到这些新表：
-- leagues, teams, fixtures, fixture_events, standings, top_scorers, api_sync_logs
```

### 验证初始数据

```sql
-- 查看初始联赛数据
SELECT * FROM leagues;

-- 应该看到 9 条记录：
-- Premier League, La Liga, Serie A, Bundesliga, Ligue 1, V.League 1, Champions League, Europa League, World Cup
```

---

## 🔧 自定义初始数据

### 修改初始联赛

编辑 `admin-go/models/db.go` 中的 `seedFootballData()` 函数：

```go
func seedFootballData() {
    leagues := []struct {
        apiID       int
        name        string
        leagueType  string
        country     string
        countryCode string
        logo        string
    }{
        // 添加或修改联赛
        {39, "Premier League", "League", "England", "GB", "..."},
        // ...
    }
    
    for _, league := range leagues {
        DB.Exec("INSERT IGNORE INTO leagues ...")
    }
}
```

---

## 🛡️ 安全性

### 表创建的安全性

所有表创建都使用 `CREATE TABLE IF NOT EXISTS`，这意味着：

✅ **幂等性** - 多次运行不会出错
✅ **安全性** - 不会覆盖现有数据
✅ **可靠性** - 即使中途失败也能恢复

### 索引创建的安全性

所有索引创建都会检查是否已存在：

```go
// 如果索引已存在，会忽略错误
_, err := DB.Exec("ALTER TABLE fixtures ADD INDEX idx_league_date ...")
if err != nil {
    log.Printf("Index creation info: %v", err)
}
```

---

## 📊 性能影响

### 首次启动
- 创建表: ~100ms
- 创建索引: ~50ms
- 插入初始数据: ~10ms
- **总计**: ~160ms

### 后续启动
- 检查表是否存在: ~10ms
- 检查数据是否存在: ~5ms
- **总计**: ~15ms

**几乎没有性能影响！**

---

## 🔄 更新现有表

### 添加新列

如果需要添加新列，在 `createFootballTables()` 中添加迁移代码：

```go
func createFootballTables() {
    // ... 创建表 ...
    
    // 添加新列（如果不存在）
    var columnExists bool
    DB.QueryRow(`
        SELECT COUNT(*) > 0 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'fixtures' 
        AND COLUMN_NAME = 'new_column'
    `).Scan(&columnExists)
    
    if !columnExists {
        DB.Exec(`ALTER TABLE fixtures ADD COLUMN new_column VARCHAR(255)`)
    }
}
```

### 修改现有列

```go
// 修改列类型
DB.Exec(`ALTER TABLE fixtures MODIFY COLUMN home_goals BIGINT`)

// 添加索引
DB.Exec(`ALTER TABLE fixtures ADD INDEX idx_new_column (new_column)`)
```

---

## 🚨 故障排除

### 问题 1：表创建失败

**症状**: 日志中出现 "Failed to create table" 错误

**解决方案**:
1. 检查数据库连接
2. 检查用户权限（需要 CREATE 权限）
3. 检查磁盘空间
4. 查看 MySQL 错误日志

### 问题 2：初始数据未插入

**症状**: `leagues` 表为空

**解决方案**:
1. 检查表是否创建成功
2. 检查 `seedFootballData()` 函数
3. 手动运行 INSERT 语句

### 问题 3：索引创建失败

**症状**: 日志中出现 "Index creation info" 消息

**解决方案**:
1. 这通常是因为索引已存在，可以忽略
2. 如果需要重新创建，先删除旧索引：
   ```sql
   ALTER TABLE fixtures DROP INDEX idx_league_date;
   ```

---

## 📈 监控迁移

### 查看迁移日志

```sql
-- 查看最近的同步日志
SELECT * FROM api_sync_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- 查看表的创建时间
SELECT TABLE_NAME, CREATE_TIME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('leagues', 'teams', 'fixtures', 'standings', 'top_scorers');
```

### 查看表统计

```sql
-- 查看各表的行数
SELECT TABLE_NAME, TABLE_ROWS 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME LIKE '%league%' 
OR TABLE_NAME LIKE '%team%' 
OR TABLE_NAME LIKE '%fixture%';
```

---

## 🎯 最佳实践

### 1. 定期备份
```bash
# 备份数据库
mysqldump -u root -p database_name > backup.sql

# 恢复数据库
mysql -u root -p database_name < backup.sql
```

### 2. 监控迁移
```go
// 在 InitDB() 中添加日志
log.Println("Database initialization started")
createTables()
log.Println("Existing tables created")
createFootballTables()
log.Println("Football tables created")
seedData()
log.Println("Data seeded")
```

### 3. 版本控制
```go
// 在 models/db.go 中添加版本号
const DB_VERSION = "1.0"

func InitDB() {
    // ...
    log.Printf("Database version: %s", DB_VERSION)
}
```

---

## 📚 相关文件

- `admin-go/models/db.go` - 数据库初始化代码
- `admin-go/main.go` - 主程序入口
- `admin-go/create_football_tables.sql` - SQL 脚本（备用）

---

## 🎉 总结

✅ **无需手动运行 SQL 脚本**
✅ **启动时自动创建所有表**
✅ **自动创建索引和初始数据**
✅ **幂等性设计，安全可靠**
✅ **性能影响极小**

**现在就启动程序吧！** 🚀

```bash
cd admin-go
go run main.go
```

所有表都会自动创建！

