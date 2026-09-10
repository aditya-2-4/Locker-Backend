import { prisma } from '../config/db.js';
import { publishMQTT } from '../config/mqtt.js';
import { emitEvent } from './socketService.js';

// Track recent scans to associate sensor transitions with user actions
const recentUserScans = new Map(); // lockerId -> { user, timestamp }

export async function handleIncomingMQTT(topic, message) {
  try {
    const parts = topic.split('/');
    if (parts[0] !== 'locker' || parts.length < 3) {
      return;
    }

    const lockerId = parts[1];
    const action = parts.slice(2).join('/');

    let parsedPayload = null;
    try {
      parsedPayload = JSON.parse(message);
    } catch {
      parsedPayload = message;
    }

    console.log(`📥 MQTT Received [${topic}]:`, parsedPayload);

    switch (action) {
      case 'status':
        await handleLockerStatus(lockerId, parsedPayload);
        break;

      case 'rfid':
        await handleRFIDScan(lockerId, parsedPayload);
        break;

      case 'sensor':
        await handleSensorUpdate(lockerId, parsedPayload);
        break;

      case 'lock/closed':
        await handleLockClosed(lockerId, parsedPayload);
        break;

      case 'heartbeat':
        await handleHeartbeat(lockerId, parsedPayload);
        break;

      default:
        console.log(`Unhandled MQTT topic action: ${action}`);
    }
  } catch (error) {
    console.error('❌ Error handling MQTT message:', error);
  }
}

// 1. Locker Status (online / offline)
async function handleLockerStatus(lockerId, payload) {
  const statusStr = typeof payload === 'object' && payload.status ? payload.status : String(payload).trim();
  const normalizedStatus = statusStr.toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE';

  const locker = await prisma.locker.upsert({
    where: { id: lockerId },
    update: {
      status: normalizedStatus,
      last_seen: new Date(),
    },
    create: {
      id: lockerId,
      location_name: `Community Station (${lockerId})`,
      compartment_count: 4,
      status: normalizedStatus,
      last_seen: new Date(),
    },
  });

  // Device log
  await prisma.deviceLog.create({
    data: {
      locker_id: lockerId,
      event_type: 'STATUS_CHANGE',
      payload_json: JSON.stringify({ status: normalizedStatus }),
    },
  });

  emitEvent('locker:status', {
    lockerId,
    status: normalizedStatus,
    timestamp: new Date().toISOString(),
  });

  emitEvent('device:log', {
    lockerId,
    eventType: 'STATUS_CHANGE',
    payload: { status: normalizedStatus },
    createdAt: new Date().toISOString(),
  });
}

