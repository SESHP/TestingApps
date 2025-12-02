// backend/guarantee-socket.js - ПОЛНЫЙ КОД

const { validateTelegramData } = require('./utils/telegramAuth');

const activeDeals = new Map();
const userSockets = new Map();

function initGuaranteeSocket(io, pool) {
  // БЕЗОПАСНОСТЬ: Middleware для аутентификации WebSocket соединений
  io.use((socket, next) => {
    const initData = socket.handshake.auth.initData;
    const botToken = process.env.BOT_TOKEN;

    // Валидируем Telegram данные
    const userData = validateTelegramData(initData, botToken);

    if (!userData) {
      console.error('❌ WebSocket: Invalid authentication');
      return next(new Error('Authentication failed'));
    }

    socket.userId = userData.id;
    socket.userData = userData;
    console.log(`✅ WebSocket аутентификация успешна: User ${userData.id}`);

    next();
  });

  io.on('connection', (socket) => {
    console.log(`✅ Подключен аутентифицированный клиент: ${socket.id}, User: ${socket.userId}`);

    // Присоединение пользователя к сделке
    socket.on('join-deal', async ({ dealId }) => {
      try {
        const userId = socket.userId;
        console.log(`👤 Пользователь ${userId} присоединяется к сделке ${dealId}`);

        const dealCheck = await pool.query(
          'SELECT * FROM deals WHERE id = $1 AND (creator_id = $2 OR participant_id = $2)',
          [dealId, userId]
        );

        if (dealCheck.rows.length === 0) {
          socket.emit('error', { message: 'У вас нет доступа к этой сделке' });
          return;
        }

        socket.join(`deal_${dealId}`);
        userSockets.set(userId.toString(), socket.id);
        
        const result = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
        
        if (result.rows.length > 0) {
          const deal = result.rows[0];
          socket.emit('deal-state', deal);
          
          // Отправляем текущие подарки
          const dealGifts = await getDealGifts(pool, dealId);
          socket.emit('gifts-updated', { dealId, gifts: dealGifts });
          
          socket.to(`deal_${dealId}`).emit('user-joined', { userId });
        }
      } catch (error) {
        console.error('❌ Ошибка присоединения к сделке:', error);
        socket.emit('error', { message: 'Ошибка присоединения к сделке' });
      }
    });

    // Добавление подарка в сделку
    socket.on('add-gift-to-deal', async ({ dealId, giftId }) => {
      try {
        const userId = socket.userId;
        console.log(`🎁 Добавление подарка ${giftId} в сделку ${dealId} от ${userId}`);

        const giftCheck = await pool.query(
          `SELECT * FROM gifts WHERE id = $1 AND from_id = $2 AND is_withdrawn = FALSE`,
          [giftId, userId]
        );

        if (giftCheck.rows.length === 0) {
          socket.emit('error', { message: 'Подарок не найден или уже выведен' });
          return;
        }

        await pool.query(
          `INSERT INTO deal_gifts (deal_id, user_id, gift_id, added_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (deal_id, gift_id) DO NOTHING`,
          [dealId, userId, giftId]
        );

        const dealGifts = await getDealGifts(pool, dealId);
        io.to(`deal_${dealId}`).emit('gifts-updated', { dealId, userId, gifts: dealGifts });

      } catch (error) {
        console.error('❌ Ошибка добавления подарка:', error);
        socket.emit('error', { message: 'Ошибка добавления подарка' });
      }
    });

    // Удаление подарка из сделки
    socket.on('remove-gift-from-deal', async ({ dealId, giftId }) => {
      try {
        const userId = socket.userId;
        console.log(`🗑️ Удаление подарка ${giftId} из сделки ${dealId}`);

        await pool.query(
          `DELETE FROM deal_gifts WHERE deal_id = $1 AND user_id = $2 AND gift_id = $3`,
          [dealId, userId, giftId]
        );

        const dealGifts = await getDealGifts(pool, dealId);
        io.to(`deal_${dealId}`).emit('gifts-updated', { dealId, userId, gifts: dealGifts });

      } catch (error) {
        console.error('❌ Ошибка удаления подарка:', error);
        socket.emit('error', { message: 'Ошибка удаления подарка' });
      }
    });

    // Блокировка подарков
    socket.on('lock-gifts', async ({ dealId }) => {
      try {
        const userId = socket.userId;
        console.log(`🔒 Блокировка подарков в сделке ${dealId} от ${userId}`);

        const result = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Сделка не найдена' });
          return;
        }

        const deal = result.rows[0];
        const isCreator = deal.creator_id === userId;
        const field = isCreator ? 'creator_locked' : 'participant_locked';
        
        await pool.query(`UPDATE deals SET ${field} = TRUE WHERE id = $1`, [dealId]);
        
        const updated = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
        const updatedDeal = updated.rows[0];
        
        io.to(`deal_${dealId}`).emit('lock-updated', {
          creatorLocked: updatedDeal.creator_locked,
          participantLocked: updatedDeal.participant_locked
        });
        
        // Если оба заблокировали - переходим в режим проверки
        if (updatedDeal.creator_locked && updatedDeal.participant_locked) {
          await pool.query(`UPDATE deals SET status = 'verification' WHERE id = $1`, [dealId]);
          io.to(`deal_${dealId}`).emit('verification-stage');
        }
      } catch (error) {
        console.error('❌ Ошибка блокировки:', error);
        socket.emit('error', { message: 'Ошибка блокировки' });
      }
    });

    // Проверка обмена
    socket.on('verify-deal', async ({ dealId, approved }) => {
      try {
        const userId = socket.userId;
        console.log(`🔍 Проверка сделки ${dealId} от ${userId}, одобрено: ${approved}`);

        const result = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Сделка не найдена' });
          return;
        }

        const deal = result.rows[0];
        
        if (!approved) {
          // Отмена - разблокировать
          await pool.query(
            `UPDATE deals 
             SET status = 'active', 
                 creator_locked = FALSE, 
                 participant_locked = FALSE,
                 creator_confirmed = FALSE,
                 participant_confirmed = FALSE
             WHERE id = $1`,
            [dealId]
          );
          io.to(`deal_${dealId}`).emit('verification-cancelled');
          return;
        }
        
        // Одобрение
        const isCreator = deal.creator_id === userId;
        const field = isCreator ? 'creator_confirmed' : 'participant_confirmed';
        
        await pool.query(`UPDATE deals SET ${field} = TRUE WHERE id = $1`, [dealId]);
        
        const updated = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
        const updatedDeal = updated.rows[0];
        
        io.to(`deal_${dealId}`).emit('confirmation-updated', {
          creatorConfirmed: updatedDeal.creator_confirmed,
          participantConfirmed: updatedDeal.participant_confirmed
        });
        
        // Если оба одобрили - выполняем обмен
        if (updatedDeal.creator_confirmed && updatedDeal.participant_confirmed) {
          await executeDeal(pool, io, dealId);
        }
      } catch (error) {
        console.error('❌ Ошибка проверки:', error);
        socket.emit('error', { message: 'Ошибка проверки' });
      }
    });

    // Отмена сделки
    socket.on('cancel-deal', async ({ dealId }) => {
      try {
        const userId = socket.userId;
        console.log(`❌ Отмена сделки ${dealId} пользователем ${userId}`);

        await pool.query(
          `UPDATE deals SET status = 'cancelled', cancelled_by = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [dealId, userId]
        );

        await pool.query('DELETE FROM deal_gifts WHERE deal_id = $1', [dealId]);
        io.to(`deal_${dealId}`).emit('deal-cancelled', { dealId, cancelledBy: userId });

      } catch (error) {
        console.error('❌ Ошибка отмены сделки:', error);
        socket.emit('error', { message: 'Ошибка отмены сделки' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Отключен клиент: ${socket.id}`);
      
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          break;
        }
      }
    });
  });
}

