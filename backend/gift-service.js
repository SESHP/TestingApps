// gift-service.js
// Сервис для работы с подарками Telegram

const fs = require('fs').promises;
const path = require('path');
const { Buffer } = require('buffer');

class GiftService {
  constructor(telegramClient, uploadsDir = './uploads/gifts') {
    this.client = telegramClient;
    this.uploadsDir = uploadsDir;
    this.ensureUploadsDirExists();
  }

  async ensureUploadsDirExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      console.log(`✅ Директория для подарков создана: ${this.uploadsDir}`);
    } catch (error) {
      console.error('❌ Ошибка создания директории:', error);
    }
  }

  /**
   * Форматирование цвета в HEX
   */
  formatColor(colorInt) {
    if (!colorInt) return '#000000';
    const hex = (colorInt >>> 0).toString(16).padStart(6, '0');
    return `#${hex}`;
  }

  /**
   * Загрузка файла документа из Telegram
   */
  async downloadDocument(docId, accessHash, fileReference, mimeType) {
    try {
      if (!this.client) {
        throw new Error('Telegram client не инициализирован');
      }

      console.log(`📥 Загрузка документа ID: ${docId}`);

      const { Api } = require('telegram');
      
      // Конвертируем строки в BigInt
      const inputDocument = new Api.InputDocument({
        id: BigInt(docId),
        accessHash: BigInt(accessHash),
        fileReference: Buffer.from(fileReference.data)
      });

      // Загружаем файл
      const buffer = await this.client.downloadMedia(inputDocument, {
        workers: 1
      });

      if (!buffer) {
        throw new Error('Не удалось загрузить файл');
      }

      // Определяем расширение
      const extension = mimeType === 'application/x-tgsticker' ? '.tgs' : '.webp';
      const filename = `${docId}${extension}`;
      const filepath = path.join(this.uploadsDir, filename);

      // Сохраняем файл
      await fs.writeFile(filepath, buffer);
      console.log(`✅ Файл сохранен: ${filepath}`);

      // Если это TGS - конвертируем в JSON
      if (mimeType === 'application/x-tgsticker') {
        await this.convertTgsToJson(filepath);
      }

      return {
        filename,
        filepath,
        size: buffer.length,
        url: `/uploads/gifts/${filename}`
      };

    } catch (error) {
      console.error('❌ Ошибка загрузки документа:', error);
      throw error;
    }
  }

  /**
   * Конвертация .tgs (gzipped JSON) в обычный JSON для Lottie
   */
  async convertTgsToJson(tgsPath) {
    try {
      const zlib = require('zlib');
      const tgsBuffer = await fs.readFile(tgsPath);
      
      // Распаковываем gzip
      const jsonBuffer = await new Promise((resolve, reject) => {
        zlib.gunzip(tgsBuffer, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const jsonString = jsonBuffer.toString('utf8');
      const jsonPath = tgsPath.replace('.tgs', '.json');
      
      await fs.writeFile(jsonPath, jsonString);
      console.log(`✅ TGS конвертирован в JSON: ${jsonPath}`);

      return jsonPath;

    } catch (error) {
      console.error('❌ Ошибка конвертации TGS:', error);
      throw error;
    }
  }

  /**
   * Обработка подарка - загрузка модели и паттерна
   */
  async processGiftFiles(giftData) {
    try {
      const attributes = giftData.attributes || [];
      const result = {
        model: null,
        pattern: null
      };

      // Находим модель (StarGiftAttributeModel)
      const modelAttr = attributes.find(attr => attr.className === 'StarGiftAttributeModel');
      if (modelAttr?.document) {
        const doc = modelAttr.document;
        try {
          await this.downloadDocument(
            doc.id,
            doc.accessHash,
            doc.fileReference,
            doc.mimeType
          );
          result.model = doc.id;
          console.log(`✅ Модель загружена: ${doc.id}`);
        } catch (err) {
          console.error(`⚠️ Не удалось загрузить модель:`, err.message);
        }
      }

      // Находим паттерн (StarGiftAttributePattern)
      const patternAttr = attributes.find(attr => attr.className === 'StarGiftAttributePattern');
      if (patternAttr?.document) {
        const doc = patternAttr.document;
        try {
          await this.downloadDocument(
            doc.id,
            doc.accessHash,
            doc.fileReference,
            doc.mimeType
          );
          result.pattern = doc.id;
          console.log(`✅ Паттерн загружен: ${doc.id}`);
        } catch (err) {
          console.error(`⚠️ Не удалось загрузить паттерн:`, err.message);
        }
      }

      return result;

    } catch (error) {
      console.error('❌ Ошибка обработки подарка:', error);
      throw error;
    }
  }
}

module.exports = GiftService;