// 2. RFID Card Scanned
async function handleRFIDScan(lockerId, payload) {
  const uid = (typeof payload === 'object' ? payload.uid : String(payload)).trim().toUpperCase();

  // Look up user by RFID UID
  const user = await prisma.user.findFirst({
    where: { rfid_uid: uid },
  });

  if (!user) {
    console.warn(`⛔ Unauthorized RFID scan at ${lockerId}: UID ${uid}`);

    // Tell ESP32 LCD to show denial
    publishMQTT(`locker/${lockerId}/lcd`, {
      line1: 'ACCESS DENIED',
      line2: 'Unrecognized Tag',
    });

    await prisma.deviceLog.create({
      data: {
        locker_id: lockerId,
        event_type: 'RFID_SCAN_DENIED',
        payload_json: JSON.stringify({ uid, reason: 'Unregistered RFID card' }),
      },
    });

    emitEvent('device:log', {
      lockerId,
      eventType: 'RFID_SCAN_DENIED',
      payload: { uid, message: 'Unregistered card scanned' },
      createdAt: new Date().toISOString(),
    });

    emitEvent('rfid:scanned', {
      lockerId,
      uid,
      user: null,
      doorStatus: 'DENIED',
      reason: 'Unregistered Card',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // User recognized! Record recent scan session
  recentUserScans.set(lockerId, {
    user,
    timestamp: Date.now(),
  });

  console.log(`✅ Authorized user: ${user.name} (${user.role}) at ${lockerId}`);

  // Determine which compartment to unlock (e.g. compartment 1 or user's reserved/target compartment)
  let targetCompartment = await prisma.compartment.findFirst({
    where: { locker_id: lockerId },
    orderBy: { compartment_number: 'asc' },
  });

  // Instruct ESP32 to unlock
  publishMQTT(`locker/${lockerId}/lock/open`, {
    compartment: targetCompartment ? targetCompartment.compartment_number : 1,
    action: 'open',
    user: user.name,
  });

  // Display greeting on LCD
  publishMQTT(`locker/${lockerId}/lcd`, {
    line1: `Hi ${user.name.split(' ')[0]}!`,
    line2: 'Unlocked. Open Door',
  });

  // Log device event
  await prisma.deviceLog.create({
    data: {
      locker_id: lockerId,
      event_type: 'RFID_SCAN_SUCCESS',
      payload_json: JSON.stringify({ uid, userId: user.id, userName: user.name }),
    },
  });

  // Permanently save the door UNLOCK transaction
  const tx = await prisma.transaction.create({
    data: {
      user_id: user.id,
      locker_id: lockerId,
      compartment_id: targetCompartment ? targetCompartment.id : null,
      type: 'UNLOCK',
      method: 'RFID',
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      locker: true,
      compartment: true
    }
  });

  emitEvent('device:log', {
    lockerId,
    eventType: 'RFID_SCAN_SUCCESS',
    payload: { uid, userName: user.name, role: user.role },
    createdAt: new Date().toISOString(),
  });

  // Also emit the transaction so it shows in the ActivityFeed
  emitEvent('transaction:new', tx);

  // EMIT PROMINENT RFID SCANNED EVENT WITH FULL CARD DETAILS FOR WEB POPUP
  emitEvent('rfid:scanned', {
    lockerId,
    uid,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rfid_uid: user.rfid_uid,
    },
    doorStatus: 'OPEN',
    compartmentNumber: targetCompartment ? targetCompartment.compartment_number : 1,
    timestamp: new Date().toISOString(),
  });
}

// 3. IR Sensor State Update
async function handleSensorUpdate(lockerId, payload) {
  const compartmentNumber = parseInt(payload.compartment || payload.compartment_number || 1, 10);
  const rawState = (payload.state || payload.status || '').toLowerCase();
  const isBookDetected = rawState === 'book_detected' || rawState === 'occupied' || rawState === 'true';
  const compStatus = isBookDetected ? 'OCCUPIED' : 'EMPTY';

  // Find or create compartment
  let compartment = await prisma.compartment.findUnique({
    where: {
      locker_id_compartment_number: {
        locker_id: lockerId,
        compartment_number: compartmentNumber,
      },
    },
    include: {
      book: true,
    },
  });

  if (!compartment) {
    compartment = await prisma.compartment.create({
      data: {
        locker_id: lockerId,
        compartment_number: compartmentNumber,
        status: compStatus,
      },
      include: {
        book: true,
      },
    });
  } else {
    compartment = await prisma.compartment.update({
      where: { id: compartment.id },
      data: { status: compStatus },
      include: { book: true },
    });
  }

  // Check if a user recently swiped card at this locker (within last 4 minutes)
  const session = recentUserScans.get(lockerId);
  const now = Date.now();
  const activeUser = session && now - session.timestamp < 240000 ? session.user : null;

  let createdTx = null;

  if (isBookDetected) {
    // Book was placed inside
    let book = compartment.book;
    if (!book) {
      // Find an unassigned or borrowed book to assign, or create a donated book record
      book = await prisma.book.findFirst({
        where: {
          OR: [{ status: 'BORROWED' }, { compartment_id: null }],
        },
      });

      if (book) {
        book = await prisma.book.update({
          where: { id: book.id },
          data: {
            compartment_id: compartment.id,
            status: 'AVAILABLE',
          },
        });
      }
    } else {
      book = await prisma.book.update({
        where: { id: book.id },
        data: { status: 'AVAILABLE' },
      });
    }

    if (activeUser) {
      createdTx = await prisma.transaction.create({
        data: {
          user_id: activeUser.id,
          book_id: book ? book.id : null,
          locker_id: lockerId,
          compartment_id: compartment.id,
          type: book ? 'RETURN' : 'DONATE',
          method: 'RFID',
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          book: true,
          locker: { select: { id: true, location_name: true } },
        },
      });
    }

    // LCD acknowledgment
    publishMQTT(`locker/${lockerId}/lcd`, {
      line1: 'Book Detected!',
      line2: 'Thank you!',
    });
  } else {
    // Book was removed (Borrow action)
    if (compartment.book) {
      const book = await prisma.book.update({
        where: { id: compartment.book.id },
        data: {
          status: 'BORROWED',
          compartment_id: null,
        },
      });

      if (activeUser) {
        createdTx = await prisma.transaction.create({
          data: {
            user_id: activeUser.id,
            book_id: book.id,
            locker_id: lockerId,
            compartment_id: compartment.id,
            type: 'BORROW',
            method: 'RFID',
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            book: true,
            locker: { select: { id: true, location_name: true } },
          },
        });
      }

      emitEvent('book:updated', book);
    }

    // LCD acknowledgment
    publishMQTT(`locker/${lockerId}/lcd`, {
      line1: 'Book Removed',
      line2: 'Enjoy Reading!',
    });
  }

  // Log device sensor event
  await prisma.deviceLog.create({
    data: {
      locker_id: lockerId,
      event_type: 'SENSOR_TRIGGER',
      payload_json: JSON.stringify({
        compartmentNumber,
        state: compStatus,
        bookDetected: isBookDetected,
      }),
    },
  });

  // EMIT SENSOR UPDATE: Real-time push to frontend with live data collector
  emitEvent('sensor:update', {
    lockerId,
    compartmentId: compartment.id,
    compartmentNumber,
    state: compStatus,
    bookDetected: isBookDetected,
    timestamp: new Date().toISOString(),
  });

  if (createdTx) {
    emitEvent('transaction:new', createdTx);
  }

  emitEvent('device:log', {
    lockerId,
    eventType: 'SENSOR_TRIGGER',
    payload: { compartmentNumber, state: compStatus },
    createdAt: new Date().toISOString(),
  });
}

// 4. Lock Closed Confirmation
async function handleLockClosed(lockerId, payload) {
  const compartmentNumber = parseInt(payload.compartment || 1, 10);
  console.log(`🔒 Solenoid locked on ${lockerId}, compartment ${compartmentNumber}`);

  publishMQTT(`locker/${lockerId}/lcd`, {
    line1: 'Door Locked',
    line2: 'Ready for Next',
  });

  await prisma.deviceLog.create({
    data: {
      locker_id: lockerId,
      event_type: 'LOCK_CLOSED',
      payload_json: JSON.stringify({ compartmentNumber }),
    },
  });

  emitEvent('device:log', {
    lockerId,
    eventType: 'LOCK_CLOSED',
    payload: { compartmentNumber },
    createdAt: new Date().toISOString(),
  });
}

// 5. Heartbeat
async function handleHeartbeat(lockerId, payload) {
  await prisma.locker.upsert({
    where: { id: lockerId },
    update: {
      status: 'ONLINE',
      last_seen: new Date(),
    },
    create: {
      id: lockerId,
      location_name: `Community Station (${lockerId})`,
      compartment_count: 4,
      status: 'ONLINE',
      last_seen: new Date(),
    },
  });

  emitEvent('locker:status', {
    lockerId,
    status: 'ONLINE',
    timestamp: new Date().toISOString(),
  });
}
