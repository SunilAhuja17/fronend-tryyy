import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCallStarted, setIsCallStarted] = useState(false);

  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  const createPeer = () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && remoteSocketId) {
        socket.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    return peer;
  };

  const startCall = async () => {
    if (!remoteSocketId || isCallStarted) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setMyStream(stream);
    if (myVideoRef.current) myVideoRef.current.srcObject = stream;

    const peer = createPeer();
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peerRef.current = peer;

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("user:call", { to: remoteSocketId, offer });

    setIsCallStarted(true);
  };

  const handleUserJoined = useCallback(({ id }) => {
    setRemoteSocketId(id);
  }, []);

  const handleIncomingCall = useCallback(async ({ from, offer }) => {
    setRemoteSocketId(from);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setMyStream(stream);
    if (myVideoRef.current) myVideoRef.current.srcObject = stream;

    const peer = createPeer();
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peerRef.current = peer;

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("call:accepted", { to: from, answer });
  }, [socket]);

  const handleCallAccepted = useCallback(async ({ answer }) => {
    await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleIceCandidate = useCallback(async ({ candidate }) => {
    try {
      await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error adding received ice candidate", error);
    }
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("ice-candidate", handleIceCandidate);
    };
  }, [socket, handleUserJoined, handleIncomingCall, handleCallAccepted, handleIceCandidate]);

  return (
    <div className="min-h-screen bg-[#0e1628] flex flex-col items-center px-4 py-6 gap-4">
      <h1 className="text-4xl font-bold text-white">🔗 Room</h1>
      <p className="text-green-500 text-xl font-medium">✅ Connected</p>

      {remoteSocketId && !isCallStarted && (
        <button
          onClick={startCall}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg mt-4"
        >
          📞 CALL / SEND STREAM
        </button>
      )}

      <div className="flex flex-col md:flex-row gap-4 mt-6 w-full max-w-3xl justify-center items-center">
        <div className="bg-gray-800 p-4 rounded-xl w-full md:w-1/2 flex flex-col items-center">
          <h2 className="text-white font-semibold text-lg mb-2">📷 My Stream</h2>
          <video
            ref={myVideoRef}
            autoPlay
            muted
            playsInline
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