// Вспомогательная функция: получить подарки сделки
async function getDealGifts(pool, dealId) {
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
    const userId = String(row.user_id);
    if (!gifts[userId]) {
      gifts[userId] = [];
    }
    gifts[userId].push({
      id: row.gift_id,
      giftTitle: row.gift_title,
      model: row.model,
      background: row.background,
      symbol: row.symbol,
      raw_data: row.raw_data,
      addedAt: row.added_at
    });
  }

  return gifts;
}

// Выполнение обмена подарками
async function executeDeal(pool, io, dealId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log(`🔄 Выполнение сделки ${dealId}...`);

    const dealResult = await client.query('SELECT * FROM deals WHERE id = $1', [dealId]);
    if (dealResult.rows.length === 0) {
      throw new Error('Сделка не найдена');
    }

    const deal = dealResult.rows[0];

    const giftsResult = await client.query(
      `SELECT * FROM deal_gifts WHERE deal_id = $1`,
      [dealId]
    );

    const creatorGifts = giftsResult.rows.filter(g => g.user_id === deal.creator_id);
    const participantGifts = giftsResult.rows.filter(g => g.user_id === deal.participant_id);

    // Передаем подарки создателя участнику
    for (const giftRow of creatorGifts) {
      await client.query(
        `UPDATE gifts SET from_id = $1 WHERE id = $2`,
        [String(deal.participant_id), giftRow.gift_id]
      );
    }

    // Передаем подарки участника создателю
    for (const giftRow of participantGifts) {
      await client.query(
        `UPDATE gifts SET from_id = $1 WHERE id = $2`,
        [String(deal.creator_id), giftRow.gift_id]
      );
    }

    await client.query(
      `UPDATE deals SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [dealId]
    );

    await client.query('COMMIT');

    io.to(`deal_${dealId}`).emit('deal-completed', {
      dealId,
      message: 'Обмен успешно завершен!'
    });

    console.log(`✅ Сделка ${dealId} успешно завершена`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Ошибка выполнения сделки ${dealId}:`, error);
    io.to(`deal_${dealId}`).emit('deal-error', {
      dealId,
      message: 'Ошибка выполнения обмена'
    });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initGuaranteeSocket };