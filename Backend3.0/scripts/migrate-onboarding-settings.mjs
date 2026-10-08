// One-off migration for the step-wise onboarding + split settings links release.
//
//   settings: onboardingLink  →  onboardingBeforeKycUrl   (value carried over, old field removed)
//             + onboardingAfterKycUrl, permissionGuideUrl, supportPhoneNumber  (added as '')
//   drivers:  + onboardingStep   (3 where isProfileComplete is true, otherwise 0)
//
// Dry run by default — prints what it would change and writes nothing:
//   node scripts/migrate-onboarding-settings.mjs
// Apply:
//   node scripts/migrate-onboarding-settings.mjs --apply
//
// Safe to run more than once: every write is filtered on the field still being missing, so a
// second run matches nothing. It goes through the raw collections on purpose — onboardingLink is
// no longer in the Mongoose schema, and strict mode would silently drop it from a model update.
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

  const settings = mongoose.connection.collection('settings');
  const drivers = mongoose.connection.collection('drivers');

  // --- settings -------------------------------------------------------------------------------
  const settingsToMigrate = {
    $or: [
      { onboardingLink: { $exists: true } },
      { onboardingBeforeKycUrl: { $exists: false } },
      { onboardingAfterKycUrl: { $exists: false } },
      { permissionGuideUrl: { $exists: false } },
      { supportPhoneNumber: { $exists: false } },
    ],
  };

  const settingDocs = await settings
    .find(settingsToMigrate, { projection: { type: 1, onboardingLink: 1, onboardingBeforeKycUrl: 1 } })
    .toArray();
  console.log(`settings: ${settingDocs.length} document(s) to migrate`);
  settingDocs.forEach((doc) => {
    console.log(`  ${doc.type}: onboardingLink=${JSON.stringify(doc.onboardingLink)} → onboardingBeforeKycUrl`);
  });

  // --- drivers --------------------------------------------------------------------------------
  const noStep = { onboardingStep: { $exists: false } };
  const completeCount = await drivers.countDocuments({ ...noStep, isProfileComplete: true });
  const incompleteCount = await drivers.countDocuments({ ...noStep, isProfileComplete: { $ne: true } });
  console.log(`drivers:  ${completeCount} complete → onboardingStep 3, ${incompleteCount} incomplete → onboardingStep 0`);

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write these changes.');
    return;
  }

  // A value already written to the new field wins over the old link, so a re-run after an admin
  // has edited the new field cannot overwrite their edit.
  const settingsResult = await settings.updateMany(settingsToMigrate, [
    {
      $set: {
        onboardingBeforeKycUrl: { $ifNull: ['$onboardingBeforeKycUrl', { $ifNull: ['$onboardingLink', ''] }] },
        onboardingAfterKycUrl: { $ifNull: ['$onboardingAfterKycUrl', ''] },
        permissionGuideUrl: { $ifNull: ['$permissionGuideUrl', ''] },
        supportPhoneNumber: { $ifNull: ['$supportPhoneNumber', ''] },
      },
    },
    { $unset: 'onboardingLink' },
  ]);

  const completeResult = await drivers.updateMany(
    { ...noStep, isProfileComplete: true },
    { $set: { onboardingStep: 3 } }
  );
  const incompleteResult = await drivers.updateMany(
    { ...noStep, isProfileComplete: { $ne: true } },
    { $set: { onboardingStep: 0 } }
  );

  console.log(`\nsettings updated: ${settingsResult.modifiedCount}`);
  console.log(`drivers set to step 3: ${completeResult.modifiedCount}`);
  console.log(`drivers set to step 0: ${incompleteResult.modifiedCount}`);
};

run()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
