import { maybeGetIO } from '../../socket/io.js';
import { driverRoomName, userRoomName } from '../../constants/ride.constants.js';
import { DriverLocationService } from '../driverLocation.service.js';

const driverLocationService = new DriverLocationService();

// What blocking does beyond the flag itself: the account's open sockets are closed (the reconnect
// is then refused by socket auth), and a driver is pulled out of the dispatch index.
//
// goOffline runs twice: the socket's own disconnect handler parks the driver in the grace window
// asynchronously, and that can land after the first eviction. The second pass clears it.
export const enforceBlock = async (kind, id) => {
  const io = maybeGetIO();
  const room = kind === 'driver' ? driverRoomName(id) : userRoomName(id);
  try {
    io?.in(room).disconnectSockets(true);
  } catch (error) {
    console.error('[admin] socket disconnect on block failed:', error.message);
  }

  if (kind === 'driver') {
    await driverLocationService.goOffline(id).catch(() => {});
    setTimeout(() => driverLocationService.goOffline(id).catch(() => {}), 1500);
  }
};
