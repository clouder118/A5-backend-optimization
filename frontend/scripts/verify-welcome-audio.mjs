import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = resolve(root, 'src/components/guide/welcomeMessage.ts');
const audioPath = resolve(root, 'public/audio/guide-welcome.mp3');

if (!existsSync(modulePath)) {
  throw new Error('welcomeMessage.ts does not exist');
}

const moduleText = readFileSync(modulePath, 'utf8');
if (!moduleText.includes("WELCOME_MESSAGE_AUDIO_URL = '/audio/guide-welcome.mp3'")) {
  throw new Error('welcome message must use the local static guide-welcome audio URL');
}

if (!moduleText.includes('你好，我是灵山胜境 AI 导游')) {
  throw new Error('welcome message text is missing the expected guide greeting');
}

if (!existsSync(audioPath)) {
  throw new Error('public/audio/guide-welcome.mp3 does not exist');
}

const audioBytes = statSync(audioPath).size;
if (audioBytes < 1024) {
  throw new Error(`guide-welcome.mp3 is too small to be a usable speech asset: ${audioBytes} bytes`);
}

console.log(JSON.stringify({ ok: true, audioUrl: '/audio/guide-welcome.mp3', audioBytes }));
