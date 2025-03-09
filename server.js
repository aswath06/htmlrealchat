const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "chat_db"
});

db.connect(err => {
    if (err) throw err;
    console.log("MySQL Connected...");
});

// Handle WebSocket connections
wss.on("connection", ws => {
    console.log("New client connected!");

    // Send chat history to new client
    db.query("SELECT username, content FROM messages ORDER BY id ASC", (err, results) => {
        if (!err && results.length > 0) {
            results.forEach(row => {
                ws.send(`${row.username}: ${row.content}`);
            });
        }
    });

    ws.on("message", message => {
        message = message.toString(); // Convert Buffer to String
        console.log(`Received: ${message}`);

        const colonIndex = message.indexOf(":");
        if (colonIndex === -1) return; // Ignore invalid messages

        const username = message.substring(0, colonIndex).trim();
        const content = message.substring(colonIndex + 1).trim();

        if (!username || !content) return; // Ignore empty messages

        // Save message to database
        const sql = "INSERT INTO messages (username, content) VALUES (?, ?)";
        db.query(sql, [username, content], (err) => {
            if (err) console.error(err);
        });

        // Broadcast message to all clients
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(`${username}: ${content}`);
            }
        });
    });

    ws.on("close", () => console.log("Client disconnected"));
});

// Serve static frontend files
app.use(express.static("public"));

server.listen(5000, () => console.log("Server running on port 5000..."));
