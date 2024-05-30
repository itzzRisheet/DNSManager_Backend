import express from "express";
import cors from "cors";
import { connect } from "./db.js";
import { config } from "dotenv";
import router from "./routes.js";

config();

const app = express();

app.use(express.json());
app.use(cors());
app.use("/api", router);

app.get("/", (req, res) => {
  res.status(201).json({
    msg: "running perfectly",
  });
});

const PORT = 8080 || process.env.PORT;

connect().then((db) => {
  try {
    app.listen(PORT, () => {
      console.log(`app running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
});
