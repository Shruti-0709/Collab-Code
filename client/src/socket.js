import {io} from 'socket.io-client';

export const initSocket = async () => {
    const option = {
        'force new connection': true,
        reconnectionAttempts: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };
    return io('http://localhost:5001', option);
    
};