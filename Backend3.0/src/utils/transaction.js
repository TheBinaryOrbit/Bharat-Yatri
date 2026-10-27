import mongoose from 'mongoose';

// MongoDB only allows transactions on a replica set or a sharded cluster. Atlas is one, but a
// local mongod on a dev machine usually runs standalone and rejects them (code 20).
let supported;
const transactionsSupported = async () => {
  if (supported === undefined) {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    supported = Boolean(hello.setName || hello.msg === 'isdbgrid');
    if (!supported) {
      console.warn('MongoDB is standalone: multi-document writes run without a transaction, with manual rollback.');
    }
  }
  return supported;
};

// Runs `work(session)` so its writes all commit or all roll back.
//
// With transaction support, that is a real transaction. Without it, `work` runs with no session
// and, if it throws, `rollback()` is called to undo whatever it already wrote. The rollback is
// best effort: it can itself fail, which is why production should stay on a replica set.
export const runAtomically = async (work, rollback) => {
  if (await transactionsSupported()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
    return;
  }

  try {
    await work(undefined);
  } catch (error) {
    try {
      await rollback?.();
    } catch (rollbackError) {
      console.error('Rollback after a failed write also failed:', rollbackError);
    }
    throw error;
  }
};
