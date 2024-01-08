'use strinct';

let uid = sessionStorage.getItem('uid')
if (!uid) {
    uid = String(Math.floor(Math.random() * 10000))
    sessionStorage.setItem('uid', uid)
}
let stream;

let token = null;
let client;
let isCaller;
let rtcPeerConnection;
let rtmClient;
let channel;

const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if (!roomId) {
    roomId = 'main'
}

let displayName = sessionStorage.getItem('display_name')
if (!displayName) {
    window.location = 'lobby.html'
}

let localTracks = []
let remoteUsers = {}

let localScreenTracks;
let sharingScreen = false;
let remoteVideo;
let remoteSteam;
const socket = io.connect();

const pcConfig = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
            ],
        },
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com',
        },
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com',
        },
        {
            urls: 'turn:192.158.29.39:3478?transport=udp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808',
        },
    ],
};


/**
 * Khởi tạo webrtc
 */
const webrtc = new Webrtc(socket, pcConfig, {
    log: true,
    warn: true,
    error: true,
});


let joinRoomInit = async () => {
    console.log('saasdsa');

    await webrtc.addEventListener('userJoined', (e) => {
        handleMemberJoined(e.detail.usersRoom);
    })
    webrtc.addEventListener('userLeft', (e) => {
        handleMemberLeft(e.detail.userId);
    })


    webrtc.addEventListener('message_chat', (e) => {
        let name = e.detail.name;
        let message = e.detail.message;
        let socketId = e.detail.socketId;
        console.log(`Name: ${name}, Message: ${message}`);
        const chatMessageData = {
            text: JSON.stringify({
                type: 'chat',
                displayName: `${name}`,
                message: `${message}`,
                uid: `${socketId}`,
            }),
        };
        handleChannelMessage(chatMessageData);
    });
    //
    // getMembers()
    // addBotMessageToDom(`Welcome to the room ${displayName}! 👋`)
    //
    // client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})
    // await client.join(APP_ID, roomId, token, uid)
    //
    // client.on('user-published', handleUserPublished)
    // client.on('user-left', handleUserLeft)
}

/**
 * Create or join a room
 */
let joinStream = async () => {
    await webrtc.joinRoom(roomId, displayName);
    console.log(roomId)
    document.getElementById('join-btn').style.display = 'none'
    document.getElementsByClassName('stream__actions')[0].style.display = 'flex'
    let player = `<div class="video__container" id="user-container-${uid}">
                        <video id="user-${uid}" autoplay playsinline class="video-player"></video>
                 </div>`
    document.getElementById('streams__container').insertAdjacentHTML('beforeend', player)
    document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)


    /**
     * Get local media
     */
    const localVideo = document.querySelector('.video__container video');
    await webrtc
        .getLocalStream(true, {width: 640, height: 480})
        .then((stream) => (localVideo.srcObject = stream));
    console.log("gotStream")
    webrtc.gotStream();


    /**
     * Xử lý kết nối người dùng mới
     */
    webrtc.addEventListener('newUser', (e) => {
        console.log('newUser')
        const socketId = e.detail.socketId;
        const stream = e.detail.stream;

        const videoContainer = document.createElement('div');
        videoContainer.setAttribute('class', 'video__container');
        videoContainer.setAttribute('id', `user-container-${socketId}`);
        const video = document.createElement('video');
        video.setAttribute('autoplay', true);
        video.setAttribute('muted', false); // set to false
        video.setAttribute('playsinline', true);
        video.setAttribute('id', `user-${socketId}`);
        video.setAttribute('class', 'video-player')
        video.srcObject = stream;
        videoContainer.append(video);

        document.getElementById('streams__container').appendChild(videoContainer)
        document.getElementById(`user-container-${socketId}`).addEventListener('click', expandVideoFrame)

    });

    /**
     * Xử lý người dùng đã bị xóa
     */
    webrtc.addEventListener('removeUser', (e) => {
        const socketId = e.detail.socketId;
        if (!socketId) {
            return;
        }

        let item = document.getElementById(`user-container-${socketId}`)
        console.log(`user-container-${socketId}`)
        if (item) {
            item.remove()
        }

        if (userIdInDisplayFrame === `user-container-${socketId}`) {
            displayFrame.style.display = null

            let videoFrames = document.getElementsByClassName('video__container')

            for (let i = 0; videoFrames.length > i; i++) {
                videoFrames[i].style.height = '300px'
                videoFrames[i].style.width = '300px'
            }
        }
    });


}

