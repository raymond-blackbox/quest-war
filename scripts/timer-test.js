const BASE_URL = 'http://127.0.0.1:3001';
const RTDB_URL = 'https://quest-war-default-rtdb.asia-southeast1.firebasedatabase.app';

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, data: json };
}

async function main() {
  const create = await post('/api/rooms', {
    name: 'TimerScript',
    hostId: 'host-script',
    hostUsername: 'Host Script',
    delaySeconds: 2,
    roundSeconds: 6,
    questionsCount: 5
  });

  console.log('Created room:', create.data);
  const roomId = create.data.roomId;

  await post(`/api/rooms/${roomId}/join`, {
    playerId: 'guest-script',
    playerUsername: 'Guest Script'
  });

  await post(`/api/rooms/${roomId}/ready`, { playerId: 'host-script', ready: true });
  await post(`/api/rooms/${roomId}/ready`, { playerId: 'guest-script', ready: true });
  await post(`/api/game/${roomId}/start`, { playerId: 'host-script' });

  setTimeout(async () => {
    const res = await fetch(`${RTDB_URL}/rooms/${roomId}.json`);
    const json = await res.json();
    console.log('Room snapshot after game start:', json);
    process.exit(0);
  }, 2000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
