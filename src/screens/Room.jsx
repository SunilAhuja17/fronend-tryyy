import React, { useEffect, useCallback, useState, useRef } from "react";
import { useSocket } from "../context/SocketProvider";
import peer from "../service/peer";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();

  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const handleUserJoined = useCallback(({ email, id }) => {
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setMyStream(stream);
    if (myVideoRef.current) {
      myVideoRef.current.srcObject = stream;
    }
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (myStream) {
      myStream.getTracks().forEach((track) => {
        peer.peer.addTrack(track, myStream);
      });
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams[0];
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg w-80 text-center">
        <h1 className="text-3xl font-bold mb-4">🔗 Room</h1>
        <h4 className={`text-lg mb-4 ${remoteSocketId ? "text-green-400" : "text-red-400"}`}>
          {remoteSocketId ? "✅ Connected" : "❌ No one in room"}
        </h4>

        {remoteSocketId && (
          <button
            onClick={handleCallUser}
            className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded mb-2"
          >
            📞 CALL
          </button>
        )}

        {myStream && (
          <button
            onClick={sendStreams}
            className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded"
          >
            🎥 Send Stream
          </button>
        )}
      </div>

      {/* Video Section */}
      <div className="flex flex-col md:flex-row gap-4 mt-6 items-center md:items-start">
        {myStream && (
          <div className="bg-gray-700 p-3 rounded-lg shadow-lg w-[240px] h-[160px] md:w-[300px] md:h-[200px]">
            <h2 className="text-center mb-2">📷 My Stream</h2>
            <video
              ref={myVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full rounded-md object-cover"
            />
          </div>
        )}

        {remoteStream && (
          <div className="bg-gray-700 p-3 rounded-lg shadow-lg w-[240px] h-[160px] md:w-[300px] md:h-[200px]">
            <h2 className="text-center mb-2">🧑‍🤝‍🧑 Remote Stream</h2>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full rounded-md object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomPage;
