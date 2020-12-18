const express = require("express");
const cors = require("cors");
const listEndpoints = require("express-list-endpoints");
const attendeesRoutes = require("./services/attendees");
const helmet = require("helmet");
const {
  notFoundHandler,
  badRequestHandler,
  genericErrorHandler,
} = require("./errorHandlers");
const yaml = require("yamljs");
const swaggerUI = require("swagger-ui-express");
const { join } = require("path");

const server = express();

const port = process.env.PORT || 3002;

server.use(express.json());
server.use(helmet());
server.use(cors());
const swaggerDoc = yaml.load(join(__dirname, "apiDocs.yml")); //PARSING YAML FILE

server.use("/docs", swaggerUI.serve, swaggerUI.setup(swaggerDoc));
server.use("/attendees", attendeesRoutes);

// ERROR HANDLERS
server.use(badRequestHandler);
server.use(notFoundHandler);
server.use(genericErrorHandler);

console.log(listEndpoints(server));

server.listen(port, () => {
  if (process.env.NODE_ENV === "production") {
    console.log("Running on cloud on port", port);
  } else {
    console.log("Running locally on port", port);
  }
});
