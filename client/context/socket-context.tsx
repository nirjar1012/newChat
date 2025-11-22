"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useUser } from "@clerk/nextjs";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { user } = useUser();

    useEffect(() => {
        if (!user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001");

        socketInstance.on("connect", () => {
            console.log("Connected to socket server");
            setIsConnected(true);
            if (user) {
                socketInstance.emit("user-online", {
                    id: user.id,
                    first_name: user.firstName,
                    last_name: user.lastName,
                    profile_image: user.imageUrl,
                    email: user.primaryEmailAddress?.emailAddress
                });
            }
        });

        socketInstance.on("disconnect", () => {
            console.log("Disconnected from socket server");
            setIsConnected(false);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [user]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
