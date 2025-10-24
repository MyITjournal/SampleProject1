/*****************************************************************************
 *Modification History
 *v0.1: A.ADEBAYO: 2015-10-18: Added /me endpoint that selects a user and randomly
 *v0.2: A.ADEBAYO: 2015-10-18: Added database version under /dbuser/me
 *v0.3: A.ADEBAYO: 2015-10-18: Reorganized into modular folder structure
 *v0.4: A.ADEBAYO: 2015-10-18: String manipulation routes as default (no prefix)
 ******************************************************************************/
import dotenv from "dotenv";
import express from "express";
import serviceUsersRouter from "./userDB/serviceUsers.js";
import randomdbUserRouter from "./userCatFact/randomDBUser.js";
import hardcodedUserRouter from "./userCatFact/hardcodedUser.js";
import stringRouter from "./stringManipulation/stringRoutes.js";
import currencyExchangeRouter from "./currencyExchange/countryRoutes.js";

//load the environment variables
dotenv.config();

const app = express();

//Add middlewares
app.use(express.json());

const port = process.env.PORT || 3000;

// User & Cat Fact routes (with specific prefixes to avoid conflicts)
app.use("/user", hardcodedUserRouter);
app.use("/dbuser", randomdbUserRouter);

//Service Users (For CRUD operation on the Users table)
app.use("/service", serviceUsersRouter);

// String manipulation routes (DEFAULT - no prefix, must come last)
app.use("/strex", stringRouter);

// Currency Exchange routes (at root level)
app.use("/", currencyExchangeRouter);

// Export the app for use in other files
export default app;
