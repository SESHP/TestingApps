// backend/migrations/run.js
// Скрипт для запуска SQL миграций

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

async function runMigrations() {
  console.log('🚀 Запуск миграций базы данных...\n');

  const client = await pool.connect();
  
  try {
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Выполнение init.sql...');
    
    // Выполняем SQL
    await client.query(sql);

    console.log('✅ Миграции успешно выполнены!\n');

    // Проверяем созданные таблицы
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📊 Созданные таблицы:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Проверяем индексы
    const indexesResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY indexname;
    `);

    console.log('\n🔍 Созданные индексы:');
    indexesResult.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });

    console.log('\n✨ База данных готова к использованию!');

  } catch (error) {
    console.error('❌ Ошибка выполнения миграций:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запуск
runMigrations().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});