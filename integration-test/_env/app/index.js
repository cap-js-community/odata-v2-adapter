var http = require("http");

var PORT = process.env.PORT || 3000;

var server = http.Server();
server.listen(PORT, function() {
  console.log("Server running on http://localhost:" + PORT);
});
