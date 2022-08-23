

const servers = {
  iceServers: [
    {
      urls: []
    },
  ],
  iceCandidatePoolSize: 10,
};

//global state
let pc = new RTCPeerConnection(servers);
//my webcam
let localstream = null;
//my friends webcam
let remoteStream = null;




const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');



//1. set up media sources

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
  remoteStream = new MediaStream();

  //push tracks from local stream to peer connection
  localStream.getTracks().forEach((track)=> {
    pc.addTrack(track, localStream);
  });

  //pull tracks from remote stream, add to video stream
  pc.ontrack =  event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStorage;
  remoteStream.srcObject = remoteStream;

};



//2. create an offer
callButton.onclick = async () => {

  //reference firestore collection
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCantdidates');
  const answerCandidates = callDoc.collection('answerCandidates');


  callInput.value = call.id;

  // get candidates for caller, save to database
  pc.onicecandidate = event => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };


  //create offer

  const offerDiscription = await pc.createOffer();
  await pc.setLocalDescription(offerDiscription);


  const offer = {
    sdp: offerDiscription.sdp,
    type: offerDiscription.type,
  };

  await callDoc.set({ offer });

  //listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDiscription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDiscription);
    }
  });

  //when answered, add candidate to  peer connection
  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

};

//3. answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');

  pc.onicecandidate = event => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDiscription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDiscription));


  const answerDiscription = await pc.createAnswer();
  await pc.setLocalDescription(answerDiscription);


  const answer = {
    type: answerDiscription.type,
    sdp: answerDiscription.sdp,
  };

  await callDoc.update({});

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change)
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};


