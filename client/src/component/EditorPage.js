import Avatar from 'react-avatar';
import React, { useEffect, useState, useRef } from 'react';
import Client from './Client';
import Editor from './Editor';
import { initSocket } from '../socket';
import { useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import executeCode from './CodeRun';
import { io } from "socket.io-client";
import Peer from "simple-peer";

const socket = io("http://localhost:5001");


function EditorPage() {
    // Existing EditorPage state and refs
    const [clients, setClients] = useState([]);
    const [messages, setMessages] = useState([]);
    const [language, setLanguage] = useState('5');
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showChat, setShowChat] = useState(false);

    // Video chat state and refs (from VideoChat.js)
    const localVideoRef = useRef(null);
    const [peers, setPeers] = useState([]);
    const peersRef = useRef([]);
    const localStreamRef = useRef(null);
    const [videoEnabled, setVideoEnabled] = useState(true);

    // Existing EditorPage refs/hooks
    const socketRef = useRef(null);
    const messageRef = useRef();
    const executionInputRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const navigate = useNavigate();
    const codeRef = useRef(null);


    // const [showResults, setShowResults] = useState(false);



    // Language selection
    const languages = [
        { code: '5', name: 'Python' },
        { code: '4', name: 'Java' },
        { code: '17', name: 'JavaScript' },
        { code: '7', name: 'C++' },
        { code: '6', name: 'C' },
    ];

    useEffect(() => {
        const peerConnections = {};

        const init = async () => {
            const handleError = (e) => {
                toast.error("Socket Connection Failed");
                navigate('/');
            };

            socketRef.current = await initSocket();
            socketRef.current.on('connect_error', handleError);
            socketRef.current.on('connect_failed', handleError);

            // Join the room for code collaboration
            socketRef.current.emit('join', {
                roomId,
                username: location.state?.username,
            });

            socketRef.current.on('joined', ({ clients, username, socketId }) => {
                if (username !== location.state?.username) {
                    toast.success(`${username} joined the room`);
                }
                setClients(clients);
                socketRef.current.emit('sync-code', { code: codeRef.current, socketId });
            });

            socketRef.current.on('userLeft', ({ socketId, username }) => {
                if (username) {
                    toast.success(`${username} left the room`);
                    setClients((prev) => prev.filter((client) => client.socketId !== socketId));
                }
            });

            socketRef.current.on('newMessage', (message) => {
                if (message.username !== location.state?.username) {
                    setMessages((prev) => [...prev, message]);
                }
            });

            // Initialize local video stream for video chat
            try {
                const localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });

                localStreamRef.current = localStream;
                if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

                if (!socketRef.current) {
                    console.error("socketRef.current is undefined when setting up 'all-users' listener.");
                    return;
                }

                socketRef.current.on("all-users", (users) => {
                    users.forEach((userId) => {
                        const peer = createPeer(userId, localStream);
                        peerConnections[userId] = peer;
                        peersRef.current.push({ peer, userId });
                        setPeers((prevPeers) => [...prevPeers, { peer, userId }]);
                    });
                });

                socketRef.current.on("user-joined", (userId) => {
                    if (!peerConnections[userId]) {
                        const peer = createPeer(userId, localStream);
                        peerConnections[userId] = peer;
                        peersRef.current.push({ peer, userId });
                        setPeers((prevPeers) => [...prevPeers, { peer, userId }]);
                    }
                });

                socketRef.current.on("receive-signal", ({ from, signal }) => {
                    if (!peerConnections[from]) {
                        const peer = addPeer(from, signal, localStream);
                        peerConnections[from] = peer;
                        peersRef.current.push({ peer, userId: from });
                        setPeers((prevPeers) => [...prevPeers, { peer, userId: from }]);
                    }
                });

                socketRef.current.on("user-left", (userId) => {
                    console.log(`[CLIENT] Removing user ${userId} from video chat`);

                    if (peerConnections[userId]) {
                        peerConnections[userId].destroy();
                        delete peerConnections[userId];
                    }

                    peersRef.current = peersRef.current.filter(({ userId: id }) => id !== userId);
                    setPeers((prevPeers) => prevPeers.filter((p) => p.userId !== userId));

                    const videoElement = document.getElementById(`video-${userId}`);
                    if (videoElement) {
                        videoElement.remove();
                    }
                });

            } catch (error) {
                console.error("Error accessing media devices:", error);
            }
        };

        init();

        return () => {
            if (socketRef.current) {
                socketRef.current.off('joined');
                socketRef.current.off('userLeft');
                socketRef.current.off('newMessage');
                socketRef.current.off("all-users");
                socketRef.current.off("user-joined");
                socketRef.current.off("receive-signal");
                socketRef.current.off("user-left");
                socketRef.current.disconnect();
            }

            peersRef.current.forEach(({ peer }) => peer.destroy());
        };
    }, [location.state?.username, navigate, roomId]);




    //yha pr extra code dale hai 




    const createPeer = (userId, stream) => {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
        });

        peer.on("signal", (signal) => {
            socket.emit("send-signal", { to: userId, signal });
        });

        peer.on("stream", (remoteStream) => {
            setPeers((prevPeers) => prevPeers.map(p => p.userId === userId ? { ...p, remoteStream } : p));
        });

        return peer;
    };

    const addPeer = (userId, signal, stream) => {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream,
        });

        peer.signal(signal);

        peer.on("stream", (remoteStream) => {
            setPeers((prevPeers) => prevPeers.map(p => p.userId === userId ? { ...p, remoteStream } : p));
        });

        return peer;
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks()[0].enabled = !videoEnabled;
            setVideoEnabled(!videoEnabled);
        }
    };


    // yha tk ka code

    const handleSendMessage = () => {
        const message = messageRef.current.value;
        if (message.trim() === '') return;

        const newMessage = { username: location.state?.username, message };
        socketRef.current.emit('newMessage', newMessage);
        setMessages((prev) => [...prev, newMessage]);

        messageRef.current.value = '';
    };

    const handleRunCode = async () => {
        const code = codeRef.current;
        if (!code || !code.trim()) {
            toast.error("Error: Code cannot be empty");
            return;
        }

        // Capture the user-provided input from the new textarea
        const userInput = executionInputRef.current ? executionInputRef.current.value : "";

        setLoading(true);
        const response = await executeCode(code, language, userInput);
        setLoading(false);

        if (response.success) {
            setOutput(response.output);
        } else {
            toast.error(`Error: ${response.output}`);
            setOutput("");
        }
    };

    const handleSaveCode = async () => {
        const code = codeRef.current;
        if (!code || !code.trim()) {
            toast.error("Error: Code cannot be empty");
            return;
        }

        try {
            const response = await axios.post('http://localhost:5001/save-code', {
                roomId,
                code,
            });
            if (response.status === 200) {
                toast.success("Code saved successfully!");
            }
        } catch (error) {
            console.error("Error saving code:", error);
            toast.error("Failed to save code");
        }
    };

    if (!location.state) return <Navigate to="/" />;

    const copyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success("Room Id copied");
        } catch (e) {
            toast.error("Unable to copy Id");
        }
    };

    const leaveRoom = () => navigate("/");

    return (
        <div className="container-fluid vh-100">
            <div className="row h-100">
                <div className="col-md-2 bg-dark text-light d-flex flex-column h-100">

                    <hr />


                    <div>
                        {clients.map(client => (
                            <div key={client.id} className='d-flex align-items-center mb-3'>
                                <Avatar
                                    name={client.username}
                                    size={50}
                                    round="14px"
                                    className='mr-3'
                                />
                                <span className='mx-2'>{client.username}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-auto">
                        {/* Import VideoChat Component */}


                        {/* video code starts here */}

                        <div
                            style={{
                                padding: "10px",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "10px",
                            }}
                        >
                            {/* Local Video */}
                            <div style={{ width: "200px", height: "200px", position: "relative", borderRadius: "8px", overflow: "hidden" }}>
                                {/* Avatar at top-left */}
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "8px",
                                        left: "8px",
                                        backgroundColor: "#000",
                                        color: "#fff",
                                        width: "30px",
                                        height: "30px",
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontWeight: "bold",
                                        fontSize: "14px",
                                    }}
                                >
                                    {clients[0]?.username.charAt(0).toUpperCase()}
                                </div>

                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />

                                {/* Username at bottom-right */}
                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: "5px",
                                        right: "5px",
                                        backgroundColor: "#000",
                                        color: "#fff",
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        fontSize: "12px",
                                    }}
                                >
                                    {clients[0]?.username}
                                </div>
                            </div>

                            {/* Remote Video Streams */}
                            {peers.map(({ userId, remoteStream }, index) => {
                                const peerClient = clients[index + 1]; // Get corresponding client for remote user

                                return (
                                    <div key={userId} style={{ width: "200px", height: "200px", position: "relative", borderRadius: "8px", overflow: "hidden" }}>
                                        {/* Avatar at top-left */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "8px",
                                                left: "8px",
                                                backgroundColor: "#000",
                                                color: "#fff",
                                                width: "30px",
                                                height: "30px",
                                                borderRadius: "50%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: "bold",
                                                fontSize: "14px",
                                            }}
                                        >
                                            {peerClient?.username?.charAt(0).toUpperCase() || "?"}
                                        </div>

                                        <video
                                            autoPlay
                                            playsInline
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            ref={(video) => {
                                                if (video && remoteStream) {
                                                    video.srcObject = remoteStream;
                                                }
                                            }}
                                        />

                                        {/* Username at bottom-right */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                bottom: "5px",
                                                right: "5px",
                                                backgroundColor: "#000",
                                                color: "#fff",
                                                padding: "4px 8px",
                                                borderRadius: "4px",
                                                fontSize: "12px",
                                            }}
                                        >
                                            {peerClient?.username || "Unknown"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* video code ends */}

                        <hr />
                        <button onClick={copyRoomId} className="btn btn-success">Copy Room Id</button>
                        <button
                            onClick={leaveRoom}
                            className="mt-2 btn btn-danger mb-2 btn-block"
                            style={{ padding: "10px 36px" }}
                        >
                            Leave Room
                        </button>

                        <button
                            onClick={() => setShowChat(!showChat)}
                            className="btn btn-secondary"
                            style={{ padding: "10px 36px" }}
                        >
                            Toggle Chat
                        </button>
                    </div>
                </div>

                <div className={showChat ? "col-md-7 d-flex flex-column" : "col-md-10 d-flex flex-column"}>
                    <div style={{ height: 'calc(80vh - 60px)', overflow: 'auto', padding: '10px', border: '1px solid #333' }}>
                        <Editor socketRef={socketRef} roomId={roomId} onCodeChange={(code) => (codeRef.current = code)} />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                        <select
                            className="form-select"
                            style={{ width: '20%' }}
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                        >
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.name}
                                </option>
                            ))}
                        </select>
                        <button onClick={handleRunCode} className="btn btn-primary" disabled={loading}>
                            {loading ? "Running..." : "Run Code"}
                        </button>
                        <button onClick={handleSaveCode} className="btn btn-success">Save Code</button>
                    </div>

                    {/* New Input Field for Code Execution Input */}
                    <div className="mt-2">
                        <label htmlFor="codeInput" className="form-label">Input (if required):</label>
                        <textarea
                            id="codeInput"
                            ref={executionInputRef}
                            placeholder="Enter input for your code here"
                            rows="3"
                            className="form-control"
                        ></textarea>
                    </div>

                    <div className="mt-2" style={{ height: 'calc(26vh - 60px)', overflowY: 'auto', padding: '10px', border: '1px solid #333', color: 'white' }}>
                        <strong>Output:</strong>
                        <pre>{output}</pre>
                    </div>
                </div>

                {showChat && (
                    <div className="col-md-3 d-flex flex-column position-relative" style={{ borderLeft: '1px solid #333' }}>
                        <button
                            onClick={() => setShowChat(false)}
                            style={{
                                position: 'absolute',
                                top: '4px',
                                right: '10px',
                                background: 'none',
                                border: 'none',
                                fontSize: '20px',
                                color: 'white',
                                cursor: 'pointer',
                                zIndex: 10
                            }}
                        >
                            &#x2715;
                        </button>
                        <div
                            className="chat-box overflow-auto"
                            style={{
                                flexGrow: 1,
                                color: 'white',
                                paddingTop: '40px',
                                paddingRight: '10px',
                                paddingLeft: '10px'
                            }}
                        >
                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`d-flex ${msg.username === location.state?.username ? 'justify-content-end' : 'justify-content-start'}`}
                                >
                                    <div
                                        className={`message-box p-2 mb-2 ${msg.username === location.state?.username ? 'bg-primary text-light' : 'bg-secondary text-light'}`}
                                        style={{ maxWidth: '70%', borderRadius: '10px', paddingTop: '20px' }}
                                    >
                                        {msg.username !== location.state?.username && <strong>{msg.username}</strong>}
                                        <div>{msg.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="chat-input d-flex">
                            <input
                                type="text"
                                ref={messageRef}
                                className="form-control"
                                placeholder="Type a message"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSendMessage();
                                    }
                                }}
                            />
                            <button onClick={handleSendMessage} className="btn btn-primary">Send</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default EditorPage;
