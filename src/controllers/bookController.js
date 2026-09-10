import { prisma } from '../config/db.js';
import { emitEvent } from '../services/socketService.js';

export async function getBooks(req, res, next) {
  try {
    const { search, status } = req.query;

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { author: { contains: search } },
        { isbn: { contains: search } },
      ];
    }

    const books = await prisma.book.findMany({
      where,
      include: {
        donor: { select: { id: true, name: true } },
        compartment: {
          include: {
            locker: { select: { id: true, location_name: true, status: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ books });
  } catch (error) {
    next(error);
  }
}

export async function getBookById(req, res, next) {
  try {
    const { id } = req.params;
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        donor: { select: { id: true, name: true, email: true } },
        compartment: {
          include: { locker: true },
        },
        transactions: {
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: {
            user: { select: { id: true, name: true } },
            locker: { select: { id: true, location_name: true } },
          },
        },
      },
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json({ book });
  } catch (error) {
    next(error);
  }
}

export async function createBook(req, res, next) {
  try {
    const { title, author, isbn, compartment_id, locker_id, compartment_number } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: 'Title and author are required' });
    }

    let targetCompartmentId = compartment_id;

    if (!targetCompartmentId && locker_id && compartment_number) {
      const comp = await prisma.compartment.findUnique({
        where: {
          locker_id_compartment_number: {
            locker_id,
            compartment_number: parseInt(compartment_number, 10),
          },
        },
      });
      if (comp) targetCompartmentId = comp.id;
    }

    const book = await prisma.book.create({
      data: {
        title,
        author,
        isbn,
        donor_user_id: req.user ? req.user.id : null,
        compartment_id: targetCompartmentId || null,
        status: targetCompartmentId ? 'AVAILABLE' : 'AVAILABLE',
      },
      include: {
        compartment: {
          include: { locker: true },
        },
        donor: { select: { id: true, name: true } },
      },
    });

    // If assigned to a compartment, update compartment status to OCCUPIED
    if (targetCompartmentId) {
      await prisma.compartment.update({
        where: { id: targetCompartmentId },
        data: { status: 'OCCUPIED' },
      });
    }

    // Record donation transaction
    if (req.user) {
      const tx = await prisma.transaction.create({
        data: {
          user_id: req.user.id,
          book_id: book.id,
          locker_id: book.compartment?.locker?.id || 'locker-01',
          compartment_id: targetCompartmentId,
          type: 'DONATE',
          method: 'WEB',
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          book: true,
          locker: true,
        },
      });

      emitEvent('transaction:new', tx);
    }

    emitEvent('book:updated', book);

    res.status(201).json({ book });
  } catch (error) {
    next(error);
  }
}

export async function reserveBook(req, res, next) {
  try {
    const { id } = req.params;
    const book = await prisma.book.findUnique({
      where: { id },
      include: { compartment: { include: { locker: true } } },
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.status !== 'AVAILABLE') {
      return res.status(400).json({ error: 'Book is not currently available for reservation' });
    }

    const updatedBook = await prisma.book.update({
      where: { id },
      data: { status: 'RESERVED' },
      include: {
        compartment: { include: { locker: true } },
      },
    });

    // Generate a pickup QR code payload
    const qrPayload = JSON.stringify({
      action: 'PICKUP',
      bookId: book.id,
      bookTitle: book.title,
      userId: req.user.id,
      userName: req.user.name,
      lockerId: book.compartment?.locker_id,
      compartmentNumber: book.compartment?.compartment_number,
      validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    });

    emitEvent('book:updated', updatedBook);

    res.json({
      success: true,
      message: 'Book reserved successfully! Scan your QR code or RFID at the locker to pick it up.',
      book: updatedBook,
      qrPayload,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateBookStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const book = await prisma.book.update({
      where: { id },
      data: { status: status.toUpperCase() },
      include: {
        compartment: { include: { locker: true } },
      },
    });

    emitEvent('book:updated', book);

    res.json({ book });
  } catch (error) {
    next(error);
  }
}
