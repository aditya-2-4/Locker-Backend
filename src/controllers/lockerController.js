import { prisma } from '../config/db.js';
import { publishMQTT } from '../config/mqtt.js';
import { emitEvent } from '../services/socketService.js';

export async function getLockers(req, res, next) {
  try {
    const lockers = await prisma.locker.findMany({
      include: {
        compartments: {
          orderBy: { compartment_number: 'asc' },
          include: {
            book: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    res.json({ lockers });
  } catch (error) {
    next(error);
  }
}

export async function getLockerById(req, res, next) {
  try {
    const { id } = req.params;
    const locker = await prisma.locker.findUnique({
      where: { id },
      include: {
        compartments: {
          orderBy: { compartment_number: 'asc' },
          include: {
            book: true,
          },
        },
        device_logs: {
          take: 20,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!locker) {
      return res.status(404).json({ error: 'Locker not found' });
    }

    res.json({ locker });
  } catch (error) {
    next(error);
  }
}

export async function createLocker(req, res, next) {
  try {
    const { id, location_name, compartment_count = 4 } = req.body;

    if (!id || !location_name) {
      return res.status(400).json({ error: 'Locker ID and location name are required' });
    }

    const existing = await prisma.locker.findUnique({ where: { id } });
    if (existing) {
      return res.status(400).json({ error: 'Locker ID already exists' });
    }

    const locker = await prisma.locker.create({
      data: {
        id,
        location_name,
        compartment_count: parseInt(compartment_count, 10),
        status: 'OFFLINE',
      },
    });

    // Generate compartments
    for (let i = 1; i <= locker.compartment_count; i++) {
      await prisma.compartment.create({
        data: {
          locker_id: locker.id,
          compartment_number: i,
          status: 'EMPTY',
        },
      });
    }

    const createdLocker = await prisma.locker.findUnique({
      where: { id },
      include: { compartments: true },
    });

    emitEvent('locker:status', {
      lockerId: locker.id,
      status: 'OFFLINE',
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ locker: createdLocker });
  } catch (error) {
    next(error);
  }
}

export async function unlockCompartment(req, res, next) {
  try {
    const { id } = req.params;
    const { compartment_number = 1, reason = 'Remote unlock via web UI' } = req.body;

    const locker = await prisma.locker.findUnique({ where: { id } });
    if (!locker) {
      return res.status(404).json({ error: 'Locker not found' });
    }

    // Command ESP32 over MQTT
    publishMQTT(`locker/${id}/lock/open`, {
      compartment: compartment_number,
      action: 'open',
      reason,
      triggeredBy: req.user ? req.user.name : 'Web Admin',
    });

    publishMQTT(`locker/${id}/lcd`, {
      line1: 'Remote Unlock',
      line2: `Comp #${compartment_number}`,
    });

    // Record device log
    await prisma.deviceLog.create({
      data: {
        locker_id: id,
        event_type: 'LOCK_OPEN',
        payload_json: JSON.stringify({
          compartment_number,
          triggeredBy: req.user ? req.user.name : 'Web Admin',
          reason,
        }),
      },
    });

    emitEvent('device:log', {
      lockerId: id,
      eventType: 'LOCK_OPEN',
      payload: { compartment_number, reason },
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Unlock command sent to ${id} compartment #${compartment_number}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDeviceLogs(req, res, next) {
  try {
    const { lockerId, limit = 50 } = req.query;
    const where = lockerId ? { locker_id: String(lockerId) } : {};

    const logs = await prisma.deviceLog.findMany({
      where,
      take: parseInt(limit, 10),
      orderBy: { created_at: 'desc' },
      include: {
        locker: { select: { id: true, location_name: true } },
      },
    });

    res.json({ logs });
  } catch (error) {
    next(error);
  }
}

export async function toggleLockerPower(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'ONLINE' or 'OFFLINE'

    const targetStatus = (status || 'ONLINE').toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE';

    const locker = await prisma.locker.update({
      where: { id },
      data: {
        status: targetStatus,
        last_seen: new Date(),
      },
    });

    // Publish to MQTT
    publishMQTT(`locker/${id}/status`, targetStatus.toLowerCase(), { retain: true });

    // Emit live WebSocket update
    emitEvent('locker:status', {
      lockerId: id,
      status: targetStatus,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Locker ${id} is now ${targetStatus}`,
      locker,
    });
  } catch (error) {
    next(error);
  }
}

