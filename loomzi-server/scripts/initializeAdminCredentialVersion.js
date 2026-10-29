// Run once before enabling new admin routes: node scripts/initializeAdminCredentialVersion.js
require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await Admin.updateMany({ credentialVersion: { $exists: false } }, { $set: { credentialVersion: 0 } });
    console.log(`Initialized credential version for ${result.modifiedCount} admin account(s).`);
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
