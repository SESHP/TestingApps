// backend/guarantee-api.js
// API эндпоинты для гарант-сервиса

const crypto = require('crypto');

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function generateUniqueInviteCode(pool) {
  let code;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = generateInviteCode();
    const result = await pool.query(
      'SELECT id FROM deals WHERE invite_code = $1',
      [code]
    );
    isUnique = result.rows.length === 0;
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Не удалось сгенерировать уникальный код');
  }

  return code;
}

function setupGuaranteeAPI(app, pool) {
  // Создание новой сделки
  app.post('/api/deals/create', async (req, res) => {
    try {
      const { creatorId } = req.body;

      if (!creatorId) {
        return res.status(400).json({ error: 'Не указан ID создателя' });
      }

      const inviteCode = await generateUniqueInviteCode(pool);

      const result = await pool.query(
        `INSERT INTO deals (creator_id, invite_code, status)
         VALUES ($1, $2, 'waiting')
         RETURNING *`,
        [creatorId, inviteCode]
      );

      console.log(`✅ Сделка создана: ${result.rows[0].id}, код: ${inviteCode}`);

      res.json({
        success: true,
        deal: result.rows[0]
      });

    } catch (error) {
      console.error('❌ Ошибка создания сделки:', error);
      res.status(500).json({ error: 'Ошибка создания сделки' });
    }
  });

  // Присоединение к сделке
  app.post('/api/deals/join', async (req, res) => {
    try {
      const { inviteCode, participantId } = req.body;

      if (!inviteCode || !participantId) {
        return res.status(400).json({ error: 'Недостаточно данных' });
      }

      // Ищем сделку по коду
      const dealResult = await pool.query(
        'SELECT * FROM deals WHERE invite_code = $1 AND status = $2',
        [inviteCode.toUpperCase(), 'waiting']
      );

      if (dealResult.rows.length === 0) {
        return res.status(404).json({ error: 'Сделка не найдена или уже активна' });
      }

      const deal = dealResult.rows[0];

      // Проверяем, что участник не создатель
      if (deal.creator_id === participantId) {
        return res.status(400).json({ error: 'Вы не можете присоединиться к своей сделке' });
      }

      // Обновляем сделку
      const updateResult = await pool.query(
        `UPDATE deals 
         SET participant_id = $1, status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [participantId, deal.id]
      );

      console.log(`✅ Участник ${participantId} присоединился к сделке ${deal.id}`);

      res.json({
        success: true,
        deal: updateResult.rows[0]
      });

    } catch (error) {
      console.error('❌ Ошибка присоединения к сделке:', error);
      res.status(500).json({ error: 'Ошибка присоединения к сделке' });
    }
  });

  // Получить подарки в сделке
  app.get('/api/deals/:dealId/gifts', async (req, res) => {
    try {
      const { dealId } = req.params;

      const result = await pool.query(
        `SELECT dg.*, g.gift_title, g.model, g.background, g.symbol, g.raw_data
         FROM deal_gifts dg
         JOIN gifts g ON dg.gift_id = g.id
         WHERE dg.deal_id = $1
         ORDER BY dg.added_at ASC`,
        [dealId]
      );

      const gifts = {};
      for (const row of result.rows) {
        const userId = row.user_id;
        if (!gifts[userId]) {
          gifts[userId] = [];
        }
        gifts[userId].push({
          id: row.gift_id,
          giftTitle: row.gift_title,
          model: row.model,
          background: row.background,
          symbol: row.symbol,
          rawData: row.raw_data,
          addedAt: row.added_at
        });
      }

      res.json({ gifts });

    } catch (error) {
      console.error('❌ Ошибка получения подарков сделки:', error);
      res.status(500).json({ error: 'Ошибка получения подарков' });
    }
  });

  // Получить информацию о сделке
  app.get('/api/deals/:dealId', async (req, res) => {
    try {
      const { dealId } = req.params;

      const result = await pool.query(
        'SELECT * FROM deals WHERE id = $1',
        [dealId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Сделка не найдена' });
      }

      res.json({ deal: result.rows[0] });

    } catch (error) {
      console.error('❌ Ошибка получения сделки:', error);
      res.status(500).json({ error: 'Ошибка получения сделки' });
    }
  });

  // Получить активные сделки пользователя
  app.get('/api/deals/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        `SELECT * FROM deals 
         WHERE (creator_id = $1 OR participant_id = $1) 
         AND status IN ('waiting', 'active')
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({ deals: result.rows });

    } catch (error) {
      console.error('❌ Ошибка получения сделок пользователя:', error);
      res.status(500).json({ error: 'Ошибка получения сделок' });
    }
  });
}

module.exports = { setupGuaranteeAPI };
