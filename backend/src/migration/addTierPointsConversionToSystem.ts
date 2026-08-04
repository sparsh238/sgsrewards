import mongoose from 'mongoose';
import System from '../models/systemModel'; // Adjust the path based on your project structure

const addTierPointsConversionToSystem = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await mongoose.connect(""); //change this env variable with atcual connection string to run else giving error

    // Update the system document to include `tierPointsConversion` with the specified values
    const result = await System.updateOne(
      {}, // Assuming there is only one system document
      {
        $set: {
          tierPointsConversion: {
            NoTier: 0,
            Basic: 600,
            Bronze: 500,
            Silver: 400,
            Gold: 300,
            Platinum: 200,
          },
          tierBillingRequirements: {
            NoTier: 0,
            Basic: 1500000,
            Bronze: 3000000,
            Silver: 6000000,
            Gold: 9000000,
            Platinum: 15000000,
          },
        },
      },
      { upsert: true } // Create the document if it doesn't exist
    );

    console.log('Tier points conversion added/updated successfully.', result);
  } catch (error) {
    console.error('Error adding tierPointsConversion to system document:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
  }
};

addTierPointsConversionToSystem();
