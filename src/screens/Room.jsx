import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const peer = useRef(
    new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })
  ).current;

  const handleUserJoined = useCallback(({ email, id }) => {
    setRemoteSocketId(id);
  }, []);

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

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      const ans = await peer.createAnswer(offer);
      await peer.setLocalDescription(ans);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket, peer]
  );

  const handleCallAccepted = useCallback(
    async ({ ans }) => {
      await peer.setRemoteDescription(new RTCSessionDescription(ans));
    },
    [peer]
  );

  const handleNegotiationNeeded = useCallback(async () => {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("user:call", { to: remoteSocketId, offer });
  }, [peer, remoteSocketId, socket]);

  useEffect(() => {
    peer.onnegotiationneeded = handleNegotiationNeeded;
  }, [handleNegotiationNeeded, peer]);

  useEffect(() => {
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };
  }, [peer]);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setMyStream(stream);
    if (myVideoRef.current) {
      myVideoRef.current.srcObject = stream;
    }

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("user:call", { to: remoteSocketId, offer });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
    };
  }, [socket, handleUserJoined, handleIncommingCall, handleCallAccepted]);

  return (
    <div className="min-h-screen bg-[#0e1628] flex flex-col items-center px-4 py-6 gap-4">
      <h1 className="text-4xl font-bold text-white">🔗 Room</h1>
      <p className="text-green-500 text-xl font-medium">✅ Connected</p>

      <button
        onClick={handleCallUser}
        className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold shadow hover:bg-blue-600 transition"
      >
        📞 CALL
      </button>

      <div className="flex flex-col md:flex-row gap-4 mt-6 w-full max-w-3xl justify-center items-center">
        <div className="bg-gray-800 p-4 rounded-xl w-full md:w-1/2 flex flex-col items-center">
          <h2 className="text-white font-semibold text-lg mb-2">📷 My Stream</h2>
          <video
            ref={myVideoRef}
            autoPlay
            playsInline
            muted
            className="rounded-xl w-full h-64 object-cover"
          />
        </div>

        <div className="bg-gray-800 p-4 rounded-xl w-full md:w-1/2 flex flex-col items-center">
          <h2 className="text-white font-semibold text-lg mb-2">👬 Remote Stream</h2>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="rounded-xl w-full h-64 object-cover"
          />
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
