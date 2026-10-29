// Set the mode before dotenv/config is imported; works in Windows npm scripts.
export {};
process.env.TWITCH_MODE = 'live';
await import('./index');
