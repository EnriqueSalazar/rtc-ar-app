import React, { useState, useRef, useEffect } from "react";
import { db } from "../shared/firebase";
import VideoRoom from "./Room/VideoStream";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Input from "@material-ui/core/Input";
import IconButton from "@material-ui/core/IconButton";
import SendIcon from "@material-ui/icons/Send";

export function Room() {
  const localVideoEl = useRef<HTMLVideoElement>(null);
  const remoteVideoEl = useRef<HTMLVideoElement>(null);

  const [disableCameraBtn, setDisableCameraBtn] = useState(false);
  const [disableJoinRoomBtn, setDisableJoinRoomBtn] = useState(true);
  const [disableHangupBtn, setDisableHangupBtn] = useState(true);
  const [disableCreateRoomBtn, setDisableCreateRoomBtn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [roomId, setRoomId] = useState("");
  const [currentRoomText, setCurrentRoomText] = useState("");
  const [inputRoomId, setInputRoomId] = useState("");
  const [appPeerConnection, setAppPeerConnection] = useState<
    RTCPeerConnection
  >();

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

  const configuration: any = {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302"
        ]
      },
      {
        url: "turn:numb.viagenie.ca",
        credential: "muazkh",
        username: "webrtc@live.com"
      },
      {
        urls: ["turn:13.250.13.83:3478?transport=udp"],
        username: "YzYNCouZM1mhqhmseWk6",
        credential: "YzYNCouZM1mhqhmseWk6"
      },
      {
        url: "turn:192.158.29.39:3478?transport=udp",
        credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
        username: "28224511:1379330808"
      },
      {
        url: "turn:192.158.29.39:3478?transport=tcp",
        credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
        username: "28224511:1379330808"
      },
      {
        url: "turn:turn.bistri.com:80",
        credential: "homeo",
        username: "homeo"
      },
      {
        url: "turn:turn.anyfirewall.com:443?transport=tcp",
        credential: "webrtc",
        username: "webrtc"
      }
    ],
    iceCandidatePoolSize: 10
  };

  async function hangUp() {
    (localVideoEl?.current?.srcObject as MediaStream)
      ?.getTracks()
      .forEach(track => {
        track.stop();
      });

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    if (appPeerConnection) {
      appPeerConnection.close();
    }

    setLocalStream(null);
    setRemoteStream(null);

    setDisableCreateRoomBtn(true);
    setDisableJoinRoomBtn(true);
    setDisableHangupBtn(true);
    setDisableCameraBtn(false);

    setCurrentRoomText("");

    if (roomId) {
      //ToDo: Move to a cache
      const roomRef = db.collection("rooms").doc(roomId);
      await roomRef.delete();
    }

    document.location.reload(true);
  }

  const joinRoom = async () => {
    setDisableCreateRoomBtn(true);
    setDisableJoinRoomBtn(true);

    if (inputRoomId) {
      setRoomId(inputRoomId);
      await joinRoomById(inputRoomId);
    }
  };

  const joinRoomById = async (roomId: string) => {
    const roomRef = db.collection("rooms").doc(`${roomId}`);
    const roomSnapshot: firebase.firestore.DocumentData = await roomRef?.get();
    console.log("Got room:", roomSnapshot?.exists);

    if (roomSnapshot?.exists) {
      console.log("Create PeerConnection with configuration: ", configuration);
      const peerConnection: RTCPeerConnection = new RTCPeerConnection(
        configuration
      );
      registerPeerConnectionListeners(peerConnection);
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
      setAppPeerConnection(peerConnection);
    }
  };

  const registerPeerConnectionListeners = (
    peerConnection: RTCPeerConnection
  ) => {
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
    const peerConnection: RTCPeerConnection = new RTCPeerConnection(
      configuration
    );
    registerPeerConnectionListeners(peerConnection);

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
    setAppPeerConnection(peerConnection);
  };

  const openUserMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { frameRate: { ideal: 10, max: 20 } },
      audio: true
    });
    setLocalStream(stream);
    setRemoteStream(new MediaStream());

    setDisableCameraBtn(true);
    setDisableCreateRoomBtn(false);
    setDisableJoinRoomBtn(false);
    setDisableHangupBtn(false);
  };

  return (
    <div>
      <div>
        <Button onClick={openUserMedia} disabled={disableCameraBtn}>
          Open Mic & Camera
        </Button>
        <Button onClick={createRoom} disabled={disableCreateRoomBtn}>
          Create room
        </Button>
        <Button onClick={hangUp} disabled={disableHangupBtn}>
          Hangup
        </Button>
      </div>
      <div>{currentRoomText}</div>
      <Paper component="form">
        <Input
          disabled={disableJoinRoomBtn}
          placeholder="Room ID"
          onChange={e => {
            setInputRoomId(e?.target?.value || "");
          }}
        />
        <IconButton
          type="submit"
          disabled={disableJoinRoomBtn || !inputRoomId}
          onClick={joinRoom}
        >
          <SendIcon />
        </IconButton>
      </Paper>
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}>
        <VideoRoom stream={localStream} />
        <VideoRoom stream={remoteStream} />
      </div>
    </div>
  );
}
