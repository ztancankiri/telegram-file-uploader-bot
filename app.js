const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const botToken = "<BOT_TOKEN>";
const apiUrl = `http://localhost:8081/bot${botToken}`;

let offset = -1;

async function downloadFileFromUrl(url) {
  try {
    const response = await axios.get(url, { responseType: "stream" });
    const mimeType = response.headers["content-type"];
    const fileExtension = mime.extension(mimeType);
    const fileName = `downloaded_file_${Date.now()}.${fileExtension}`;
    const filePath = path.join(__dirname, fileName);
    const fileStream = fs.createWriteStream(filePath);
    response.data.pipe(fileStream);

    await new Promise((resolve) => {
      fileStream.on("finish", () => {
        console.log(`Downloaded file: ${fileName}`);
        resolve(filePath);
      });
    });

    return filePath;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function sendFileToChat(chatId, filePath) {
  try {
    const fileData = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", fileData, path.basename(filePath));
    await axios.post(`${apiUrl}/sendDocument`, formData, {
      headers: formData.getHeaders(),
    });
    console.log(`Sent file: ${filePath}`);
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    // Delete the file after sending
    fs.unlinkSync(filePath);
  }
}

async function deleteMessage(chatId, messageId) {
  try {
    await axios.post(`${apiUrl}/deleteMessage`, {
      chat_id: chatId,
      message_id: messageId,
    });
    console.log(`Deleted message: ${messageId}`);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function checkForNewMessages() {
  try {
    const response = await axios.get(`${apiUrl}/getUpdates?offset=${offset}&timeout=1`);
    const messages = response.data.result;
    const lastMessage = messages[messages.length - 1];

    const chatId = lastMessage.message.chat.id;
    const messageId = lastMessage.message.message_id;
    await deleteMessage(chatId, messageId);
    offset = lastMessage.update_id + 1;

    if (lastMessage.message.entities) {
      const urlEntity = lastMessage.message.entities.find((entity) => entity.type === "url");
      if (urlEntity) {
        const urlStart = urlEntity.offset;
        const urlEnd = urlStart + urlEntity.length;
        const url = lastMessage.message.text.substring(urlStart, urlEnd);

        const filePath = await downloadFileFromUrl(url);
        await sendFileToChat(chatId, filePath);
      }
    }
  } catch (error) {
    console.log(error);
  }
}

setInterval(checkForNewMessages, 1000);
