import mongoose from 'mongoose';
import User from '../models/userModel';

const addTierFieldToUsers = async () => {
  try {
    // Connect to your MongoDB
    await mongoose.connect(process.env.MONGO_URI!); //change this env variable with atcual connection string to run else giving error

    await User.updateMany(
      { tier: { $exists: false } }, // Check if the `tier` field is missing
      { $set: { tier: 'Bronze' } } // Set the default tier to 'Bronze'
    );

    console.log('Successfully added tier field to existing users.');
  } catch (error) {
    console.error('Error adding tier field to users:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
  }
};

addTierFieldToUsers();
