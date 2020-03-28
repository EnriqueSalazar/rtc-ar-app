import React, { useRef, useEffect } from "react";

export default function VideoRoom(props: any) {
  const videoEl = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoEl.current && props.stream) {
      videoEl.current.srcObject = props.stream;
    }
    console.log("Stream:", videoEl?.current?.srcObject);
  }, [props.stream]);

  return (
      <video
        style={{
          background: "black",
          width: 640,
          height: "100%",
          display: "block",
          margin: "1em"
        }}
        ref={videoEl}
        muted
        autoPlay
        playsInline
      ></video>

  );
}
