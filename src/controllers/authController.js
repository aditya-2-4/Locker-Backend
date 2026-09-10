import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { config } from '../config/env.js';

export async function register(req, res, next) {
  try {
    const { name, email, password, role = 'STUDENT', rfid_uid } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STUDENT',
        rfid_uid: rfid_uid ? rfid_uid.trim().toUpperCase() : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rfid_uid: true,
        created_at: true,
      },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        rfid_uid: user.rfid_uid,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rfid_uid: true,
        created_at: true,
        donated_books: {
          include: {
            compartment: {
              include: { locker: true },
            },
          },
        },
        transactions: {
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: {
            book: true,
            locker: true,
          },
        },
      },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
}
