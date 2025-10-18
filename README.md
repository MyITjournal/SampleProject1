# A DYNAMIC USER PROFILE API

## Project Details

This is a simple RESTful API that returns a user's profile information along with a dynamic cat fact fetched from an external API in a json format.

It demonstrates the fundamentals of backend API development — routing, database connection, environment configuration, and clean code structure. It also allows the user to create, view, and update profile information dynamically from a connected database.

## Tech Stack:

1. Language - NodeJs (ESM)
2. Framework - Express
3. Database - MySQL

## #Dependencies installed:

- express - This is the web server framework
- mysql2 - This version works better (than mysql) with recent versions of MYSQL
- dotenv - To ensure the security of the credentials.
- axios - To handle fetching data from a third party API
- nodemon - To ensure that the server starts automatically

## **Git repository**

https://github.com/MyITjournal/SampleProject1.git

## Installation Steps:

1.  Create a folder where you want the project to be installed.

2.  Navigate to that folder:

    `cd user_profile`

3.  Clone the repository

    `git clone https://github.com/MyITjournal/SampleProject1.git`

4.  Install the dependences

    `npm install`

5.  Configure environment variables

        ```
        DB_HOST=localhost
        DB_USER=root
        DB_PASSWORD=your_password
        DB_NAME=your_profile_db
        DB_PORT=your_db_port
        PORT=3000

        ```

6.  To start the server:

    If you just want to start the server, use the following command:

    `npm start`

    Otherwise, to ensure that the server automatically restarts whenever changes are effected, run the following command:

    `npm run dev`

## API ENDPOINTS

| Method | Endpoint | Description          |
| ------ | -------- | -------------------- |
| /GET   | /users   | Get a user’s profile |

Production URL:
http://localhost:3000/me

## FOLDER STRUCTURE

PROJECT1/
│
├── src/
│   └── index.js
│   └── index.js
├── .env
├── package.json
└── README.md