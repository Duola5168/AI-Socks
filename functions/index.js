// 匯入 Firebase Functions v2 模組
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");

// 初始化 Firebase Admin
admin.initializeApp();

/**
 * 核心清理邏輯。
 * 刪除 'logs' 集合中超過 30 天的舊文件。
 * @return {Promise<{status: string, message: string}>} 清理結果。
 */
async function doCleanupLogic() {
  const db = admin.firestore();
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30); // 30天前

    // The user's original code cleans up a "logs" collection. We will stick to that logic.
    // In a real-world scenario, you might target user-specific subcollections.
    const snapshot = await db.collection("logs").where("timestamp", "<", cutoff).get();

    if (snapshot.empty) {
      return {status: "success", message: "無需清理，資料庫中沒有過期的 'logs' 文件。"};
    }

    const batch = db.batch();
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    const successMessage = `清理成功，共刪除了 ${snapshot.size} 筆過期的 'logs' 文件。`;
    return {status: "success", message: successMessage};
  } catch (err) {
    logger.error("核心清理邏輯執行失敗:", err);
    const errorMessage = `清理失敗: ${err.message}`;
    return {status: "error", message: errorMessage};
  }
}

/**
 * 將執行結果寫入 Firestore 的 'system_logs' 集合。
 * @param {{status: string, message: string}} result - 要記錄的結果。
 */
async function logToFirestore(result) {
  const db = admin.firestore();
  try {
    await db.collection("system_logs").add({
      timestamp: new Date().toISOString(),
      status: result.status,
      message: result.message,
    });
    logger.info("日誌成功寫入 Firestore。", result);
  } catch (err) {
    logger.error("寫入日誌到 Firestore 失敗:", err);
  }
}

// 每日自動排程清理函式
exports.scheduledCleanup = onSchedule(
    {
      schedule: "0 3 * * *", // 每天凌晨 3 點
      timeZone: "Asia/Taipei",
    },
    async (event) => {
      logger.info("=== 開始執行自動排程清理 ===");
      const result = await doCleanupLogic();
      await logToFirestore(result);
      logger.info("=== 自動排程清理完成 ===");
      return null;
    },
);

// 可手動觸發的 HTTP 函式，用於前端監控與測試
exports.triggerCleanupManually = onRequest(
    {cors: true}, // 啟用 CORS
    async (req, res) => {
      logger.info("=== 接收到手動觸發清理請求 ===");
      if (req.method !== "POST") {
        res.status(405).send("僅允許 POST 請求");
        return;
      }
      const result = await doCleanupLogic();
      await logToFirestore(result); // 同樣記錄執行結果
      logger.info("=== 手動觸發清理完成 ===");
      res.json(result);
    },
);