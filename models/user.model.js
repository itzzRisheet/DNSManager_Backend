import { Schema } from "mongoose";
import mongoose from "mongoose";

const userSchema = new Schema({
  fname: String,
  lname: String,
  email: String,
  password: String,
  username: String,
});

export default mongoose.model("users", userSchema);
