// backend/guarantee-socket.js
// WebSocket логика для гарант-сервиса

const activeDeals = new Map(); // dealId -> { deal данные }
const userSockets = new Map(); // userId -> socketId

function initGuaranteeSocket(io, pool) {
  io.on('connection', (socket) => {
    console.log(`✅ Подключен клиент: ${socket.id}`);

    // Присоединение пользователя к сделке
    socket.on('join-deal', async ({ dealId, userId }) => {
      try {
        console.log(`👤 Пользователь ${userId} присоединяется к сделке ${dealId}`);
        
        socket.join(`deal-${dealId}`);
        userSockets.set(userId.toString(), socket.id);
        
        // Получаем текущее состояние сделки из БД
        const result = await pool.query(
          'SELECT * FROM deals WHERE id = $1',
          [dealId]
        );
        
        if (result.rows.length > 0) {
          const deal = result.rows[0];
          socket.emit('deal-state', deal);
          
          // Уведомляем другого участника о подключении
          socket.to(`deal-${dealId}`).emit('user-joined', { userId });
        }
      } catch (error) {
        console.error('❌ Ошибка присоединения к сделке:', error);
        socket.emit('error', { message: 'Ошибка присоединения к сделке' });
      }
    });

    // Добавление подарка в сделку
    socket.on('add-gift-to-deal', async ({ dealId, userId, giftId }) => {
      try {
        console.log(`🎁 Добавление подарка ${giftId} в сделку ${dealId} от ${userId}`);
        
        // Проверяем, что подарок принадлежит пользователю и не выведен
        const giftCheck = await pool.query(
          `SELECT * FROM gifts WHERE id = $1 AND from_id = $2 AND is_withdrawn = FALSE`,
          [giftId, userId]
        );

        if (giftCheck.rows.length === 0) {
          socket.emit('error', { message: 'Подарок не найден или уже выведен' });
          return;
        }

        const gift = giftCheck.rows[0];

        // Добавляем подарок в deal_gifts
        await pool.query(
          `INSERT INTO deal_gifts (deal_id, user_id, gift_id, added_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [dealId, userId, giftId]
        );

        // Получаем обновленный список подарков
        const dealGifts = await getDealGifts(pool, dealId);

        // Отправляем всем участникам сделки
        io.to(`deal-${dealId}`).emit('gifts-updated', {
          dealId,
          userId,
          gifts: dealGifts
        });

      } catch (error) {
        console.error('❌ Ошибка добавления подарка:', error);
        socket.emit('error', { message: 'Ошибка добавления подарка' });
      }
    });

    // Удаление подарка из сделки
    socket.on('remove-gift-from-deal', async ({ dealId, userId, giftId }) => {
      try {
        console.log(`🗑️ Удаление подарка ${giftId} из сделки ${dealId}`);

        await pool.query(
          `DELETE FROM deal_gifts WHERE deal_id = $1 AND user_id = $2 AND gift_id = $3`,
          [dealId, userId, giftId]
        );

        const dealGifts = await getDealGifts(pool, dealId);

        io.to(`deal-${dealId}`).emit('gifts-updated', {
          dealId,
          userId,
          gifts: dealGifts
        });

      } catch (error) {
        console.error('❌ Ошибка удаления подарка:', error);
        socket.emit('error', { message: 'Ошибка удаления подарка' });
      }
    });

    // Подтверждение сделки пользователем
    socket.on('confirm-deal', async ({ dealId, userId }) => {
      try {
        console.log(`✅ Пользователь ${userId} подтверждает сделку ${dealId}`);

        const deal = await pool.query(
          'SELECT * FROM deals WHERE id = $1',
          [dealId]
        );

        if (deal.rows.length === 0) {
          socket.emit('error', { message: 'Сделка не найдена' });
          return;
        }

        const currentDeal = deal.rows[0];

        // Определяем, кто подтверждает (creator или participant)
        if (userId === currentDeal.creator_id) {
          await pool.query(
            'UPDATE deals SET creator_confirmed = TRUE WHERE id = $1',
            [dealId]
          );
        } else if (userId === currentDeal.participant_id) {
          await pool.query(
            'UPDATE deals SET participant_confirmed = TRUE WHERE id = $1',
            [dealId]
          );
        }

        // Проверяем, подтвердили ли оба
        const updatedDeal = await pool.query(
          'SELECT * FROM deals WHERE id = $1',
          [dealId]
        );

        const updated = updatedDeal.rows[0];

        io.to(`deal-${dealId}`).emit('confirmation-updated', {
          dealId,
          creatorConfirmed: updated.creator_confirmed,
          participantConfirmed: updated.participant_confirmed
        });

        // Если оба подтвердили - выполняем обмен
        if (updated.creator_confirmed && updated.participant_confirmed) {
          await executeDeal(pool, io, dealId);
        }

      } catch (error) {
        console.error('❌ Ошибка подтверждения сделки:', error);
        socket.emit('error', { message: 'Ошибка подтверждения сделки' });
      }
    });

    // Отмена сделки
    socket.on('cancel-deal', async ({ dealId, userId }) => {
      try {
        console.log(`❌ Отмена сделки ${dealId} пользователем ${userId}`);

        await pool.query(
          `UPDATE deals SET status = 'cancelled', cancelled_by = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [dealId, userId]
        );

        // Удаляем все подарки из сделки
        await pool.query(
          'DELETE FROM deal_gifts WHERE deal_id = $1',
          [dealId]
        );

        io.to(`deal-${dealId}`).emit('deal-cancelled', { dealId, cancelledBy: userId });

      } catch (error) {
        console.error('❌ Ошибка отмены сделки:', error);
        socket.emit('error', { message: 'Ошибка отмены сделки' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Отключен клиент: ${socket.id}`);
      
      // Удаляем из userSockets
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
    const userId = String(row.user_id); // Приводим к строке!
    console.log(`📦 Подарок ${row.gift_id} принадлежит user_id: ${userId} (тип: ${typeof userId})`);
    if (!gifts[userId]) {
      gifts[userId] = [];
    }
    gifts[userId].push({
      id: row.gift_id,
      giftTitle: row.gift_title,
      model: row.model,
      background: row.background,
      symbol: row.symbol,
      raw_data: row.raw_data, // snake_case как в базе
      addedAt: row.added_at
    });
  }

  console.log('📦 Итоговая структура dealGifts:', JSON.stringify(Object.keys(gifts)));
  return gifts;
}

// Выполнение обмена подарками
async function executeDeal(pool, io, dealId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log(`🔄 Выполнение сделки ${dealId}...`);

    // Получаем сделку
    const dealResult = await client.query(
      'SELECT * FROM deals WHERE id = $1',
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      throw new Error('Сделка не найдена');
    }

    const deal = dealResult.rows[0];

    // Получаем подарки обоих участников
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
        [deal.participant_id, giftRow.gift_id]
      );
    }

    // Передаем подарки участника создателю
    for (const giftRow of participantGifts) {
      await client.query(
        `UPDATE gifts SET from_id = $1 WHERE id = $2`,
        [deal.creator_id, giftRow.gift_id]
      );
    }

    // Обновляем статус сделки
    await client.query(
      `UPDATE deals SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [dealId]
    );

    await client.query('COMMIT');

    // Уведомляем всех участников об успешном обмене
    io.to(`deal-${dealId}`).emit('deal-completed', {
      dealId,
      message: 'Обмен успешно завершен!'
    });

    console.log(`✅ Сделка ${dealId} успешно завершена`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Ошибка выполнения сделки ${dealId}:`, error);
    io.to(`deal-${dealId}`).emit('deal-error', {
      dealId,
      message: 'Ошибка выполнения обмена'
    });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initGuaranteeSocket };