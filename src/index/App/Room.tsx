import React, { useState, useRef, useEffect } from "react";
import styles from "./Room/Room.module.css";
import { db } from "../shared/firebase";
import VideoRoom from "./Room/VideoStream";

export function Room() {
  let peerConnection: RTCPeerConnection | null = null;

  const localVideoEl = useRef<HTMLVideoElement>(null);
  const remoteVideoEl = useRef<HTMLVideoElement>(null);
  const roomInputEl = useRef<HTMLInputElement>(null);

  const [disableJoinRoomBtn, setDisableJoinRoomBtn] = useState(false);
  const [disableHangupBtn, setDisableHangupBtn] = useState(false);
  const [disableCreateRoomBtn, setDisableCreateRoomBtn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [roomId, setRoomId] = useState("");
  const [currentRoomText, setCurrentRoomText] = useState("");

  useEffect(() => {
    if (localVideoEl.current) {
      localVideoEl.current.srcObject = localStream;
    }
    console.log("Stream:", localVideoEl?.current?.srcObject);
  }, [localStream]);
  useEffect(() => {
    if (remoteVideoEl.current) {
      remoteVideoEl.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const configuration = {
    iceServers: [
      {
        urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
      }
    ],
    iceCandidatePoolSize: 10
  };

  const joinRoom = async () => {
    setDisableCreateRoomBtn(true);
    setDisableJoinRoomBtn(true);

    if (roomInputEl?.current?.value) {
      setRoomId(roomInputEl.current.value);
      await joinRoomById(roomInputEl.current.value);
    }
  };

  const joinRoomById = async (roomId: string) => {
    const roomRef = db.collection("rooms").doc(`${roomId}`);
    const roomSnapshot: firebase.firestore.DocumentData = await roomRef.get();
    console.log("Got room:", roomSnapshot.exists);

    if (roomSnapshot.exists) {
      console.log("Create PeerConnection with configuration: ", configuration);
      peerConnection = new RTCPeerConnection(configuration);
      registerPeerConnectionListeners();
      localStream?.getTracks().forEach(track => {
        peerConnection?.addTrack(track, localStream);
      });

      const calleeCandidatesCollection = roomRef.collection("calleeCandidates");
      peerConnection?.addEventListener("icecandidate", event => {
        if (!event.candidate) {
          console.log("Got final candidate!");
          return;
        }
        console.log("Got candidate: ", event.candidate);
        calleeCandidatesCollection.add(event.candidate.toJSON());
      });

      peerConnection?.addEventListener("track", event => {
        console.log("Got remote track:", event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
          console.log("Add a track to the remoteStream:", track);
          remoteStream?.addTrack(track);
          setRemoteStream(remoteStream);
        });
      });

      const offer = roomSnapshot?.data().offer;
      console.log("Got offer:", offer);
      await peerConnection?.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection?.createAnswer();
      console.log("Created answer:", answer);
      await peerConnection?.setLocalDescription(answer);

      const roomWithAnswer = {
        answer: {
          type: answer.type,
          sdp: answer.sdp
        }
      };
      await roomRef.update(roomWithAnswer);

      roomRef.collection("callerCandidates").onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
          if (change.type === "added") {
            let data = change.doc.data();
            console.log(
              `Got new remote ICE candidate: ${JSON.stringify(data)}`
            );
            await peerConnection?.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
    }
  };

  const registerPeerConnectionListeners = () => {
    peerConnection?.addEventListener("icegatheringstatechange", () => {
      console.log(
        `ICE gathering state changed: ${peerConnection?.iceGatheringState}`
      );
    });

    peerConnection?.addEventListener("connectionstatechange", () => {
      console.log(
        `Connection state change: ${peerConnection?.connectionState}`
      );
    });

    peerConnection?.addEventListener("signalingstatechange", () => {
      console.log(`Signaling state change: ${peerConnection?.signalingState}`);
    });

    peerConnection?.addEventListener("iceconnectionstatechange ", () => {
      console.log(
        `ICE connection state change: ${peerConnection?.iceConnectionState}`
      );
    });
  };
  const createRoom = async () => {
    setDisableCreateRoomBtn(true);
    setDisableJoinRoomBtn(true);
    const roomRef = await db.collection("rooms").doc();

    console.log("Create PeerConnection with configuration: ", configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();

    localStream?.getTracks().forEach(track => {
      peerConnection?.addTrack(track, localStream);
    });

    const callerCandidatesCollection = roomRef.collection("callerCandidates");

    peerConnection?.addEventListener("icecandidate", event => {
      if (!event.candidate) {
        console.log("Got final candidate!");
        return;
      }
      console.log("Got candidate: ", event.candidate);
      callerCandidatesCollection.add(event.candidate.toJSON());
    });

    const offer = await peerConnection?.createOffer();
    await peerConnection?.setLocalDescription(offer);
    console.log("Created offer:", offer);

    const roomWithOffer = {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    };
    await roomRef.set(roomWithOffer);
    setRoomId(roomRef.id);
    console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
    setCurrentRoomText(`Current room is ${roomRef.id} - You are the caller!`);

    peerConnection?.addEventListener("track", event => {
      console.log("Got remote track:", event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log("Add a track to the remoteStream:", track);
        remoteStream?.addTrack(track);
        setRemoteStream(remoteStream);
      });
    });

    roomRef.onSnapshot(async snapshot => {
      const data = snapshot.data();
      if (!peerConnection?.currentRemoteDescription && data?.answer) {
        console.log("Got remote description: ", data?.answer);
        const rtcSessionDescription = new RTCSessionDescription(data?.answer);
        await peerConnection?.setRemoteDescription(rtcSessionDescription);
      }
    });

    roomRef.collection("calleeCandidates").onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === "added") {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await peerConnection?.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  const openUserMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    setLocalStream(stream);
    setRemoteStream(new MediaStream());

    setDisableCreateRoomBtn(false);
    setDisableJoinRoomBtn(false);
    setDisableHangupBtn(false);
  };

  const closeUserMedia = async () => {
    setLocalStream(null);
    setRemoteStream(null);

    peerConnection = null;

    setDisableCreateRoomBtn(true);
    setDisableJoinRoomBtn(true);
    setDisableHangupBtn(true);
  };

  return (
    <div>
      <div className={styles.row}>
        {!localStream && (
          <button className={styles.button} onClick={openUserMedia}>
            Open Mic & Camera
          </button>
        )}
        {localStream && (
          <button className={styles.button} onClick={closeUserMedia}>
            Disable Mic & Camera
          </button>
        )}
        <button
          className={styles.button}
          onClick={createRoom}
          disabled={disableCreateRoomBtn}
        >
          Create room
        </button>
        <button
          className={styles.button}
          onClick={joinRoom}
          disabled={disableJoinRoomBtn}
        >
          Join room
        </button>
        <button
          className={styles.button}
          onClick={createRoom}
          disabled={disableHangupBtn}
        >
          Hangup
        </button>
        {roomId}
      </div>
      <div>{currentRoomText}</div>
      <div>
        <input ref={roomInputEl} />
      </div>
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}>
        <VideoRoom stream={localStream} />
        <VideoRoom stream={remoteStream} />
      </div>
    </div>
  );
}
