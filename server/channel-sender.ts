/**
 * Channel Sender — delivers outbound messages to Telegram / WhatsApp Cloud.
 * Called by the POST /api/interactions handler when a human agent sends a message.
 */

const DEFAULT_TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

function resolveTelegramBot(channelId: string, botToken?: string): { token: string; chatId: string } {
  // Prefer explicitly provided bot token (from campaign record), fall back to env default
  const token = botToken || DEFAULT_TG_TOKEN;
  // Extract raw chat_id: "tg-slug:12345" -> "12345", "tg:12345" -> "12345"
  let chatId = channelId;
  if (chatId.startsWith("tg-") && chatId.includes(":")) {
    chatId = chatId.substring(chatId.indexOf(":") + 1);
  } else if (chatId.startsWith("tg:")) {
    chatId = chatId.substring(3);
  }
  return { token, chatId };
}

export interface SendResult {
  success: boolean;
  channel: string;
  messageId?: string | number;
  error?: string;
}

/**
 * Send a text message to the lead's channel.
 * botToken: the campaign's Telegram bot token (from Campaigns.bot_token). Falls back to TELEGRAM_BOT_TOKEN env var.
 */
export async function sendToChannel(
  channelIdentifier: string,
  campaignChannel: string,
  text: string,
  botToken?: string,
): Promise<SendResult> {
  // Telegram channels
  if (
    channelIdentifier.startsWith("tg:") ||
    channelIdentifier.startsWith("tg-") ||
    campaignChannel === "telegram"
  ) {
    return sendTelegramText(channelIdentifier, text, botToken);
  }

  // WhatsApp Cloud
  if (campaignChannel === "whatsapp_cloud") {
    return sendWhatsAppCloudText(channelIdentifier, text);
  }

  return { success: false, channel: campaignChannel, error: `Unsupported channel: ${campaignChannel}` };
}

/**
 * Send a voice memo (base64 audio) to the lead's channel.
 * botToken: the campaign's Telegram bot token (from Campaigns.bot_token). Falls back to TELEGRAM_BOT_TOKEN env var.
 */
export async function sendVoiceToChannel(
  channelIdentifier: string,
  campaignChannel: string,
  audioBase64: string,
  mimeType = "audio/ogg",
  botToken?: string,
): Promise<SendResult> {
  if (
    channelIdentifier.startsWith("tg:") ||
    channelIdentifier.startsWith("tg-") ||
    campaignChannel === "telegram"
  ) {
    return sendTelegramVoice(channelIdentifier, audioBase64, mimeType, botToken);
  }

  return { success: false, channel: campaignChannel, error: `Voice not supported for channel: ${campaignChannel}` };
}

/**
 * Send a photo (image URL or base64) to the lead's channel.
 * botToken: the campaign's Telegram bot token (from Campaigns.bot_token). Falls back to TELEGRAM_BOT_TOKEN env var.
 * caption: optional text caption for the photo.
 */
export async function sendPhotoToChannel(
  channelIdentifier: string,
  campaignChannel: string,
  imageUrl: string,
  caption?: string,
  botToken?: string,
): Promise<SendResult> {
  if (
    channelIdentifier.startsWith("tg:") ||
    channelIdentifier.startsWith("tg-") ||
    campaignChannel === "telegram"
  ) {
    return sendTelegramPhoto(channelIdentifier, imageUrl, caption, botToken);
  }

  return { success: false, channel: campaignChannel, error: `Photo not supported for channel: ${campaignChannel}` };
}

// ── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegramText(channelId: string, text: string, botToken?: string): Promise<SendResult> {
  const { token, chatId } = resolveTelegramBot(channelId, botToken);
  if (!token) return { success: false, channel: "telegram", error: "No bot token configured" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json() as any;
    if (data.ok) {
      return { success: true, channel: "telegram", messageId: data.result?.message_id };
    }
    return { success: false, channel: "telegram", error: data.description || "Telegram API error" };
  } catch (err: any) {
    return { success: false, channel: "telegram", error: err.message };
  }
}

