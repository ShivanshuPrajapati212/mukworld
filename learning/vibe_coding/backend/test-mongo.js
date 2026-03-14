import mongoose from 'mongoose';
async function test() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/mukworld', { serverSelectionTimeoutMS: 2000 });
    console.log("Connected");
    process.exit(0);
  } catch (e) {
    console.error("Error", e);
    process.exit(1);
  }
}
test();
