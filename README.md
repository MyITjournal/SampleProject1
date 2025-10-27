# STAGE 2 : COUNTRY CURRENCY & EXCHANGE API

## Project Details

This is a RESTful API that fetches country data from an external API, stores it in a database, and provides CRUD operations.

## Features

- The API fetches country data from: https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies
- Extracts the currency code (e.g. NGN, USD, GBP) for each country.
- Fetches the exchange rate from: https://open.er-api.com/v6/latest/USD
- Matches each country's currency with its rate (e.g. NGN → 1600).
- Computes a field estimated_gdp = population × random(1000–2000) ÷ exchange_rate.
- Stores everything in a database.

## Tech Stack

- Language - Node.js (ESM)
- Framework - Express
- Database - PostgreSQL

## Dependencies installed

- express - This is the web server framework
- pg (postgres) - To implement the database
- dotenv - To ensure the security of the credentials
- axios - To handle fetching data from a third party API
- sharp - To handle image generation

## Development dependency

- nodemon - To ensure that the server starts automatically

## Git repository

https://github.com/MyITjournal/SampleProject1.git

## Installation Steps

1. Create a folder where you want the project to be installed.

2. Navigate to that folder, for example:

   `cd countryExchange`

3. Clone the repository.

   `git clone https://github.com/MyITjournal/SampleProject1.git`

4. Install the dependences.

   `npm install`

5. Configure the environment variables

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_profile_db
DB_PORT=your_db_port
PORT=3000

```

6. Start the server:

   To start the server once, use the following command:

   `npm start`

   Alternatively, to ensure that the server automatically restarts whenever changes are effected to the file, run the following command:

   `npm run dev`

## API Endpoints

| Method  | Endpoint           | Description                                                             |
| ------- | ------------------ | ----------------------------------------------------------------------- |
| /POST   | /countries/refresh | Fetch all countries and exchange rates, then cache them in the database |
| /GET    | /countries         | Get all countries from the DB                                           |
| /GET    | /countries/:name   | Get one country by name                                                 |
| /DELETE | /countries/:name   | Delete a country record                                                 |
| /GET    | /status            | Show total countries and last refresh timestamp                         |
| /GET    | /countries/image   | serve summary image                                                     |

Production base URL: https://hngproject-test-10dce48be443.herokuapp.com/

Folder Structure

```
PROJECT1/
│
├── cache
│ ├── summary.png
│ ├── summary.svg
├── currencyExchange
│ ├── countryController.js
│ ├── countryRoutes.js
│ ├── schema.sql
├── scripts
│ ├── release.js
├── stringManipulation
│ ├── runSchema.js
│ ├── schema.sql
│ ├── stringController.js
│ ├── stringRoutes.js
├── userCatFact
│ ├── hardcodedUser.js
│ ├── randomDBUser.js
├── userDB
│ ├── runSchema.js
│ ├── schema.sql
│ ├── serviceUsers.js
├── utils
│ ├── logger.js
├── .env
├── .gitignore
├── index.js
├── package.json
├── Procfile
├── README.md
└── server.js
```

# A DYNAMIC USER PROFILE API

## Project Details

This is a simple RESTful API that returns a user's profile information along with a dynamic cat fact fetched from an external API in a json format.

It demonstrates the fundamentals of backend API development — routing, database connection, environment configuration, and clean code structure. It also allows the user to create, view, and update profile information dynamically from a connected database.

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

## Git repository

https://github.com/MyITjournal/SampleProject1.git

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
