import { prisma } from '../config/db.js';

export async function getTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20, type, lockerId } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where = {};
    if (type && type !== 'ALL') {
      where.type = type.toUpperCase();
    }
    if (lockerId && lockerId !== 'ALL') {
      where.locker_id = lockerId;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          book: { select: { id: true, title: true, author: true } },
          locker: { select: { id: true, location_name: true } },
          compartment: { select: { id: true, compartment_number: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getStats(req, res, next) {
  try {
    const [
      totalBooks,
      availableBooks,
      borrowedBooks,
      totalLockers,
      onlineLockers,
      totalUsers,
      transactions,
    ] = await Promise.all([
      prisma.book.count(),
      prisma.book.count({ where: { status: 'AVAILABLE' } }),
      prisma.book.count({ where: { status: 'BORROWED' } }),
      prisma.locker.count(),
      prisma.locker.count({ where: { status: 'ONLINE' } }),
      prisma.user.count(),
      prisma.transaction.findMany({
        orderBy: { timestamp: 'asc' },
        include: {
          locker: { select: { id: true, location_name: true } },
        },
      }),
    ]);

    const totalDonations = transactions.filter((t) => t.type === 'DONATE').length;
    const totalBorrows = transactions.filter((t) => t.type === 'BORROW').length;
    const totalReturns = transactions.filter((t) => t.type === 'RETURN').length;

    // Group transactions by day for Recharts
    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { date: key.slice(5), borrows: 0, donations: 0, returns: 0 };
    }

    transactions.forEach((tx) => {
      const day = tx.timestamp.toISOString().split('T')[0];
      if (dayMap[day]) {
        if (tx.type === 'BORROW') dayMap[day].borrows += 1;
        if (tx.type === 'DONATE') dayMap[day].donations += 1;
        if (tx.type === 'RETURN') dayMap[day].returns += 1;
      }
    });

    const activityByDay = Object.values(dayMap);

    // Group by locker
    const lockerActivity = {};
    transactions.forEach((tx) => {
      const lName = tx.locker?.location_name || tx.locker_id || 'Unknown';
      lockerActivity[lName] = (lockerActivity[lName] || 0) + 1;
    });

    const lockerStats = Object.entries(lockerActivity).map(([name, count]) => ({
      name: name.length > 20 ? name.substring(0, 18) + '...' : name,
      count,
    }));

    res.json({
      summary: {
        totalBooks,
        availableBooks,
        borrowedBooks,
        totalLockers,
        onlineLockers,
        totalUsers,
        totalDonations,
        totalBorrows,
        totalReturns,
      },
      charts: {
        activityByDay,
        lockerStats,
      },
    });
  } catch (error) {
    next(error);
  }
}
