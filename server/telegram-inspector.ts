import TelegramBot from 'node-telegram-bot-api';

export interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: any;
  custom_emoji_id?: string;
  language?: string;
}

export interface InspectionResult {
  text: string;
  html: string;
  customEmojis: Array<{
    id: string;
    char: string;
    offset: number;
    length: number;
  }>;
  entitySummary: Array<{
    type: string;
    count: number;
    samples: string[];
  }>;
  allEntities: Array<{
    type: string;
    offset: number;
    length: number;
    text: string;
    extra?: string;
  }>;
  forwardInfo?: {
    isForwarded: boolean;
    fromName?: string;
    fromUsername?: string;
    fromId?: string | number;
    chatTitle?: string;
    chatUsername?: string;
    chatId?: string | number;
    messageId?: number;
    date?: number;
  };
}

export interface InspectionRecord {
  id: string;
  timestamp: string;
  chatId: string;
  userId: string;
  username?: string;
  userFirstName?: string;
  rawText: string;
  reconstructedHtml: string;
  customEmojis: Array<{
    id: string;
    char: string;
    offset: number;
    length: number;
  }>;
  entitySummary: Array<{
    type: string;
    count: number;
    samples: string[];
  }>;
  forwardInfo?: InspectionResult['forwardInfo'];
}

// In-memory trace history store
const traceHistory: InspectionRecord[] = [];

export function getTraceHistory(): InspectionRecord[] {
  return traceHistory;
}

export function clearTraceHistory(): void {
  traceHistory.length = 0;
}

export function deleteTraceRecord(id: string): boolean {
  const idx = traceHistory.findIndex(t => t.id === id);
  if (idx !== -1) {
    traceHistory.splice(idx, 1);
    return true;
  }
  return false;
}

export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Reconstructs Telegram text or caption with raw entities into Telegram HTML format.
 * Correctly handles nested formatting, custom emojis (<tg-emoji emoji-id="..."></tg-emoji>),
 * blockquotes, spoilers, code blocks, links, etc.
 */
export function convertEntitiesToHTML(text: string, entities?: TelegramEntity[]): string {
  if (!text) return '';
  if (!entities || entities.length === 0) return escapeHTML(text);

  const tagsAtIndex: Map<number, { type: 'open' | 'close'; tag: string; priority: number }[]> = new Map();

  const addTag = (index: number, type: 'open' | 'close', tag: string, priority: number) => {
    if (!tagsAtIndex.has(index)) {
      tagsAtIndex.set(index, []);
    }
    tagsAtIndex.get(index)!.push({ type, tag, priority });
  };

  entities.forEach((entity, idx) => {
    let openTag = '';
    let closeTag = '';

    switch (entity.type) {
      case 'bold':
        openTag = '<b>';
        closeTag = '</b>';
        break;
      case 'italic':
        openTag = '<i>';
        closeTag = '</i>';
        break;
      case 'underline':
        openTag = '<u>';
        closeTag = '</u>';
        break;
      case 'strikethrough':
        openTag = '<s>';
        closeTag = '</s>';
        break;
      case 'spoiler':
        openTag = '<tg-spoiler>';
        closeTag = '</tg-spoiler>';
        break;
      case 'code':
        openTag = '<code>';
        closeTag = '</code>';
        break;
      case 'pre':
        if (entity.language) {
          openTag = `<pre><code class="language-${escapeHTML(entity.language)}">`;
          closeTag = '</code></pre>';
        } else {
          openTag = '<pre>';
          closeTag = '</pre>';
        }
        break;
      case 'blockquote':
        openTag = '<blockquote>';
        closeTag = '</blockquote>';
        break;
      case 'expandable_blockquote':
        openTag = '<blockquote expandable>';
        closeTag = '</blockquote>';
        break;
      case 'text_link':
        if (entity.url) {
          openTag = `<a href="${escapeHTML(entity.url)}">`;
          closeTag = '</a>';
        }
        break;
      case 'custom_emoji':
        if (entity.custom_emoji_id) {
          openTag = `<tg-emoji emoji-id="${entity.custom_emoji_id}">`;
          closeTag = '</tg-emoji>';
        }
        break;
      case 'text_mention':
        if (entity.user) {
          openTag = `<a href="tg://user?id=${entity.user.id}">`;
          closeTag = '</a>';
        }
        break;
      default:
        break;
    }

    if (openTag && closeTag) {
      addTag(entity.offset, 'open', openTag, idx);
      addTag(entity.offset + entity.length, 'close', closeTag, -idx);
    }
  });

  let result = '';
  for (let i = 0; i <= text.length; i++) {
    if (tagsAtIndex.has(i)) {
      const items = tagsAtIndex.get(i)!;
      const closeItems = items.filter(x => x.type === 'close').sort((a, b) => b.priority - a.priority);
      for (const item of closeItems) {
        result += item.tag;
      }
      const openItems = items.filter(x => x.type === 'open').sort((a, b) => a.priority - b.priority);
      for (const item of openItems) {
        result += item.tag;
      }
    }

    if (i < text.length) {
      const char = text[i];
      if (char === '&') result += '&amp;';
      else if (char === '<') result += '&lt;';
      else if (char === '>') result += '&gt;';
      else result += char;
    }
  }

  return result;
}

