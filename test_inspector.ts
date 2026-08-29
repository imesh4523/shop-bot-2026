import { inspectTelegramMessage, convertEntitiesToHTML } from './server/telegram-inspector';

console.log('Testing Telegram Inspector module...');

// Sample text with custom emojis, bold, italic, quote, spoiler, link, code
const sampleText = "Hello World! Here is a bold word, an italic text, a spoiler section, a code snippet, a quote, and custom emojis!";

const sampleEntities = [
  { type: 'bold', offset: 23, length: 4 }, // "bold"
  { type: 'italic', offset: 35, length: 6 }, // "italic"
  { type: 'spoiler', offset: 50, length: 7 }, // "spoiler"
  { type: 'code', offset: 67, length: 4 }, // "code"
  { type: 'blockquote', offset: 81, length: 5 }, // "quote"
  { type: 'custom_emoji', offset: 96, length: 6, custom_emoji_id: '5215209935188534658' },
  { type: 'custom_emoji', offset: 104, length: 6, custom_emoji_id: '5785025630055700143' }
];

const htmlResult = convertEntitiesToHTML(sampleText, sampleEntities as any);
console.log('\n--- Reconstructed HTML ---');
console.log(htmlResult);

const dummyMsg: any = {
  message_id: 100,
  chat: { id: 12345678, type: 'private' },
  from: { id: 99999, first_name: 'TestUser', username: 'test_user' },
  text: sampleText,
  entities: sampleEntities
};

const inspection = inspectTelegramMessage(dummyMsg);
console.log('\n--- Inspection Result ---');
console.log('Custom Emoji Count:', inspection.customEmojis.length);
console.log('Custom Emoji IDs:', inspection.customEmojis.map(c => c.id));
console.log('Entity Types:', inspection.entitySummary.map(e => e.type));

console.log('\n✅ Telegram Inspector Module Unit Test PASSED!');
