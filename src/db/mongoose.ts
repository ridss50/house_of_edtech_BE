import mongoose from "mongoose";


declare global {
 
  var __mongooseConnect: Promise<typeof mongoose> | undefined;
}

export function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!global.__mongooseConnect) {
    global.__mongooseConnect = mongoose.connect(uri);
  }
  return global.__mongooseConnect;
}

export { mongoose };