let switchToCamera = async () => {

    document.getElementById('mic-btn').classList.remove('active')
    document.getElementById('screen-btn').classList.remove('active')
    document.getElementById('camera-btn').classList.add('active')

    try {

        // Request access to the screen
        let screenStream = await navigator.mediaDevices
            .getUserMedia({
                audio: false,
                video: true,
            })
        let videoTrack = webrtc.localStream.getVideoTracks()[0];

        // Replace the current video track with the screen stream in all RTCPeerConnections
        Object.keys(webrtc.pcs).forEach((socketId) => {
            const senders = webrtc.pcs[socketId].getSenders();
            const videoSender = senders.find(sender => sender.track.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
            }
        });

        // Create and send a new offer for each user
        Object.keys(webrtc.pcs).forEach((socketId) => {
            webrtc._createAndSendOffer(socketId);
        });
        webrtc.localStream.removeTrack(videoTrack);
        webrtc.localStream.addTrack(screenStream.getVideoTracks()[0]);
    } catch (error) {
        console.error("Error sharing screen: ", error);
    }
}

// let handleUserPublished = async (user, mediaType) => {
//     remoteUsers[user.uid] = user
//
//     await client.subscribe(user, mediaType)
//
//     let player = document.getElementById(`user-container-${user.uid}`)
//     if(player === null){
//         player = `<div class="video__container" id="user-container-${user.uid}">
//                 <div class="video-player" id="user-${user.uid}"></div>
//             </div>`
//
//         document.getElementById('streams__container').insertAdjacentHTML('beforeend', player)
//         document.getElementById(`user-container-${user.uid}`).addEventListener('click', expandVideoFrame)
//
//     }
//
//     if(displayFrame.style.display){
//         let videoFrame = document.getElementById(`user-container-${user.uid}`)
//         videoFrame.style.height = '100px'
//         videoFrame.style.width = '100px'
//     }
//
//     if(mediaType === 'video'){
//         user.videoTrack.play(`user-${user.uid}`)
//     }
//
//     if(mediaType === 'audio'){
//         user.audioTrack.play()
//     }
//
// }

// let handleUserLeft = async (user) => {
//     delete remoteUsers[user.uid]
//     let item = document.getElementById(`user-container-${user.uid}`)
//     if(item){
//         item.remove()
//     }
//
//     if(userIdInDisplayFrame === `user-container-${user.uid}`){
//         displayFrame.style.display = null
//
//         let videoFrames = document.getElementsByClassName('video__container')
//
//         for(let i = 0; videoFrames.length > i; i++){
//             videoFrames[i].style.height = '300px'
//             videoFrames[i].style.width = '300px'
//         }
//     }
// }

// In room_rtc.js
let toggleMic = async (e) => {
    let button = e.currentTarget;
    if (webrtc.localStream && webrtc.localStream.getAudioTracks().length > 0) {
        const audioTrack = webrtc.localStream.getAudioTracks()[0];

        if (audioTrack.enabled) {
            // Mic is currently enabled, so mute it
            audioTrack.enabled = false;
            button.classList.remove('active');
        } else {
            // Mic is currently muted, so enable it
            audioTrack.enabled = true;
            button.classList.add('active');
        }
    }
}
// In room_rtc.js
let toggleCamera = async (e) => {
    const localVideo = document.getElementById(`user-${uid}`);
    localVideo.srcObject = webrtc.localStream;

    let button = e.currentTarget;
    if (webrtc.localStream && webrtc.localStream.getVideoTracks().length > 0) {
        const videoTrack = webrtc.localStream.getVideoTracks()[0];

        if (videoTrack.enabled) {
            // Camera is currently enabled, so mute it
            videoTrack.enabled = false;
            button.classList.remove('active');
        } else {
            // Camera is currently muted, so enable it
            videoTrack.enabled = true;
            button.classList.add('active');
        }
    }
}


