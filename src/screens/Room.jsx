import React, { useEffect, useCallback, useState } from "react";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

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
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
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
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <div className="p-6 bg-gray-800 rounded-lg shadow-lg w-96 text-center">
        <h1 className="text-3xl font-bold mb-4">🔗 Room</h1>
        <h4 className={`text-lg mb-4 ${remoteSocketId ? "text-green-400" : "text-red-400"}`}>
          {remoteSocketId ? "✅ Connected" : "❌ No one in room"}
        </h4>

        {remoteSocketId && (
          <button
            onClick={handleCallUser}
            className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded transition-all duration-300 mb-2"
          >
            📞 CALL
          </button>
        )}

        {myStream && (
          <button
            onClick={sendStreams}
            className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded transition-all duration-300"
          >
            🎥 Send Stream
          </button>
        )}
      </div>

      <div className="flex gap-6 mt-8 flex-wrap justify-center">
        {myStream && (
          <div className="bg-gray-700 p-4 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold text-center mb-2">📹 My Stream</h2>
            <video
              playsInline
              muted
              autoPlay
              ref={(ref) => ref && (ref.srcObject = myStream)}
              className="rounded-lg overflow-hidden w-60 h-36 sm:w-72 sm:h-40"
            />
          </div>
        )}

        {remoteStream && (
          <div className="bg-gray-700 p-4 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold text-center mb-2">🧑‍🤝‍🧑 Remote Stream</h2>
            <video
              playsInline
              autoPlay
              ref={(ref) => ref && (ref.srcObject = remoteStream)}
              className="rounded-lg overflow-hidden w-60 h-36 sm:w-72 sm:h-40"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomPage;
