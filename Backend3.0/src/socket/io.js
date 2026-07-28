let io = null;

// Holding the instance in its own module keeps emitters.js and rideRoom.js from importing
// socket/index.js, which imports them back.
export const setIO = (instance) => {
  io = instance;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialised — call initSocket(server) before emitting');
  }
  return io;
};

// For code paths that may legitimately run before sockets exist (scripts, tests).
export const maybeGetIO = () => io;