export function inspectTelegramMessage(msg: TelegramBot.Message): InspectionResult {
  let text = msg.text || msg.caption || '';
  if (!text) {
    if (msg.photo) text = '[Photo Message]';
    else if (msg.video) text = '[Video Message]';
    else if (msg.document) text = `[Document: ${msg.document.file_name || 'File'}]`;
    else if (msg.sticker) text = `[Sticker: ${msg.sticker.emoji || 'Sticker'}]`;
    else if (msg.audio) text = '[Audio Message]';
    else if (msg.voice) text = '[Voice Message]';
    else if (msg.location) text = `[Location: ${msg.location.latitude}, ${msg.location.longitude}]`;
    else if (msg.contact) text = `[Contact: ${msg.contact.first_name}]`;
    else text = '[Media Message]';
  }

  const rawEntities: TelegramEntity[] = (msg.entities || msg.caption_entities || []) as TelegramEntity[];

  // Reconstruct HTML representation
  const html = convertEntitiesToHTML(text, rawEntities);

  // Custom emojis map
  const customEmojisMap = new Map<string, { id: string; char: string; offset: number; length: number }>();
  const allEntitiesList: Array<{ type: string; offset: number; length: number; text: string; extra?: string }> = [];

  rawEntities.forEach(entity => {
    const entityText = text.substring(entity.offset, entity.offset + entity.length);
    let extra: string | undefined = undefined;

    if (entity.type === 'custom_emoji' && entity.custom_emoji_id) {
      extra = `ID: ${entity.custom_emoji_id}`;
      if (!customEmojisMap.has(entity.custom_emoji_id)) {
        customEmojisMap.set(entity.custom_emoji_id, {
          id: entity.custom_emoji_id,
          char: entityText,
          offset: entity.offset,
          length: entity.length
        });
      }
    } else if (entity.type === 'text_link' && entity.url) {
      extra = `URL: ${entity.url}`;
    } else if (entity.type === 'text_mention' && entity.user) {
      extra = `User: ${entity.user.first_name} (${entity.user.id})`;
    } else if (entity.type === 'pre' && entity.language) {
      extra = `Lang: ${entity.language}`;
    }

    allEntitiesList.push({
      type: entity.type,
      offset: entity.offset,
      length: entity.length,
      text: entityText,
      extra
    });
  });

  // Group entities by type
  const typeGroupMap = new Map<string, string[]>();
  rawEntities.forEach(e => {
    const snippet = text.substring(e.offset, e.offset + e.length);
    if (!typeGroupMap.has(e.type)) {
      typeGroupMap.set(e.type, []);
    }
    typeGroupMap.get(e.type)!.push(snippet);
  });

  const entitySummary = Array.from(typeGroupMap.entries()).map(([type, samples]) => ({
    type,
    count: samples.length,
    samples: samples.slice(0, 3)
  }));

  // Extract Forward Info
  let forwardInfo: InspectionResult['forwardInfo'] = undefined;
  const isForwarded = Boolean(
    msg.forward_from ||
    msg.forward_from_chat ||
    msg.forward_date ||
    (msg as any).forward_origin
  );

  if (isForwarded) {
    forwardInfo = {
      isForwarded: true,
      fromName: msg.forward_from ? `${msg.forward_from.first_name || ''} ${msg.forward_from.last_name || ''}`.trim() : (msg as any).forward_sender_name,
      fromUsername: msg.forward_from?.username,
      fromId: msg.forward_from?.id,
      chatTitle: msg.forward_from_chat?.title,
      chatUsername: msg.forward_from_chat?.username,
      chatId: msg.forward_from_chat?.id,
      messageId: msg.forward_from_message_id,
      date: msg.forward_date
    };
  }

  return {
    text,
    html,
    customEmojis: Array.from(customEmojisMap.values()),
    entitySummary,
    allEntities: allEntitiesList,
    forwardInfo
  };
}

