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
   * Определение типа файла подарка по MIME type
   */
  getGiftFileType(mimeType) {
    const types = {
      'image/webp': 'static',           // Статический стикер
      'application/x-tgsticker': 'lottie', // Анимированный Lottie
      'video/webm': 'video'             // Видео стикер
    };
    return types[mimeType] || 'unknown';
  }

  /**
   * Извлечение информации о документе из подарка
   */
  extractDocumentInfo(gift) {
    try {
      if (!gift.document) {
        return null;
      }

      const doc = gift.document;
      
      // Определяем тип файла
      const fileType = this.getGiftFileType(doc.mimeType);

      // Получаем размеры из атрибутов
      let width = 512;
      let height = 512;
      
      if (doc.attributes) {
        for (const attr of doc.attributes) {
          if (attr.className === 'DocumentAttributeImageSize') {
            width = attr.w || 512;
            height = attr.h || 512;
          } else if (attr.className === 'DocumentAttributeVideo') {
            width = attr.w || 512;
            height = attr.h || 512;
          }
        }
      }

      return {
        id: doc.id.toString(),
        accessHash: doc.accessHash.toString(),
        fileReference: doc.fileReference,
        dcId: doc.dcId,
        mimeType: doc.mimeType,
        size: doc.size.toString(),
        fileType,
        width,
        height,
        thumbs: doc.thumbs || []
      };
    } catch (error) {
      console.error('❌ Ошибка извлечения информации о документе:', error);
      return null;
    }
  }

  /**
   * Извлечение атрибутов коллекционного подарка
   */
  extractGiftAttributes(gift) {
    const attributes = {
      model: null,
      backdrop: null,
      pattern: null,
      originalDetails: null
    };

    try {
      if (!gift.attributes || !Array.isArray(gift.attributes)) {
        return attributes;
      }

      for (const attr of gift.attributes) {
        switch (attr.className) {
          case 'StarGiftAttributeModel':
            attributes.model = {
              name: attr.name,
              document: this.extractDocumentInfo({ document: attr.document }),
              rarityPermille: attr.rarityPermille
            };
            break;

          case 'StarGiftAttributeBackdrop':
            attributes.backdrop = {
              name: attr.name,
              backdropId: attr.backdropId,
              centerColor: this.formatColor(attr.centerColor),
              edgeColor: this.formatColor(attr.edgeColor),
              patternColor: this.formatColor(attr.patternColor),
              textColor: this.formatColor(attr.textColor),
              rarityPermille: attr.rarityPermille
            };
            break;

          case 'StarGiftAttributePattern':
            attributes.pattern = {
              name: attr.name,
              document: this.extractDocumentInfo({ document: attr.document }),
              rarityPermille: attr.rarityPermille
            };
            break;

          case 'StarGiftAttributeOriginalDetails':
            attributes.originalDetails = {
              senderId: attr.senderId,
              recipientId: attr.recipientId,
              date: attr.date,
              message: attr.message
            };
            break;
        }
      }
    } catch (error) {
      console.error('❌ Ошибка извлечения атрибутов подарка:', error);
    }

    return attributes;
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
  async downloadDocument(documentInfo) {
    try {
      if (!this.client || !documentInfo) {
        throw new Error('Telegram client не инициализирован или нет информации о документе');
      }

      console.log(`📥 Загрузка документа ID: ${documentInfo.id}, тип: ${documentInfo.fileType}`);

      // Создаем InputDocument для загрузки
      const { Api } = require('telegram');
      const inputDocument = new Api.InputDocument({
        id: BigInt(documentInfo.id),
        accessHash: BigInt(documentInfo.accessHash),
        fileReference: documentInfo.fileReference
      });

      // Загружаем файл
      const buffer = await this.client.downloadMedia(inputDocument, {
        workers: 1
      });

      if (!buffer) {
        throw new Error('Не удалось загрузить файл');
      }

      // Определяем расширение файла
      const extensions = {
        'static': '.webp',
        'lottie': '.tgs',
        'video': '.webm'
      };
      const extension = extensions[documentInfo.fileType] || '.bin';

      // Генерируем имя файла
      const filename = `${documentInfo.id}${extension}`;
      const filepath = path.join(this.uploadsDir, filename);

      // Сохраняем файл
      await fs.writeFile(filepath, buffer);
      console.log(`✅ Файл сохранен: ${filepath}`);

      return {
        filename,
        filepath,
        fileType: documentInfo.fileType,
        size: buffer.length,
        url: `/uploads/gifts/${filename}` // URL для фронтенда
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

      return {
        jsonPath,
        json: JSON.parse(jsonString),
        url: jsonPath.replace(this.uploadsDir, '/uploads/gifts')
      };

    } catch (error) {
      console.error('❌ Ошибка конвертации TGS:', error);
      throw error;
    }
  }

  /**
   * Полная обработка подарка - загрузка всех файлов
   */
  async processGift(gift) {
    try {
      const result = {
        giftId: gift.id ? gift.id.toString() : null,
        title: gift.title || 'Подарок',
        mainDocument: null,
        attributes: null,
        files: []
      };

      // Обрабатываем основной документ подарка
      if (gift.document) {
        const docInfo = this.extractDocumentInfo(gift);
        if (docInfo) {
          const downloadedFile = await this.downloadDocument(docInfo);
          
          // Если это Lottie, конвертируем в JSON
          if (docInfo.fileType === 'lottie') {
            const lottieJson = await this.convertTgsToJson(downloadedFile.filepath);
            downloadedFile.lottieJson = lottieJson;
          }

          result.mainDocument = {
            ...docInfo,
            file: downloadedFile
          };
          result.files.push(downloadedFile);
        }
      }

      // Обрабатываем атрибуты коллекционного подарка
      if (gift.className === 'StarGiftUnique') {
        const attributes = this.extractGiftAttributes(gift);
        result.attributes = attributes;

        // Загружаем модель
        if (attributes.model && attributes.model.document) {
          const modelFile = await this.downloadDocument(attributes.model.document);
          if (attributes.model.document.fileType === 'lottie') {
            const lottieJson = await this.convertTgsToJson(modelFile.filepath);
            modelFile.lottieJson = lottieJson;
          }
          attributes.model.file = modelFile;
          result.files.push(modelFile);
        }

        // Загружаем паттерн
        if (attributes.pattern && attributes.pattern.document) {
          const patternFile = await this.downloadDocument(attributes.pattern.document);
          if (attributes.pattern.document.fileType === 'lottie') {
            const lottieJson = await this.convertTgsToJson(patternFile.filepath);
            patternFile.lottieJson = lottieJson;
          }
          attributes.pattern.file = patternFile;
          result.files.push(patternFile);
        }
      }

      console.log(`✅ Подарок обработан: ${result.title}, файлов загружено: ${result.files.length}`);
      return result;

    } catch (error) {
      console.error('❌ Ошибка обработки подарка:', error);
      throw error;
    }
  }

  /**
   * Получение информации о подарке по gift_id из БД
   */
  async getGiftInfo(giftId, pool) {
    try {
      const result = await pool.query(
        'SELECT * FROM gifts WHERE gift_id = $1',
        [giftId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const giftData = result.rows[0];
      
      // Парсим raw_data для получения полной информации
      const rawData = giftData.raw_data;
      if (!rawData || !rawData.gift) {
        return giftData;
      }

      // Обрабатываем подарок
      const processedGift = await this.processGift(rawData.gift);

      // Обновляем запись в БД с информацией о файлах
      await pool.query(
        `UPDATE gifts 
         SET lottie_url = $1
         WHERE gift_id = $2`,
        [
          processedGift.mainDocument?.file?.lottieJson?.url || 
          processedGift.mainDocument?.file?.url || 
          null,
          giftId
        ]
      );

      return {
        ...giftData,
        processed: processedGift
      };

    } catch (error) {
      console.error('❌ Ошибка получения информации о подарке:', error);
      throw error;
    }
  }
}

module.exports = GiftService;