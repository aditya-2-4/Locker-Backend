import mqtt from 'mqtt';
import readline from 'readline';

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const LOCKER_ID = process.env.LOCKER_ID || 'locker-01';

console.log('=====================================================');
console.log(`🤖 Starting Mock ESP32 Simulator for [${LOCKER_ID}]`);
console.log(`📡 Connecting to broker at ${BROKER_URL}...`);
console.log('=====================================================');

const client = mqtt.connect(BROKER_URL, {
  clientId: `esp32_mock_${LOCKER_ID}`,
  clean: true,
  will: {
    topic: `locker/${LOCKER_ID}/status`,
    payload: Buffer.from('offline'),
    qos: 1,
    retain: true,
  },
});

client.on('connect', () => {
  console.log(`\n✅ Mock ESP32 Connected!`);

  // Publish online status with retain flag
  client.publish(`locker/${LOCKER_ID}/status`, 'online', { qos: 1, retain: true });
  console.log(`📢 Published status 'online' to locker/${LOCKER_ID}/status`);

  // Subscribe to locker commands
  client.subscribe(`locker/${LOCKER_ID}/lock/open`);
  client.subscribe(`locker/${LOCKER_ID}/lcd`);
  console.log(`👂 Subscribed to locker/${LOCKER_ID}/lock/open and /lcd`);

  // Start 30s heartbeat
  setInterval(() => {
    const hb = JSON.stringify({ uptime_sec: Math.floor(process.uptime()), rssi: -58 });
    client.publish(`locker/${LOCKER_ID}/heartbeat`, hb);
    console.log(`💓 Heartbeat sent: ${hb}`);
  }, 30000);

  printMenu();
});

client.on('message', (topic, message) => {
  const msgStr = message.toString();
  console.log(`\n📥 ESP32 RECEIVED [${topic}]: ${msgStr}`);

  if (topic === `locker/${LOCKER_ID}/lock/open`) {
    let payload = {};
    try {
      payload = JSON.parse(msgStr);
    } catch {}

    const compNum = payload.compartment || 1;
    console.log(`⚡ [HARDWARE] Solenoid Relay GPIO26 HIGH -> Comp #${compNum} UNLOCKED!`);
    console.log(`⏳ Simulating door open for 4 seconds...`);

    setTimeout(() => {
      console.log(`🔒 [HARDWARE] Solenoid Relay GPIO26 LOW -> Door locked.`);
      client.publish(
        `locker/${LOCKER_ID}/lock/closed`,
        JSON.stringify({ compartment: compNum, timestamp: Date.now() })
      );
      console.log(`📤 Published lock confirmation to locker/${LOCKER_ID}/lock/closed`);
    }, 4000);
  }

  if (topic === `locker/${LOCKER_ID}/lcd`) {
    try {
      const lcd = JSON.parse(msgStr);
      console.log(`\n┌────────────────────────────┐`);
      console.log(`│ 📺 LCD 16x2 DISPLAY        │`);
      console.log(`│ Line 1: ${(lcd.line1 || '').padEnd(19)}│`);
      console.log(`│ Line 2: ${(lcd.line2 || '').padEnd(19)}│`);
      console.log(`└────────────────────────────┘\n`);
    } catch {
      console.log(`📺 [LCD 16x2]: ${msgStr}`);
    }
  }
});

client.on('error', (err) => {
  console.error('❌ MQTT Simulator error:', err.message);
});

function printMenu() {
  console.log('\n--- INTERACTIVE TESTBENCH MENU ---');
  console.log('1. Tap Student RFID (UID: A1B2C3D4 - Jane Doe)');
  console.log('2. Tap Admin RFID (UID: E2000019 - Dr. Sarah Connor)');
  console.log('3. Tap Unregistered RFID (UID: 99999999)');
  console.log('4. IR Sensor: Book placed in Compartment 1 (book_detected)');
  console.log('5. IR Sensor: Book removed from Compartment 1 (empty)');
  console.log('6. IR Sensor: Book placed in Compartment 2 (book_detected)');
  console.log('7. IR Sensor: Book removed from Compartment 2 (empty)');
  console.log('8. Run Automated Demo Sequence (Cycle all events)');
  console.log('q. Quit simulator\n');
}

