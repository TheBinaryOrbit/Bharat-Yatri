// One-off migration for the "onboarding first, KYC from home" release.
//
//   drivers: + kycStatus   'verified'    where isKycCompleted is true
//                          'rejected'    where a KYC attempt failed (kycFailedReason set)
//                          'not_started' otherwise
//            + kycMethod   'digilocker'  where there is a DigiLocker attempt on record, else null
//
// Dry run by default — prints what it would change and writes nothing:
//   node scripts/migrate-kyc-status.mjs
// Apply:
//   node scripts/migrate-kyc-status.mjs --apply
//
// Safe to run more than once: only drivers still missing kycStatus are touched.
import 'dotenv/config';
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from .env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const { host, name } = mongoose.connection;
  console.log(`Connected to ${host}/${name} — ${APPLY ? 'APPLYING changes' : 'dry run, nothing will be written'}\n`);

  const drivers = mongoose.connection.collection('drivers');
  const missing = { kycStatus: { $exists: false } };
  const hasDigilocker = { 'kycDetails.requestId': { $exists: true, $nin: [null, ''] } };

  const groups = [
    { label: 'verified', filter: { ...missing, isKycCompleted: true } },
    { label: 'rejected', filter: { ...missing, isKycCompleted: { $ne: true }, kycFailedReason: { $nin: [null, ''] } } },
    {
      label: 'not_started',
      filter: { ...missing, isKycCompleted: { $ne: true }, kycFailedReason: { $in: [null, ''] } },
    },
  ];

  for (const { label, filter } of groups) {
    const total = await drivers.countDocuments(filter);
    const viaDigilocker = await drivers.countDocuments({ ...filter, ...hasDigilocker });
    console.log(`${label.padEnd(12)} ${total} driver(s), ${viaDigilocker} with a DigiLocker attempt`);

    if (!APPLY || !total) continue;

    // DigiLocker drivers first, so the second write's filter (still missing kycStatus) skips them.
    await drivers.updateMany(
      { ...filter, ...hasDigilocker },
      { $set: { kycStatus: label, kycMethod: 'digilocker' } }
    );
    await drivers.updateMany(filter, { $set: { kycStatus: label, kycMethod: null } });
  }

  console.log(APPLY ? '\nDone.' : '\nDry run only. Re-run with --apply to write.');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
