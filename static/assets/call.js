"use strict";
const baseURL = "/";

let localVideo = document.querySelector("#localVideo");
let remoteVideo = document.querySelector("#remoteVideo");

let otherUser;
let remoteRTCMessage;

let iceCandidatesFromCaller = [];
let peerConnection;
let remoteStream;
let localStream;

let callInProgress = false;

let socket;
function callProgress() {
  document.getElementById("videos").style.display = "block";
  document.getElementById("otherUserNameC").innerHTML = otherUser;
  document.getElementById("inCall").style.display = "block";
  callInProgress = true;
}

// event from html
function call() {
  let userToCall = document.getElementById("callName").value;
  otherUser = userToCall;

  beReady().then((bool) => {
    processCall(userToCall);
  });
}

//event from html
function answer() {
  beReady().then((bool) => {
    processAccept();
  });

  document.getElementById("answer").style.display = "none";
}

function connectSocket() {
  socket = io.connect(baseURL, {
    query: {
      name: myName,
    },
  });

  socket.on("newCall", (data) => {
    otherUser = data.caller;
    remoteRTCMessage = data.rtcMessage;

    //DISPLAY ANSWER SCREEN
    document.getElementById("callerName").innerHTML = otherUser;
    document.getElementById("call").style.display = "none";
    document.getElementById("answer").style.display = "block";
  });

  socket.on("callAnswered", (data) => {
    remoteRTCMessage = data.rtcMessage;
    peerConnection.setRemoteDescription(
      new RTCSessionDescription(remoteRTCMessage)
    );
    document.getElementById("calling").style.display = "none";
    console.log("call started, They answered");
    callProgress();
  });

  socket.on("ICEcandidate", (data) => {
    let message = data.rtcMessage;

    let candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });

    if (peerConnection) {
      console.log("ICE candidate Added");
      peerConnection.addIceCandidate(candidate);
    } else {
      console.log("ICE candidate pushed");
      iceCandidatesFromCaller.push(candidate);
    }
  });
}

let pcConfig = {
  iceServers: [
    { urls: ["stun:bn-turn1.xirsys.com"] },
    {
      username:
        "0kYXFmQL9xojOrUy4VFemlTnNPVFZpp7jfPjpB3AjxahuRe4QWrCs6Ll1vDc7TTjAAAAAGAG2whXZWJUdXRzUGx1cw==",
      credential: "285ff060-5a58-11eb-b269-0242ac140004",
      urls: [
        "turn:bn-turn1.xirsys.com:80?transport=udp",
        "turn:bn-turn1.xirsys.com:3478?transport=udp",
        "turn:bn-turn1.xirsys.com:80?transport=tcp",
        "turn:bn-turn1.xirsys.com:3478?transport=tcp",
        "turns:bn-turn1.xirsys.com:443?transport=tcp",
        "turns:bn-turn1.xirsys.com:5349?transport=tcp",
      ],
    },
  ],
};

function beReady() {
  return navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .then((stream) => {
      localStream = stream;
      localVideo.srcObject = stream;

      return createConnectionAndAddStream();
    })
    .catch(function (e) {
      alert("getUserMedia() error: " + e.name);
    });
}

function createConnectionAndAddStream() {
  createPeerConnection();
  peerConnection.addStream(localStream);
  return true;
}

function processCall(userName) {
  peerConnection.createOffer(
    (sessionDescription) => {
      peerConnection.setLocalDescription(sessionDescription);

      //EMIT TO SOCKET
      sendCall({
        name: userName,
        rtcMessage: sessionDescription,
      });
    },
    (error) => {
      console.log("Error");
    }
  );
}
/**
 *
 * @param {Object} data
 * @param {number} data.name
 * @param {Object} data.rtcMessage
 */
function sendCall(data) {
  // to send a call
  console.log("send call");
  socket.emit("call", data);
  document.getElementById("call").style.display = "none";
  document.getElementById("otherUserNameCA").innerHTML = otherUser;
  document.getElementById("calling").style.display = "block";
}
function answerCall(data) {
  // to answer a call
  socket.emit("answerCall", data);
  callProgress();
}
function processAccept() {
  peerConnection.setRemoteDescription(
    new RTCSessionDescription(remoteRTCMessage)
  );
  peerConnection.createAnswer(
    (sessionDescription) => {
      peerConnection.setLocalDescription(sessionDescription);

      if (iceCandidatesFromCaller.length > 0) {
        for (let i = 0; i < iceCandidatesFromCaller.length; i++) {
          let candidate = iceCandidatesFromCaller[i];
          console.log("ICE candidate Added from queue");
          try {
            peerConnection
              .addIceCandidate(candidate)
              .then((done) => {
                console.log(done);
              })
              .catch((error) => {
                console.log(error);
              });
          } catch (error) {
            console.log(error);
          }
        }
      }
      //EMIT TO SOCKET
      answerCall({
        caller: otherUser,
        rtcMessage: sessionDescription,
      });
    },
    (error) => {
      console.log("Error");
    }
  );
}

function createPeerConnection() {
  try {
    // peerConnection = new RTCPeerConnection(pcConfig);
    peerConnection = new RTCPeerConnection();
    peerConnection.onicecandidate = handleIceCandidate;
    peerConnection.onaddstream = handleRemoteStreamAdded;
    peerConnection.onremovestream = handleRemoteStreamRemoved;
    console.log("Created RTCPeerConnnection");
    return;
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    //EMIT TO SOCKET
    sendICEcandidate({
      user: otherUser,
      rtcMessage: {
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
      },
    });
  } else {
    console.log("End of candidates.");
  }
}
function sendICEcandidate(data) {
  console.log("Send ICE candidate");
  socket.emit("ICEcandidate", data);
}

function handleRemoteStreamAdded(event) {
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  remoteVideo.srcObject = null;
  localVideo.srcObject = null;
}

function processCall(userName) {
  peerConnection.createOffer(
    (sessionDescription) => {
      peerConnection.setLocalDescription(sessionDescription);

      //EMIT TO SOCKET
      sendCall({
        name: userName,
        rtcMessage: sessionDescription,
      });
    },
    (error) => {
      console.log("Error");
    }
  );
}

function processAccept() {
  peerConnection.setRemoteDescription(
    new RTCSessionDescription(remoteRTCMessage)
  );
  peerConnection.createAnswer(
    (sessionDescription) => {
      peerConnection.setLocalDescription(sessionDescription);

      //EMIT TO SOCKET
      answerCall({
        caller: otherUser,
        rtcMessage: sessionDescription,
      });
    },
    (error) => {
      console.log("Error");
    }
  );
}
