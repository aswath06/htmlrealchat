const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = {}; // Stores connected users

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

// Create necessary tables if they do not exist
const createTables = () => {
    const usersTable = `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    const messagesTable = `CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender VARCHAR(255) NOT NULL,
        receiver VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    const chatRoomsTable = `CREATE TABLE IF NOT EXISTS chat_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

    const roomMembersTable = `CREATE TABLE IF NOT EXISTS room_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`;

    db.query(usersTable, err => { if (err) console.error(err); });
    db.query(messagesTable, err => { if (err) console.error(err); });
    db.query(chatRoomsTable, err => { if (err) console.error(err); });
    db.query(roomMembersTable, err => { if (err) console.error(err); });
};

createTables();

wss.on("connection", ws => {
    ws.on("message", message => {
        try {
            const data = JSON.parse(message);

            if (data.type === "set_username") {
                users[data.username] = ws;
                ws.username = data.username;
                db.query("INSERT IGNORE INTO users (username) VALUES (?)", [data.username]);
                sendUserList();
            } else if (data.type === "message") {
                const { sender, receiver, content } = data;
                const sql = "INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)";
                db.query(sql, [sender, receiver, content], (err) => {
                    if (err) console.error(err);
                });

                if (users[receiver]) {
                    users[receiver].send(JSON.stringify({ sender, content }));
                }
                if (users[sender]) {
                    users[sender].send(JSON.stringify({ sender: "You", content }));
                }
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    ws.on("close", () => {
        delete users[ws.username];
        sendUserList();
    });
});

function sendUserList() {
    const userList = Object.keys(users);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "user_list", users: userList }));
        }
    });
}

app.use(express.static("public"));
server.listen(5000, () => console.log("Server running on port 5000..."));