//
let toggleScreen = async (e) => {

    let screenButton = e.currentTarget
    let cameraButton = document.getElementById('camera-btn')

    if(!sharingScreen){
        sharingScreen = true

        screenButton.classList.add('active')
        cameraButton.classList.remove('active')
        cameraButton.style.display = 'none'
        // document.getElementById(`user-container-${uid}`).remove()
        // displayFrame.style.display = 'block'
        // let player = `<div class="video__container" id="user-container-${uid}">
        //                 <video id="user-${uid}" autoplay playsinline class="video-player"></video>
        //          </div>`
        //
        // displayFrame.insertAdjacentHTML('beforeend', player)
        // document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame
        // userIdInDisplayFrame = `user-container-${uid}`
        // localScreenTracks.play(`user-${webrtc.socketId}`)
        try {

            // Request access to the screen
            let screenStream = await navigator.mediaDevices.getDisplayMedia({video: true});
            let videoTrack = webrtc.localStream.getVideoTracks()[0];

            // Replace the current video track with the screen stream in all RTCPeerConnections
            Object.keys(webrtc.pcs).forEach((socketId) => {
                const senders = webrtc.pcs[socketId].getSenders();
                const videoSender = senders.find(sender => sender.track.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
                }
            });

            // Create and send a new offer for each user
            Object.keys(webrtc.pcs).forEach((socketId) => {
                webrtc._createAndSendOffer(socketId);
            });
            webrtc.localStream.removeTrack(videoTrack);
            webrtc.localStream.addTrack(screenStream.getVideoTracks()[0]);
        } catch (error) {
            console.error("Error sharing screen: ", error);
        }
        // for(let i = 0; videoFrames.length > i; i++){
        //     if(videoFrames[i].id != userIdInDisplayFrame){
        //       videoFrames[i].style.height = '100px'
        //       videoFrames[i].style.width = '100px'
        //     }
        //   }



    }else{
        sharingScreen = false
        cameraButton.style.display = 'block'
        // document.getElementById(`user-container-null`).remove()
        // await client.unpublish([localScreenTracks])

        switchToCamera()
    }
}

//
//
// /**
//  * Leave the room
//  */
//
// const leaveBtn = document.querySelector('#leaveBtn');
// leaveBtn.addEventListener('click', () => {
//     webrtc.leaveRoom();
// });
// webrtc.addEventListener('leftRoom', (e) => {
//     const room = e.detail.roomId;
//     document.querySelector('h1').textContent = '';
//     notify(`Left the room ${room}`);
// });
let leaveStream = async (e) => {
    e.preventDefault();
    location.reload();

    // // Leave the current room
    // webrtc.leaveRoom();
    // // Remove user's video from DOM
    // let userContainer = document.getElementById(`user-container-${webrtc.socketId}`);
    // if (userContainer) {
    //     userContainer.remove();
    // }

    // // Stop and close all local tracks
    // for (let track of localTracks) {
    //     track.stop();
    //     track.close();
    // }

    // // Hide streaming controls and show "Join Stream" button
    // document.getElementsByClassName('stream__actions')[0].style.display = 'none';
    // document.getElementById('join-btn').style.display = 'block';

}
let shareScreen = async () => {
    try {

        // Request access to the screen
        let screenStream = await navigator.mediaDevices.getDisplayMedia({video: true});
        let videoTrack = webrtc.localStream.getVideoTracks()[0];

        // Replace the current video track with the screen stream in all RTCPeerConnections
        Object.keys(webrtc.pcs).forEach((socketId) => {
            const senders = webrtc.pcs[socketId].getSenders();
            const videoSender = senders.find(sender => sender.track.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
            }
        });

        // Create and send a new offer for each user
        Object.keys(webrtc.pcs).forEach((socketId) => {
            webrtc._createAndSendOffer(socketId);
        });
        webrtc.localStream.removeTrack(videoTrack);
        webrtc.localStream.addTrack(screenStream.getVideoTracks()[0]);
    } catch (error) {
        console.error("Error sharing screen: ", error);
    }
}

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('screen-btn').addEventListener('click', toggleScreen)
document.getElementById('join-btn').addEventListener('click', joinStream)
document.getElementById('leave-btn').addEventListener('click', leaveStream)


joinRoomInit()