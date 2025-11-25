// backend/guarantee-socket.js
// WebSocket логика для гарант-сервиса

function initGuaranteeSocket(io, pool) {
  io.on('connection', (socket) => {
    console.log(`✅ WebSocket подключен: ${socket.id}`);

    // Присоединение к сделке
    socket.on('join-deal', async ({ dealId, userId }) => {
      try {
        console.log(`👤 Пользователь ${userId} присоединяется к сделке ${dealId}`);
        
        socket.join(`deal-${dealId}`);
        
        const result = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
        
        if (result.rows.length > 0) {
          const deal = result.rows[0];
          socket.emit('deal-state', deal);
          
          // Загружаем подарки в сделке
          const gifts = await getDealGifts(pool, dealId);
          socket.emit('gifts-updated', { dealId, gifts });
          
          console.log(`✅ Пользователь ${userId} присоединился к сделке ${dealId}`);
        }
      } catch (error) {
        console.error('❌ Ошибка join-deal:', error);
        socket.emit('error', { message: 'Ошибка присоединения к сделке' });
      }
    });

    // Добавление подарка в сделку
    socket.on('add-gift-to-deal', async ({ dealId, userId, giftId }) => {
      try {
        console.log(`🎁 Добавление подарка ${giftId} в сделку ${dealId} от пользователя ${userId}`);
        
        // Проверяем что подарок принадлежит пользователю
        const giftCheck = await pool.query(
          `SELECT * FROM gifts WHERE id = $1 AND from_id = $2 AND is_withdrawn = FALSE`,
          [giftId, userId]
        );

        if (giftCheck.rows.length === 0) {
          console.error(`❌ Подарок ${giftId} не найден или уже выведен`);
          socket.emit('error', { message: 'Подарок не найден или уже используется' });
          return;
        }

        // Проверяем что подарок еще не добавлен в сделку
        const existingCheck = await pool.query(
          `SELECT * FROM deal_gifts WHERE deal_id = $1 AND gift_id = $2`,
          [dealId, giftId]
        );

        if (existingCheck.rows.length > 0) {
          console.error(`❌ Подарок ${giftId} уже добавлен в сделку`);
          socket.emit('error', { message: 'Этот подарок уже добавлен в сделку' });
          return;
        }

        // Добавляем подарок в сделку
        await pool.query(
          `INSERT INTO deal_gifts (deal_id, user_id, gift_id, added_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [dealId, userId, giftId]
        );

        console.log(`✅ Подарок ${giftId} добавлен в сделку ${dealId}`);

        // Получаем обновленный список подарков
        const gifts = await getDealGifts(pool, dealId);
        
        // Отправляем обновление всем участникам сделки
        io.to(`deal-${dealId}`).emit('gifts-updated', {
          dealId,
          userId,
          gifts
        });

      } catch (error) {
        console.error('❌ Ошибка добавления подарка:', error);
        socket.emit('error', { message: 'Ошибка добавления подарка в сделку' });
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

        console.log(`✅ Подарок ${giftId} удален из сделки ${dealId}`);

        // Получаем обновленный список подарков
        const gifts = await getDealGifts(pool, dealId);
        
        // Отправляем обновление всем участникам
        io.to(`deal-${dealId}`).emit('gifts-updated', {
          dealId,
          userId,
          gifts
        });

      } catch (error) {
        console.error('❌ Ошибка удаления подарка:', error);
        socket.emit('error', { message: 'Ошибка удаления подарка' });
      }
    });

    // Подтверждение сделки
    socket.on('confirm-deal', async ({ dealId, userId }) => {
      try {
        console.log(`✅ Пользователь ${userId} подтверждает сделку ${dealId}`);

        const deal = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);

        if (deal.rows.length === 0) {
          socket.emit('error', { message: 'Сделка не найдена' });
          return;
        }

        const currentDeal = deal.rows[0];

        // Обновляем подтверждение
        if (userId === currentDeal.creator_id) {
          await pool.query('UPDATE deals SET creator_confirmed = TRUE WHERE id = $1', [dealId]);
        } else if (userId === currentDeal.participant_id) {
          await pool.query('UPDATE deals SET participant_confirmed = TRUE WHERE id = $1', [dealId]);
        } else {
          socket.emit('error', { message: 'Вы не участник этой сделки' });
          return;
        }

        // Получаем обновленную сделку
        const updated = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
        const updatedDeal = updated.rows[0];

        // Отправляем обновление подтверждений
        io.to(`deal-${dealId}`).emit('confirmation-updated', {
          dealId,
          creatorConfirmed: updatedDeal.creator_confirmed,
          participantConfirmed: updatedDeal.participant_confirmed
        });

        console.log(`✅ Подтверждение обновлено. Создатель: ${updatedDeal.creator_confirmed}, Участник: ${updatedDeal.participant_confirmed}`);

        // Если оба подтвердили - выполняем обмен
        if (updatedDeal.creator_confirmed && updatedDeal.participant_confirmed) {
          console.log(`🔄 Оба участника подтвердили сделку ${dealId}. Начинаем обмен...`);
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

        // Обновляем статус сделки
        await pool.query(
          `UPDATE deals SET status = 'cancelled', cancelled_by = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [dealId, userId]
        );

        // Удаляем все подарки из сделки
        await pool.query('DELETE FROM deal_gifts WHERE deal_id = $1', [dealId]);

        // Уведомляем всех участников
        io.to(`deal-${dealId}`).emit('deal-cancelled', { 
          dealId, 
          cancelledBy: userId 
        });

        console.log(`✅ Сделка ${dealId} отменена пользователем ${userId}`);

      } catch (error) {
        console.error('❌ Ошибка отмены сделки:', error);
        socket.emit('error', { message: 'Ошибка отмены сделки' });
      }
    });

    // Отключение клиента
    socket.on('disconnect', () => {
      console.log(`❌ WebSocket отключен: ${socket.id}`);
    });
  });
}