// Setup console input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('line', (input) => {
  const choice = input.trim().toLowerCase();

  switch (choice) {
    case '1':
      console.log('📡 Tapping Student Card (A1B2C3D4)...');
      client.publish(
        `locker/${LOCKER_ID}/rfid`,
        JSON.stringify({ uid: 'A1B2C3D4', timestamp: Date.now() })
      );
      break;

    case '2':
      console.log('📡 Tapping Admin Card (E2000019)...');
      client.publish(
        `locker/${LOCKER_ID}/rfid`,
        JSON.stringify({ uid: 'E2000019', timestamp: Date.now() })
      );
      break;

    case '3':
      console.log('📡 Tapping Unregistered Card (99999999)...');
      client.publish(
        `locker/${LOCKER_ID}/rfid`,
        JSON.stringify({ uid: '99999999', timestamp: Date.now() })
      );
      break;

    case '4':
      console.log('🟢 IR Sensor: Compartment 1 -> book_detected');
      client.publish(
        `locker/${LOCKER_ID}/sensor`,
        JSON.stringify({ compartment: 1, state: 'book_detected' })
      );
      break;

    case '5':
      console.log('⚪ IR Sensor: Compartment 1 -> empty');
      client.publish(
        `locker/${LOCKER_ID}/sensor`,
        JSON.stringify({ compartment: 1, state: 'empty' })
      );
      break;

    case '6':
      console.log('🟢 IR Sensor: Compartment 2 -> book_detected');
      client.publish(
        `locker/${LOCKER_ID}/sensor`,
        JSON.stringify({ compartment: 2, state: 'book_detected' })
      );
      break;

    case '7':
      console.log('⚪ IR Sensor: Compartment 2 -> empty');
      client.publish(
        `locker/${LOCKER_ID}/sensor`,
        JSON.stringify({ compartment: 2, state: 'empty' })
      );
      break;

    case '8':
      runAutoSequence();
      break;

    case 'q':
      console.log('👋 Shutting down simulator...');
      client.publish(`locker/${LOCKER_ID}/status`, 'offline', { qos: 1, retain: true }, () => {
        client.end();
        process.exit(0);
      });
      break;

    default:
      printMenu();
  }
});

function runAutoSequence() {
  console.log('\n🚀 Running Automated Demo Sequence (watching live events on dashboard)...');

  console.log('Step 1: Student swipes card to borrow a book...');
  client.publish(`locker/${LOCKER_ID}/rfid`, JSON.stringify({ uid: 'A1B2C3D4', timestamp: Date.now() }));

  setTimeout(() => {
    console.log('Step 2: Student removes book from Compartment 1...');
    client.publish(`locker/${LOCKER_ID}/sensor`, JSON.stringify({ compartment: 1, state: 'empty' }));
  }, 3000);

  setTimeout(() => {
    console.log('Step 3: Student closes door...');
    client.publish(`locker/${LOCKER_ID}/lock/closed`, JSON.stringify({ compartment: 1 }));
  }, 6000);

  setTimeout(() => {
    console.log('Step 4: Another student swipes card to return/donate a book...');
    client.publish(`locker/${LOCKER_ID}/rfid`, JSON.stringify({ uid: 'F4E3D2C1', timestamp: Date.now() }));
  }, 9000);

  setTimeout(() => {
    console.log('Step 5: Book placed into Compartment 1...');
    client.publish(`locker/${LOCKER_ID}/sensor`, JSON.stringify({ compartment: 1, state: 'book_detected' }));
  }, 12000);

  setTimeout(() => {
    console.log('✅ Automated Demo Sequence completed!\n');
    printMenu();
  }, 15000);
}
