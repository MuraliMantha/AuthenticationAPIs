const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Muralimmk", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log(payload);
        next();
      }
    });
  }
};

//get states
app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `
    SELECT state_id AS stateId,
    state_name AS stateName,
    population FROM state ORDER BY state_id;`;
  const stateArray = await db.all(statesQuery);
  response.send(stateArray);
});

//get a state
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `
    SELECT state_id AS stateId,
    state_name AS stateName,
    population FROM state WHERE state_id = "${stateId}";`;
  const dbresponse = await db.get(stateQuery);
  response.send(dbresponse);
});

// Add district
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrict = `
    INSERT INTO district 
    (district_name, state_id, cases, cured, active, deaths)
    VALUES
    (
       "${districtName}",
       "${stateId}",
       "${cases}",
       "${cured}",
       "${active}",
       "${deaths}"
    );`;

  const dbresponse = await db.run(addDistrict);
  const districtId = dbresponse.lastID;
  response.send("District Successfully Added");
});

//get district
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `SELECT district_id AS districtId,
    district_name AS districtName, state_id AS stateId, 
    cases,cured,active,deaths 
    FROM district WHERE district_id = ${districtId};`;

    const dbresponse = await db.get(getDistrict);
    response.send(dbresponse);
  }
);

//Delete District
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
    DELETE FROM district WHERE district_id = ${districtId};`;
    const dbresponse = await db.get(deleteDistrict);
    response.send("District Removed");
  }
);

// update district
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const districtDetails = request.body;
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrict = `
    UPDATE district SET 
        district_name="${districtName}",
        state_id="${stateId}",
        cases="${cases}",
        cured="${cured}",
        active="${active}",
        deaths="${deaths}"
        
        WHERE district_id = ${districtId};`;

    const dbresponse = await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStateStatsQuery = `
    SELECT SUM(cases),SUM(cured),SUM(active),
    SUM(deaths)
    FROM district 
    WHERE state_id = ${stateId};`;

    const stats = await db.get(getStateStatsQuery);
    console.log(stats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

// User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Muralimmk");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

module.exports = app;