// Получить подарки в сделке, сгруппированные по пользователям
async function getDealGifts(pool, dealId) {
  const result = await pool.query(
    `SELECT dg.user_id, dg.gift_id, dg.added_at,
            g.gift_title, g.model, g.background, g.symbol, g.raw_data
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

  return gifts;
}

// Выполнение обмена подарками
async function executeDeal(pool, io, dealId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log(`🔄 Выполнение обмена для сделки ${dealId}...`);

    // Получаем информацию о сделке
    const dealResult = await client.query('SELECT * FROM deals WHERE id = $1', [dealId]);

    if (dealResult.rows.length === 0) {
      throw new Error('Сделка не найдена');
    }

    const deal = dealResult.rows[0];

    // Получаем все подарки в сделке
    const giftsResult = await client.query(
      `SELECT * FROM deal_gifts WHERE deal_id = $1`,
      [dealId]
    );

    const creatorGifts = giftsResult.rows.filter(g => g.user_id === deal.creator_id);
    const participantGifts = giftsResult.rows.filter(g => g.user_id === deal.participant_id);

    console.log(`📦 Подарков создателя: ${creatorGifts.length}`);
    console.log(`📦 Подарков участника: ${participantGifts.length}`);

    // Меняем владельца подарков создателя на участника
    for (const giftRow of creatorGifts) {
      await client.query(
        `UPDATE gifts SET from_id = $1 WHERE id = $2`,
        [deal.participant_id, giftRow.gift_id]
      );
      console.log(`✅ Подарок ${giftRow.gift_id} передан от ${deal.creator_id} к ${deal.participant_id}`);
    }

    // Меняем владельца подарков участника на создателя
    for (const giftRow of participantGifts) {
      await client.query(
        `UPDATE gifts SET from_id = $1 WHERE id = $2`,
        [deal.creator_id, giftRow.gift_id]
      );
      console.log(`✅ Подарок ${giftRow.gift_id} передан от ${deal.participant_id} к ${deal.creator_id}`);
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
      message: '🎉 Обмен успешно завершен!'
    });

    console.log(`✅ Сделка ${dealId} успешно завершена`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Ошибка выполнения обмена для сделки ${dealId}:`, error);
    
    io.to(`deal-${dealId}`).emit('error', {
      message: 'Ошибка выполнения обмена. Попробуйте еще раз.'
    });
    
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initGuaranteeSocket };