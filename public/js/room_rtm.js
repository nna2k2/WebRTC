
let listMembers=[];
let handleMemberJoined = async (users) => {
    // console.log('A new member has joined the room:',)
    if(listMembers.length>0){
        await addMemberToDom(users[users.length-1])
        listMembers.push(users[users.length-1])
        addBotMessageToDom(`Welcome to the room ${users[users.length-1].displayName}! 👋`)
    }else {
        for(const user of users){
            listMembers.push(user)
            await addMemberToDom(user)
        }
        addBotMessageToDom(`Welcome to the room ${ users[users.length-1].displayName}! 👋`)
    }
    updateMemberTotal(listMembers)

}

let addMemberToDom = async (user) => {

    let membersWrapper = document.getElementById('member__list')
    let memberItem = `<div class="member__wrapper" id="member__${user.id}__wrapper">
                        <span class="green__icon"></span>
                        <p class="member_name">${user.displayName}</p>
                    </div>`

    membersWrapper.insertAdjacentHTML('beforeend', memberItem)
}

let updateMemberTotal = async (listMembers) => {
    let total = document.getElementById('members__count')
    total.innerText = listMembers.length
}

let handleMemberLeft = async (MemberId) => {
    listMembers = listMembers.filter(user => user.id !== MemberId)
    removeMemberFromDom(MemberId)
    updateMemberTotal(listMembers)
}

let removeMemberFromDom = async (MemberId) => {
    let memberWrapper = document.getElementById(`member__${MemberId}__wrapper`)
    let name = memberWrapper.getElementsByClassName('member_name')[0].textContent
    addBotMessageToDom(`${name} has left the room.`)

    memberWrapper.remove()
}

let handleChannelMessage = async (messageData) => {
    console.log('A new message was received')
    let data = JSON.parse(messageData.text)

    if(data.type === 'chat'){
        addMessageToDom(data.displayName, data.message)
    }

    if(data.type === 'user_left'){
        document.getElementById(`user-container-${webrtc.socketId}`).remove()

        if(userIdInDisplayFrame === `user-container-${webrtc.socketId}`){
            displayFrame.style.display = null

            for(let i = 0; videoFrames.length > i; i++){
                videoFrames[i].style.height = '300px'
                videoFrames[i].style.width = '300px'
            }
        }
    }
}

let sendMessage = async (e) => {
    e.preventDefault()

    let message = e.target.message.value
    console.log("room:"+roomId+"name:"+displayName+"mess:"+message)
    webrtc.sendMessageData(displayName,message,roomId)
    addMessageToDom(displayName, message)
    e.target.reset()
}

let addMessageToDom = (name, message) => {
    let messagesWrapper = document.getElementById('messages')

    let newMessage = `<div class="message__wrapper">
                        <div class="message__body">
                            <strong class="message__author">${name}</strong>
                            <p class="message__text">${message}</p>
                        </div>
                    </div>`

    messagesWrapper.insertAdjacentHTML('beforeend', newMessage)

    let lastMessage = document.querySelector('#messages .message__wrapper:last-child')
    if(lastMessage){
        lastMessage.scrollIntoView()
    }
}


let addBotMessageToDom = (botMessage) => {
    let messagesWrapper = document.getElementById('messages')

    let newMessage = `<div class="message__wrapper">
                        <div class="message__body__bot">
                            <strong class="message__author__bot">🤖 HUST Bot </strong>
                            <p class="message__text__bot">${botMessage}</p>
                        </div>
                    </div>`

    messagesWrapper.insertAdjacentHTML('beforeend', newMessage)

    let lastMessage = document.querySelector('#messages .message__wrapper:last-child')
    if(lastMessage){
        lastMessage.scrollIntoView()
    }
}

let leaveChannel = async () => {
    await channel.leave()
    await rtmClient.logout()
}

window.addEventListener('beforeunload', leaveChannel)
let messageForm = document.getElementById('message__form')
messageForm.addEventListener('submit', sendMessage)