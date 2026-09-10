import { prisma } from '../config/db.js';
import { handleIncomingMQTT } from '../services/mqttService.js';

export async function registerRFID(req, res, next) {
  try {
    const { userId, rfid_uid } = req.body;

    if (!userId || !rfid_uid) {
      return res.status(400).json({ error: 'userId and rfid_uid are required' });
    }

    const cleanUID = rfid_uid.trim().toUpperCase();

    // Check if UID is in use by someone else
    const existing = await prisma.user.findFirst({
      where: {
        rfid_uid: cleanUID,
        id: { not: userId },
      },
    });

    if (existing) {
      return res.status(400).json({ error: `RFID UID ${cleanUID} is already assigned to ${existing.name}` });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { rfid_uid: cleanUID },
      select: { id: true, name: true, email: true, role: true, rfid_uid: true },
    });

    res.json({
      success: true,
      message: `RFID tag ${cleanUID} mapped to ${updatedUser.name}`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

export async function unmapRFID(req, res, next) {
  try {
    const { userId } = req.params;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { rfid_uid: null },
      select: { id: true, name: true, email: true, role: true, rfid_uid: null },
    });

    res.json({
      success: true,
      message: `RFID tag removed for ${updatedUser.name}`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

export async function listRFIDUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rfid_uid: true,
        created_at: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

// Direct simulator hook for web UI testbench
export async function simulateHardwareEvent(req, res, next) {
  try {
    const { lockerId = 'locker-01', eventType, payload } = req.body;

    if (eventType === 'rfid') {
      await handleIncomingMQTT(`locker/${lockerId}/rfid`, JSON.stringify(payload));
    } else if (eventType === 'sensor') {
      await handleIncomingMQTT(`locker/${lockerId}/sensor`, JSON.stringify(payload));
    } else if (eventType === 'status') {
      await handleIncomingMQTT(`locker/${lockerId}/status`, typeof payload === 'string' ? payload : JSON.stringify(payload));
    } else if (eventType === 'lock_closed') {
      await handleIncomingMQTT(`locker/${lockerId}/lock/closed`, JSON.stringify(payload));
    } else {
      return res.status(400).json({ error: 'Unknown eventType' });
    }

    res.json({ success: true, message: `Simulated event [${eventType}] processed for ${lockerId}` });
  } catch (error) {
    next(error);
  }
}
