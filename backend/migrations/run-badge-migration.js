// backend/migrations/run-badge-migration.js
// Скрипт для запуска миграции системы плашек

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'buzeoff',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'alged_ref_db',
  password: process.env.DB_PASSWORD || 'olhseS05!',
  port: process.env.DB_PORT || 5432,
});

async function runBadgeMigration() {
  console.log('🚀 Запуск миграции системы плашек...\n');

  const client = await pool.connect();
  
  try {
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'add_badge_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Выполнение add_badge_columns.sql...');
    
    // Выполняем SQL
    await client.query(sql);

    console.log('✅ Миграция успешно выполнена!\n');

    // Проверяем новые колонки
    const columnsResult = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('badge_status', 'commission_rate', 'stars_balance', 'is_whale', 'telegram_audience')
      ORDER BY column_name;
    `);

    console.log('📊 Добавленные колонки:');
    columnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type}), default: ${row.column_default || 'NULL'}`);
    });

    // Проверяем constraint'ы
    const constraintsResult = await client.query(`
      SELECT conname, contype
      FROM pg_constraint 
      WHERE conname IN ('check_badge_status', 'check_commission_rate')
      ORDER BY conname;
    `);

    console.log('\n🔒 Добавленные constraints:');
    constraintsResult.rows.forEach(row => {
      console.log(`   - ${row.conname} (type: ${row.contype})`);
    });

    // Статистика по плашкам
    const statsResult = await client.query(`
      SELECT 
        badge_status,
        COUNT(*) as count,
        AVG(commission_rate) as avg_commission,
        AVG(rating) as avg_rating,
        AVG(total_deals) as avg_deals
      FROM users
      GROUP BY badge_status
      ORDER BY 
        CASE badge_status
          WHEN 'DADDY' THEN 1
          WHEN 'INFL' THEN 2
          WHEN 'RESIDENT' THEN 3
          WHEN 'JOKER' THEN 4
          WHEN 'GUEST' THEN 5
          WHEN 'SCAM' THEN 6
        END;
    `);

    console.log('\n📈 Статистика по плашкам:');
    statsResult.rows.forEach(row => {
      console.log(`   ${row.badge_status}: ${row.count} пользователей (комиссия: ${parseFloat(row.avg_commission).toFixed(2)}%, рейтинг: ${parseFloat(row.avg_rating).toFixed(2)}, сделок: ${parseFloat(row.avg_deals).toFixed(0)})`);
    });

    console.log('\n✨ База данных готова к использованию системы плашек!');

  } catch (error) {
    console.error('❌ Ошибка выполнения миграции:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запуск
runBadgeMigration().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