async function sendTelegramVoice(
  channelId: string,
  audioBase64: string,
  mimeType: string,
  botToken?: string,
): Promise<SendResult> {
  const { token, chatId } = resolveTelegramBot(channelId, botToken);
  if (!token) return { success: false, channel: "telegram", error: "No bot token configured" };

  try {
    // Strip data URL prefix if present
    const base64Clean = audioBase64.replace(/^data:[^,]+,/, "");
    const buffer = Buffer.from(base64Clean, "base64");

    // Determine file extension from mime type
    const ext = mimeType.includes("ogg") ? "ogg"
      : mimeType.includes("webm") ? "webm"
      : mimeType.includes("mp4") ? "m4a"
      : "ogg";

    // Build multipart form data manually (no external deps needed)
    const boundary = `----FormBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // chat_id field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`
    ));

    // voice file field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="voice"; filename="voice.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    ));
    parts.push(buffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const data = await res.json() as any;
    if (data.ok) {
      return { success: true, channel: "telegram", messageId: data.result?.message_id };
    }
    return { success: false, channel: "telegram", error: data.description || "Telegram sendVoice error" };
  } catch (err: any) {
    return { success: false, channel: "telegram", error: err.message };
  }
}

async function sendTelegramPhoto(
  channelId: string,
  imageUrl: string,
  caption?: string,
  botToken?: string,
): Promise<SendResult> {
  const { token, chatId } = resolveTelegramBot(channelId, botToken);
  if (!token) return { success: false, channel: "telegram", error: "No bot token configured" };

  try {
    const payload: any = {
      chat_id: chatId,
      photo: imageUrl,
    };

    if (caption) {
      payload.caption = caption;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as any;
    if (data.ok) {
      return { success: true, channel: "telegram", messageId: data.result?.message_id };
    }
    return { success: false, channel: "telegram", error: data.description || "Telegram sendPhoto error" };
  } catch (err: any) {
    return { success: false, channel: "telegram", error: err.message };
  }
}

// ── WhatsApp Cloud ───────────────────────────────────────────────────────────

async function uploadWhatsAppMedia(
  base64Data: string,
  mimeType: string,
): Promise<{ mediaId: string } | { error: string }> {
  const token = process.env.WHATSAPP_TOKEN ?? process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { error: "WhatsApp Cloud not configured" };

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data.replace(/^data:[^;]+;base64,/, ""), "base64");

  // Build multipart form — Node's FormData (available in Node 18+)
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", new Blob([buffer], { type: mimeType }), "upload");

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    );
    const data = await res.json() as any;
    if (data.id) return { mediaId: data.id };
    return { error: JSON.stringify(data.error || data) };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function sendWhatsAppCloudImage(
  phone: string,
  base64Data: string,
  mimeType: string,
  caption?: string,
): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN ?? process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { success: false, channel: "whatsapp_cloud", error: "WhatsApp Cloud not configured" };
  }

  const upload = await uploadWhatsAppMedia(base64Data, mimeType);
  if ("error" in upload) {
    return { success: false, channel: "whatsapp_cloud", error: upload.error };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone?.replace(/\D/g, ""),
          type: "image",
          image: { id: upload.mediaId, ...(caption ? { caption } : {}) },
        }),
      },
    );
    const data = await res.json() as any;
    const msgId = data.messages?.[0]?.id;
    if (msgId) return { success: true, channel: "whatsapp_cloud", messageId: msgId };
    return { success: false, channel: "whatsapp_cloud", error: JSON.stringify(data.error || data) };
  } catch (err: any) {
    return { success: false, channel: "whatsapp_cloud", error: err.message };
  }
}

async function sendWhatsAppCloudText(phone: string, text: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN ?? process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { success: false, channel: "whatsapp_cloud", error: "WhatsApp Cloud not configured" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone?.replace(/\D/g, ""),
          type: "text",
          text: { body: text },
        }),
      },
    );
    const data = await res.json() as any;
    const msgId = data.messages?.[0]?.id;
    if (msgId) {
      return { success: true, channel: "whatsapp_cloud", messageId: msgId };
    }
    return { success: false, channel: "whatsapp_cloud", error: JSON.stringify(data.error || data) };
  } catch (err: any) {
    return { success: false, channel: "whatsapp_cloud", error: err.message };
  }
}
