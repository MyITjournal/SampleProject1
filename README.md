# STAGE 1

# A STRING ANALYSER API

## Project Details

This is a RESTful API to analyze and store string properties

## Features

- Create/analyze string
- Retrieve a specific string
- Retrieve all strings with filtering
- Filter by natural language queries
- Delete string

## Tech Stack

1. Language - NodeJs (ESM)
2. Framework - Express
3. Database - MySQL/PostgreSQL

## Dependencies installed

- express - This is the web server framework
- mysql2 - This version works better (than mysql) with recent versions of MYSQL
- dotenv - To ensure the security of the credentials.
- axios - To handle fetching data from a third party API
- nodemon - To ensure that the server starts automatically
- pg - To implement the database

## Git repository

https://github.com/MyITjournal/SampleProject1.git

## Installation Steps

1.  Create a folder where you want the project to be installed.

2.  Navigate to that folder, for example:

    `cd string_manipulation`

3.  Clone the repository.

    `git clone https://github.com/MyITjournal/SampleProject1.git`

4.  Install the dependences.

    `npm install`

5.  Configure the environment variables

        ```
        DB_HOST=localhost
        DB_USER=root
        DB_PASSWORD=your_password
        DB_NAME=your_profile_db
        DB_PORT=your_db_port
        PORT=3000

        ```

6.  Start the server:

    To start the server once, use the following command:

    `npm start`

    Alternatively, to ensure that the server automatically restarts whenever changes are effected to the file, run the following command:

    `npm run dev`

## API Endpoints

| Method  | Endpoint                                | Description          |
| ------- | --------------------------------------- | -------------------- |
| /POST   | api/strings                             | Get a user’s profile |
| /GET    | api/strings/:string_value               | Get a user’s profile |
| /GET    | api/strings?                            | Get a user’s profile |
| /GET    | api/strings/filter-by-natural-language? | Get a user’s profile |
| /DELETE | api/strings:string_value                | Get a user’s profile |

Production URL:
http://localhost:3000/

## Folder Structure

```
PROJECT1/
│
├── scripts
│     ├── release.js
├── stringManipulation
│     ├── runSchema.js
│     ├── schema.sql
│     ├── stringController.js
│     ├── strongRoutes.js
├── userCatFact
│     ├── hardcodedUser.js
│     ├── randomDBUser.js
├── userDB
│     ├── runSchema.js
│     ├── schema.sql
│     ├── serviceUsers.js
├── .env
├── .gitignore
├── index.js
├── package.json
├── Procfile
├── README.md
└── server.js

```

#

# STAGE 0 DETAILS

# A DYNAMIC USER PROFILE API

## Project Details

This is a simple RESTful API that returns a user's profile information along with a dynamic cat fact fetched from an external API in a json format.

It demonstrates the fundamentals of backend API development — routing, database connection, environment configuration, and clean code structure. It also allows the user to create, view, and update profile information dynamically from a connected database.

## Installation Steps

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

## API Endpoints

| Method | Endpoint | Description          |
| ------ | -------- | -------------------- |
| /GET   | /me      | Get a user’s profile |

Production URL:
http://localhost:3000/me

## Folder Structure

```
PROJECT1/
│
├── index.js
├── server.js
├── .env
├── package.json
└── README.md
```
