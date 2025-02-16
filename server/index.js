const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { Schema } = mongoose;

const app = express();
const server = http.createServer(app);


const PORT = process.env.PORT || 5001;

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/code_editor', {
    // useNewUrlParser: true,
    // useUnifiedTopology: true
})
    .then(() => {
        console.log('MongoDB connected');
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
    });

// Create a schema for saving code
const codeSchema = new Schema({
    roomId: { type: String, required: true },
    code: { type: String, required: true },
}, { timestamps: true });

const CodeModel = mongoose.model('Code', codeSchema);

app.use(cors({
    origin: "http://localhost:3000",  // Allow frontend requests
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
}));


const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

// Endpoint to save or update code to MongoDB
app.post('/save-code', async (req, res) => {
    const { roomId, code } = req.body;

    if (!roomId || !code) {
        return res.status(400).json({ message: "Room ID and code are required" });
    }

    try {
        // Update the existing code if roomId exists, or insert a new document
        const updatedCode = await CodeModel.findOneAndUpdate(
            { roomId },                // Filter to find the document
            { code },                  // Update data
            { upsert: true, new: true } // Create if not exists, return updated document
        );

        res.status(200).json({
            success: true,
            message: "Code saved/updated successfully!",
            data: updatedCode,
        });
    } catch (error) {
        console.error("Error saving/updating code:", error);
        res.status(500).json({
            success: false,
            message: "Failed to save/update code",
        });
    }
});

// Endpoint to get the saved code from MongoDB based on roomId
app.get('/get-code/:roomId', async (req, res) => {
    const { roomId } = req.params;

    try {
        const codeData = await CodeModel.findOne({ roomId });

        if (codeData) {
            res.status(200).json({
                success: true,
                message: 'Code fetched successfully!',
                code: codeData.code,
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'No code found for this room.',
            });
        }
    } catch (error) {
        console.error('Error fetching code:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching code',
        });
    }
});

// Set up socket.io for real-time collaboration
const userSocketMap = {};

const getAllConnectedClients = (roomId) => {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId]?.username,
        };
    });
};

io.on("connection", (socket) => {
  
  
    socket.on("join", ({ roomId, username }) => {
        if (!username || typeof username !== "string" || username.trim() === "") {
            console.error("[ERROR] Received join event with invalid username!", { roomId, username });
            socket.emit("join-error", "Username is required!");
            return; // Stop processing if username is missing or invalid
        }
    
        console.log("[SERVER] User joined:", username, "Room:", roomId);
        
        // Prevent duplicate entries
        if (Object.values(userSocketMap).some(user => user.username === username && user.roomId === roomId)) {
            console.warn("[WARNING] Duplicate username detected:", username);
            socket.emit("join-error", "Username already taken in this room!");
            return;
        }
    
        userSocketMap[socket.id] = { username, roomId };
        socket.join(roomId);
    
        const clients = getAllConnectedClients(roomId);
    
        // Notify all clients about the new user
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit("joined", {
                clients,
                username,
                socketId: socket.id,
            });
        });
    
        // Send the list of connected users for WebRTC
        const connectedUsers = clients.map(client => client.socketId).filter(id => id !== socket.id);
        io.to(roomId).emit("all-users", getAllConnectedClients(roomId).map(client => client.socketId));

    
        // Notify others that a new user joined
        socket.broadcast.to(roomId).emit("user-joined", socket.id);
    
        // Fetch the saved code from the database when the user joins the room
        CodeModel.findOne({ roomId })
            .then(codeData => {
                if (codeData) {
                    io.to(socket.id).emit("code-change", { code: codeData.code });
                }
            })
            .catch(error => {
                console.error('Error fetching code on join:', error);
            });
    });
    
    
    socket.on('code-change', async ({ roomId, code }) => {
        socket.in(roomId).emit("code-change", { code });

        // Save the code to the database
        try {
            await fetch(`http://localhost:${PORT}/save-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ roomId, code }),
            });
        } catch (error) {
            console.error('Error saving code to database:', error);
        }
    });

    socket.on('sync-code', ({ socketId, code }) => {
        io.to(socketId).emit("code-change", { code });
    });

    socket.on("newMessage", ({ username, message }) => {
        const roomId = userSocketMap[socket.id]?.roomId;
        io.to(roomId).emit("newMessage", { username, message });
    });
    socket.on("send-signal", ({ to, signal }) => {
        io.to(to).emit("receive-signal", { from: socket.id, signal });
    });
    socket.on("disconnect", () => {
        const user = userSocketMap[socket.id];
        if (!user) return; // Avoid errors if user wasn't tracked
    
        const { username, roomId } = user;
    
        console.log(`[SERVER] User ${username} disconnected from room ${roomId}`);
    
        if (roomId) {
            // Notify others in the room that the user has left
            socket.to(roomId).emit("userLeft", { socketId: socket.id, username });
    
            // Notify clients to remove the user's video stream
            socket.to(roomId).emit("remove-user-video", { socketId: socket.id });
        }
    
        // Remove user from tracking
        delete userSocketMap[socket.id];
    });
    
    
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

