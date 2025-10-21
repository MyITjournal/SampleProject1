/*****************************************************************************
 *Modification History
 *v0.1: A.ADEBAYO: 2015-10-18: Added /me endpoint that selects a user and randomly
 *v0.2: A.ADEBAYO: 2015-10-18: Added database version under /dbuser/me
 *v0.3: A.ADEBAYO: 2015-10-18: Reorganized into modular folder structure
 ******************************************************************************/
import dotenv from "dotenv";
import express from "express";
import serviceUsersRouter from "./userDB/serviceUsers.js";
import randomdbUserRouter from "./userCatFact/randomDBUser.js";
import hardcodedUserRouter from "./userCatFact/hardcodedUser.js";
import stringRouter from "./stringManipulation/stringRoutes.js";

//load the environment variables
dotenv.config();

const app = express();

//Add middlewares
app.use(express.json());

const port = process.env.PORT || 3000;

// String manipulation routes
app.use("/api", stringRouter);

// User & Cat Fact routes
app.use("/", hardcodedUserRouter);
app.use("/dbuser", randomdbUserRouter);

//Service Users (For CRUD operation on the Users table)
app.use("/service", serviceUsersRouter);

// Export the app for use in other files
export default app;