/**
 * Traces a Telegram message to server console and sends a comprehensive inspection report to the user.
 * Sends separate copyable messages for each custom emoji ID and HTML code for instant 1-tap copying on Telegram!
 */
export async function processTelegramInspectorTrace(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  options?: { isExplicitCommand?: boolean; io?: any }
): Promise<boolean> {
  const targetMsg = (options?.isExplicitCommand && msg.reply_to_message) ? msg.reply_to_message : msg;
  const rawEntities = (targetMsg.entities || targetMsg.caption_entities || []);

  const inspection = inspectTelegramMessage(targetMsg);

  // Store in trace history for Admin Dashboard
  const record: InspectionRecord = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    chatId: targetMsg.chat.id.toString(),
    userId: targetMsg.from?.id ? targetMsg.from.id.toString() : 'unknown',
    username: targetMsg.from?.username,
    userFirstName: targetMsg.from?.first_name,
    rawText: inspection.text,
    reconstructedHtml: inspection.html,
    customEmojis: inspection.customEmojis,
    entitySummary: inspection.entitySummary,
    forwardInfo: inspection.forwardInfo
  };

  traceHistory.unshift(record);
  if (traceHistory.length > 200) {
    traceHistory.pop();
  }

  if (options?.io) {
    options.io.emit('telegram_inspector_new_trace', record);
  }

  // 1. Log detailed trace to server console
  console.log('\n=================== [TELEGRAM ENTITY TRACE] ===================');
  console.log(`[Time] ${record.timestamp}`);
  console.log(`[From User] ID: ${targetMsg.from?.id} | Name: ${targetMsg.from?.first_name} (@${targetMsg.from?.username || 'none'})`);
  console.log(`[Chat ID] ${targetMsg.chat.id}`);
  console.log(`[Raw Text/Caption] "${inspection.text}"`);
  console.log(`[Total Entities] ${rawEntities.length}`);

  if (inspection.forwardInfo?.isForwarded) {
    const f = inspection.forwardInfo;
    console.log(`[Forwarded Source] ${f.chatTitle || f.fromName || 'Unknown Source'} (Chat ID: ${f.chatId || f.fromId || 'N/A'}, Msg ID: ${f.messageId || 'N/A'})`);
  }

  if (inspection.customEmojis.length > 0) {
    console.log(`[Custom Emojis Detected] Total: ${inspection.customEmojis.length}`);
    inspection.customEmojis.forEach(ce => {
      console.log(`   -> Custom Emoji ID: ${ce.id} (Char: "${ce.char}")`);
    });
  }

  if (inspection.entitySummary.length > 0) {
    console.log(`[Entities Breakdown] ${inspection.entitySummary.map(e => `${e.type}: ${e.count}`).join(', ')}`);
  }

  console.log(`[Reconstructed Telegram HTML]:\n${inspection.html}`);
  console.log('=================================================================\n');

  // 2. Build main user-facing inspection report summary message
  let reportMsg = `🔍 <b>Telegram Entity & Emoji Inspector</b>\n`;
  reportMsg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (inspection.customEmojis.length > 0) {
    reportMsg += `🌟 <b>Detected Custom Emoji IDs (${inspection.customEmojis.length}):</b>\n`;
    inspection.customEmojis.forEach(ce => {
      reportMsg += `• Emoji: <tg-emoji emoji-id="${ce.id}">${ce.char || '⭐'}</tg-emoji> | ID: <code>${ce.id}</code>\n`;
    });
    reportMsg += `\n`;
  }

  if (inspection.entitySummary.length > 0) {
    reportMsg += `🏷️ <b>Detected Formatting & Entities:</b>\n`;
    inspection.entitySummary.forEach(e => {
      let icon = '▪️';
      if (e.type === 'custom_emoji') icon = '⭐';
      else if (e.type === 'bold') icon = '<b>B</b>';
      else if (e.type === 'italic') icon = '<i>I</i>';
      else if (e.type === 'underline') icon = '<u>U</u>';
      else if (e.type === 'strikethrough') icon = '<s>S</s>';
      else if (e.type === 'spoiler') icon = '🙈';
      else if (e.type === 'code' || e.type === 'pre') icon = '💻';
      else if (e.type === 'blockquote' || e.type === 'expandable_blockquote') icon = '💬';
      else if (e.type === 'text_link' || e.type === 'url') icon = '🔗';
      else if (e.type === 'text_mention' || e.type === 'mention') icon = '👤';

      reportMsg += `${icon} <b>${escapeHTML(e.type)}</b> (${e.count})\n`;
    });
    reportMsg += `\n`;
  }

  if (inspection.forwardInfo?.isForwarded) {
    const f = inspection.forwardInfo;
    reportMsg += `⏩ <b>Forward Information:</b>\n`;
    if (f.chatTitle) reportMsg += `• Source Chat: <b>${escapeHTML(f.chatTitle)}</b>${f.chatUsername ? ` (@${escapeHTML(f.chatUsername)})` : ''}\n`;
    if (f.fromName) reportMsg += `• Original Sender: <b>${escapeHTML(f.fromName)}</b>${f.fromUsername ? ` (@${escapeHTML(f.fromUsername)})` : ''}\n`;
    if (f.messageId) reportMsg += `• Message ID: <code>${f.messageId}</code>\n`;
    if (f.date) reportMsg += `• Forward Date: <code>${new Date(f.date * 1000).toLocaleString()}</code>\n`;
    reportMsg += `\n`;
  }

  reportMsg += `👇 <i>Separate copyable messages sent below!</i>`;

  try {
    await bot.sendMessage(targetMsg.chat.id, reportMsg, {
      parse_mode: 'HTML',
      reply_to_message_id: targetMsg.message_id
    });
  } catch (err: any) {
    console.error('[Inspector Error] Failed to send HTML inspection report:', err.message);
  }

  // 3. Send SEPARATE follow-up messages for EACH Custom Emoji ID (Instant 1-Tap Copy on Telegram Mobile/Desktop!)
  if (inspection.customEmojis.length > 0) {
    for (const ce of inspection.customEmojis) {
      const emojiMsg = `Emoji: <tg-emoji emoji-id="${ce.id}">${ce.char || '⭐'}</tg-emoji>\n\n` +
        `🔑 <b>Emoji ID (Tap to copy):</b>\n<code>${ce.id}</code>\n\n` +
        `🏷️ <b>HTML Tag:</b>\n<code>&lt;tg-emoji emoji-id="${ce.id}"&gt;${escapeHTML(ce.char || '⭐')}&lt;/tg-emoji&gt;</code>`;
      
      try {
        await bot.sendMessage(targetMsg.chat.id, emojiMsg, { parse_mode: 'HTML' });
      } catch (e) {
        try {
          await bot.sendMessage(targetMsg.chat.id, `Emoji ID: ${ce.id}`);
        } catch (e2) {}
      }
    }
  }

  // 4. Send SEPARATE follow-up message for Full Reconstructed Telegram HTML Code
  if (inspection.html) {
    const htmlMsg = `📜 <b>Telegram HTML Code (Tap code block to copy):</b>\n` +
      `<pre><code class="language-html">${escapeHTML(inspection.html)}</code></pre>`;
    
    try {
      await bot.sendMessage(targetMsg.chat.id, htmlMsg, { parse_mode: 'HTML' });
    } catch (e) {}
  }

  return true;
}
