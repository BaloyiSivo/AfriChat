const API_URL = "http://127.0.0.1:8000";

let currentUser = null;
let currentConversationId = null;
let currentFriendId = null;
let messageRefreshTimer = null;


/* =========================
   ELEMENTS
========================= */

const authScreen =
    document.getElementById("authScreen");

const chatScreen =
    document.getElementById("chatScreen");

const loginTab =
    document.getElementById("loginTab");

const registerTab =
    document.getElementById("registerTab");

const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");

const loginMessage =
    document.getElementById("loginMessage");

const registerMessage =
    document.getElementById("registerMessage");

const currentUsername =
    document.getElementById("currentUsername");

const friendsList =
    document.getElementById("friendsList");

const friendSearchInput =
    document.getElementById("friendSearchInput");

const friendSearchButton =
    document.getElementById("friendSearchButton");

const searchResults =
    document.getElementById("searchResults");

const friendRequestsList =
    document.getElementById("friendRequestsList");

const chatFriendName =
    document.getElementById("chatFriendName");

const chatStatus =
    document.getElementById("chatStatus");

const messagesContainer =
    document.getElementById("messagesContainer");

const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const logoutButton =
    document.getElementById("logoutButton");



/* =========================
   AUTH TABS
========================= */

function showLogin() {

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    loginMessage.textContent = "";
    registerMessage.textContent = "";
}


function showRegister() {

    registerTab.classList.add("active");
    loginTab.classList.remove("active");

    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");

    loginMessage.textContent = "";
    registerMessage.textContent = "";
}


loginTab.addEventListener(
    "click",
    showLogin
);


registerTab.addEventListener(
    "click",
    showRegister
);



/* =========================
   AUTH HELPERS
========================= */

function getToken() {

    return localStorage.getItem(
        "africhat_token"
    );
}


function authHeaders() {

    return {
        "Content-Type": "application/json",
        "Authorization":
            `Bearer ${getToken()}`
    };
}



/* =========================
   REGISTER
========================= */

registerForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        registerMessage.textContent =
            "Creating account...";


        const username =
            document
                .getElementById("registerUsername")
                .value
                .trim();


        const email =
            document
                .getElementById("registerEmail")
                .value
                .trim();


        const password =
            document
                .getElementById("registerPassword")
                .value;


        try {

            const response =
                await fetch(
                    `${API_URL}/auth/register`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username,
                            email,
                            password
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                registerMessage.textContent =
                    data.detail ||
                    "Registration failed.";

                return;
            }


            saveLogin(
                data.access_token,
                data.user
            );


            currentUser =
                data.user;


            registerMessage.textContent =
                "Account created successfully!";


            openChatScreen();

        } catch (error) {

            console.error(error);

            registerMessage.textContent =
                "Could not connect to AfriChat server.";
        }
    }
);



/* =========================
   LOGIN
========================= */

loginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        loginMessage.textContent =
            "Logging in...";


        const email =
            document
                .getElementById("loginEmail")
                .value
                .trim();


        const password =
            document
                .getElementById("loginPassword")
                .value;


        try {

            const response =
                await fetch(
                    `${API_URL}/auth/login`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            email,
                            password
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                loginMessage.textContent =
                    data.detail ||
                    "Login failed.";

                return;
            }


            saveLogin(
                data.access_token,
                data.user
            );


            currentUser =
                data.user;


            openChatScreen();

        } catch (error) {

            console.error(error);

            loginMessage.textContent =
                "Could not connect to AfriChat server.";
        }
    }
);



function saveLogin(token, user) {

    localStorage.setItem(
        "africhat_token",
        token
    );


    localStorage.setItem(
        "africhat_user",
        JSON.stringify(user)
    );
}



/* =========================
   OPEN CHAT
========================= */

async function openChatScreen() {

    authScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");


    if (!currentUser) {

        const savedUser =
            localStorage.getItem(
                "africhat_user"
            );


        if (savedUser) {

            currentUser =
                JSON.parse(savedUser);
        }
    }


    if (currentUser) {

        currentUsername.textContent =
            currentUser.username;
    }


    await loadFriends();

    await loadFriendRequests();


    startMessageRefresh();
}



/* =========================
   SEARCH USERS
========================= */

friendSearchButton.addEventListener(
    "click",
    searchUsers
);


friendSearchInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            event.preventDefault();

            searchUsers();
        }
    }
);


async function searchUsers() {

    const username =
        friendSearchInput.value.trim();


    if (!username) {

        searchResults.innerHTML =
            `<p class="empty-text">
                Enter a username.
            </p>`;

        return;
    }


    searchResults.innerHTML =
        `<p class="empty-text">
            Searching...
        </p>`;


    try {

        const response =
            await fetch(
                `${API_URL}/users/search?username=${encodeURIComponent(username)}`,
                {
                    headers: authHeaders()
                }
            );


        if (response.status === 401) {

            logout();

            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            searchResults.innerHTML =
                `<p class="empty-text">
                    ${escapeHtml(
                        data.detail ||
                        "Search failed."
                    )}
                </p>`;

            return;
        }


        if (
            !data.users ||
            data.users.length === 0
        ) {

            searchResults.innerHTML =
                `<p class="empty-text">
                    No users found.
                </p>`;

            return;
        }


        searchResults.innerHTML = "";


        data.users.forEach(
            user => {

                const item =
                    document.createElement("div");

                item.className =
                    "search-user";


                const avatar =
                    document.createElement("div");

                avatar.className =
                    "friend-avatar";

                avatar.textContent =
                    user.username
                        .charAt(0)
                        .toUpperCase();


                const info =
                    document.createElement("div");

                info.className =
                    "search-user-info";


                const name =
                    document.createElement("div");

                name.className =
                    "search-user-name";

                name.textContent =
                    user.username;


                const button =
                    document.createElement("button");

                button.className =
                    "add-friend-button";

                button.textContent =
                    "Add";


                button.addEventListener(
                    "click",
                    () => sendFriendRequest(
                        user.id,
                        button
                    )
                );


                info.appendChild(name);

                item.appendChild(avatar);
                item.appendChild(info);
                item.appendChild(button);

                searchResults.appendChild(item);
            }
        );

    } catch (error) {

        console.error(error);

        searchResults.innerHTML =
            `<p class="empty-text">
                Could not connect to server.
            </p>`;
    }
}



/* =========================
   SEND FRIEND REQUEST
========================= */

async function sendFriendRequest(
    receiverId,
    button
) {

    button.disabled = true;
    button.textContent = "Sending...";


    try {

        const response =
            await fetch(
                `${API_URL}/friends/request`,
                {
                    method: "POST",
                    headers: authHeaders(),

                    body: JSON.stringify({
                        receiver_id:
                            receiverId
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.detail ||
                "Could not send friend request."
            );

            button.disabled = false;
            button.textContent = "Add";

            return;
        }


        button.textContent =
            "Sent";


    } catch (error) {

        console.error(error);

        button.disabled = false;
        button.textContent = "Add";

        alert(
            "Could not connect to server."
        );
    }
}



/* =========================
   FRIEND REQUESTS
========================= */

async function loadFriendRequests() {

    friendRequestsList.innerHTML =
        `<p class="empty-text">
            Loading requests...
        </p>`;


    try {

        const response =
            await fetch(
                `${API_URL}/friends/requests`,
                {
                    headers: authHeaders()
                }
            );


        if (response.status === 401) {

            logout();

            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            friendRequestsList.innerHTML =
                `<p class="empty-text">
                    Could not load requests.
                </p>`;

            return;
        }


        if (
            !data.requests ||
            data.requests.length === 0
        ) {

            friendRequestsList.innerHTML =
                `<p class="empty-text">
                    No friend requests.
                </p>`;

            return;
        }


        friendRequestsList.innerHTML = "";


        data.requests.forEach(
            request => {

                const item =
                    document.createElement("div");

                item.className =
                    "friend-request";


                const name =
                    document.createElement("div");

                name.className =
                    "request-name";

                name.textContent =
                    request.sender_username;


                const actions =
                    document.createElement("div");

                actions.className =
                    "request-actions";


                const accept =
                    document.createElement("button");

                accept.className =
                    "accept-button";

                accept.textContent =
                    "Accept";


                const reject =
                    document.createElement("button");

                reject.className =
                    "reject-button";

                reject.textContent =
                    "Reject";


                accept.addEventListener(
                    "click",
                    () => acceptFriendRequest(
                        request.id
                    )
                );


                reject.addEventListener(
                    "click",
                    () => rejectFriendRequest(
                        request.id
                    )
                );


                actions.appendChild(accept);
                actions.appendChild(reject);

                item.appendChild(name);
                item.appendChild(actions);

                friendRequestsList.appendChild(item);
            }
        );

    } catch (error) {

        console.error(error);

        friendRequestsList.innerHTML =
            `<p class="empty-text">
                Could not connect to server.
            </p>`;
    }
}



/* =========================
   ACCEPT FRIEND REQUEST
========================= */

async function acceptFriendRequest(
    requestId
) {

    try {

        const response =
            await fetch(
                `${API_URL}/friends/accept`,
                {
                    method: "POST",
                    headers: authHeaders(),

                    body: JSON.stringify({
                        request_id:
                            requestId
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.detail ||
                "Could not accept request."
            );

            return;
        }


        await loadFriendRequests();

        await loadFriends();


    } catch (error) {

        console.error(error);

        alert(
            "Could not connect to server."
        );
    }
}



/* =========================
   REJECT FRIEND REQUEST
========================= */

async function rejectFriendRequest(
    requestId
) {

    try {

        const response =
            await fetch(
                `${API_URL}/friends/reject`,
                {
                    method: "POST",
                    headers: authHeaders(),

                    body: JSON.stringify({
                        request_id:
                            requestId
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.detail ||
                "Could not reject request."
            );

            return;
        }


        await loadFriendRequests();


    } catch (error) {

        console.error(error);

        alert(
            "Could not connect to server."
        );
    }
}



/* =========================
   LOAD FRIENDS
========================= */

async function loadFriends() {

    friendsList.innerHTML =
        `<p class="empty-text">
            Loading friends...
        </p>`;


    try {

        const response =
            await fetch(
                `${API_URL}/friends`,
                {
                    headers: authHeaders()
                }
            );


        if (response.status === 401) {

            logout();

            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            friendsList.innerHTML =
                `<p class="empty-text">
                    Could not load friends.
                </p>`;

            return;
        }


        if (
            !data.friends ||
            data.friends.length === 0
        ) {

            friendsList.innerHTML =
                `<p class="empty-text">
                    You don't have any friends yet.
                </p>`;

            return;
        }


        friendsList.innerHTML = "";


        data.friends.forEach(
            friend => {

                const button =
                    document.createElement("button");

                button.className =
                    "friend-item";


                button.dataset.friendId =
                    friend.id;


                const avatar =
                    document.createElement("div");

                avatar.className =
                    "friend-avatar";

                avatar.textContent =
                    friend.username
                        .charAt(0)
                        .toUpperCase();


                const info =
                    document.createElement("div");

                info.className =
                    "friend-info";


                const name =
                    document.createElement("div");

                name.className =
                    "friend-name";

                name.textContent =
                    friend.username;


                const status =
                    document.createElement("div");

                status.className =
                    "friend-status";

                status.textContent =
                    "Friend";


                info.appendChild(name);
                info.appendChild(status);

                button.appendChild(avatar);
                button.appendChild(info);


                button.addEventListener(
                    "click",
                    () => selectFriend(
                        friend,
                        button
                    )
                );


                friendsList.appendChild(button);
            }
        );

    } catch (error) {

        console.error(error);

        friendsList.innerHTML =
            `<p class="empty-text">
                Could not connect to server.
            </p>`;
    }
}



/* =========================
   SELECT FRIEND
========================= */

async function selectFriend(
    friend,
    button
) {

    currentFriendId =
        friend.id;


    document
        .querySelectorAll(".friend-item")
        .forEach(
            item =>
                item.classList.remove(
                    "active"
                )
        );


    button.classList.add("active");


    chatFriendName.textContent =
        friend.username;


    chatStatus.textContent =
        "Opening conversation...";


    messageInput.disabled = true;
    sendButton.disabled = true;


    messagesContainer.innerHTML =
        `<div class="welcome-chat">

            <div class="welcome-icon">
                A
            </div>

            <p>
                Opening conversation...
            </p>

        </div>`;


    try {

        const response =
            await fetch(
                `${API_URL}/conversations`,
                {
                    method: "POST",
                    headers: authHeaders(),

                    body: JSON.stringify({
                        friend_id:
                            friend.id
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            chatStatus.textContent =
                data.detail ||
                "Could not open conversation.";

            return;
        }


        currentConversationId =
            data.conversation_id;


        chatStatus.textContent =
            "Connected";


        messageInput.disabled = false;
        sendButton.disabled = false;


        await loadMessages();

        messageInput.focus();


    } catch (error) {

        console.error(error);

        chatStatus.textContent =
            "Could not connect to server.";
    }
}



/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages() {

    if (!currentConversationId) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/messages/${currentConversationId}`,
                {
                    headers: authHeaders()
                }
            );


        if (response.status === 401) {

            logout();

            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            chatStatus.textContent =
                data.detail ||
                "Could not load messages.";

            return;
        }


        renderMessages(
            data.messages
        );


    } catch (error) {

        console.error(error);

        chatStatus.textContent =
            "Could not load messages.";
    }
}



/* =========================
   RENDER MESSAGES
========================= */

function renderMessages(messages) {

    messagesContainer.innerHTML = "";


    if (
        !messages ||
        messages.length === 0
    ) {

        messagesContainer.innerHTML =
            `<div class="welcome-chat">

                <div class="welcome-icon">
                    A
                </div>

                <h2>
                    Start chatting
                </h2>

                <p>
                    Send your first message.
                </p>

            </div>`;

        return;
    }


    messages.forEach(
        message => {

            const row =
                document.createElement("div");

            row.className =
                "message-row";


            const isMine =
                currentUser &&
                message.sender_id ===
                currentUser.id;


            if (isMine) {

                row.classList.add("mine");
            }


            const bubble =
                document.createElement("div");

            bubble.className =
                "message-bubble";


            const sender =
                document.createElement("div");

            sender.className =
                "message-sender";

            sender.textContent =
                message.sender_username;


            const content =
                document.createElement("div");

            content.className =
                "message-content";

            content.textContent =
                message.content;


            const time =
                document.createElement("div");

            time.className =
                "message-time";

            time.textContent =
                formatTime(
                    message.created_at
                );


            bubble.appendChild(sender);
            bubble.appendChild(content);
            bubble.appendChild(time);


            /* DELETE BUTTON
               Only for your own messages
            */

            if (isMine) {

                const actions =
                    document.createElement("div");

                actions.className =
                    "message-actions";


                const deleteButton =
                    document.createElement("button");

                deleteButton.className =
                    "delete-message-button";

                deleteButton.textContent =
                    "Delete";


                deleteButton.addEventListener(
                    "click",
                    () => deleteMessage(
                        message.id
                    )
                );


                actions.appendChild(
                    deleteButton
                );


                bubble.appendChild(
                    actions
                );
            }


            row.appendChild(bubble);

            messagesContainer.appendChild(row);
        }
    );


    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}



/* =========================
   DELETE MESSAGE
========================= */

async function deleteMessage(
    messageId
) {

    const confirmed =
        confirm(
            "Delete this message?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/messages/${messageId}`,
                {
                    method: "DELETE",
                    headers: authHeaders()
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.detail ||
                "Could not delete message."
            );

            return;
        }


        await loadMessages();


    } catch (error) {

        console.error(error);

        alert(
            "Could not connect to server."
        );
    }
}



/* =========================
   SEND MESSAGE
========================= */

messageForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const content =
            messageInput.value.trim();


        if (
            !content ||
            !currentConversationId
        ) {
            return;
        }


        sendButton.disabled = true;


        try {

            const response =
                await fetch(
                    `${API_URL}/messages/send`,
                    {
                        method: "POST",
                        headers: authHeaders(),

                        body: JSON.stringify({
                            conversation_id:
                                currentConversationId,

                            content
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                alert(
                    data.detail ||
                    "Could not send message."
                );

                return;
            }


            messageInput.value = "";


            await loadMessages();


            messageInput.focus();


        } catch (error) {

            console.error(error);

            alert(
                "Could not connect to server."
            );

        } finally {

            sendButton.disabled = false;
        }
    }
);



/* =========================
   ENTER TO SEND
========================= */

messageInput.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            messageForm.requestSubmit();
        }
    }
);



/* =========================
   MESSAGE REFRESH
========================= */

function startMessageRefresh() {

    stopMessageRefresh();


    messageRefreshTimer =
        setInterval(
            async function () {

                if (
                    currentConversationId &&
                    !document.hidden
                ) {

                    await loadMessages();
                }

                await loadFriendRequests();

            },
            3000
        );
}


function stopMessageRefresh() {

    if (messageRefreshTimer) {

        clearInterval(
            messageRefreshTimer
        );

        messageRefreshTimer = null;
    }
}



/* =========================
   TIME
========================= */

function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }


    const date =
        new Date(
            timestamp.replace(
                " ",
                "T"
            ) + "Z"
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return timestamp;
    }


    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}



/* =========================
   HTML ESCAPING
========================= */

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value;

    return div.innerHTML;
}



/* =========================
   LOGOUT
========================= */

logoutButton.addEventListener(
    "click",
    logout
);


function logout() {

    stopMessageRefresh();


    localStorage.removeItem(
        "africhat_token"
    );


    localStorage.removeItem(
        "africhat_user"
    );


    currentUser = null;
    currentConversationId = null;
    currentFriendId = null;


    chatScreen.classList.add(
        "hidden"
    );


    authScreen.classList.remove(
        "hidden"
    );


    loginForm.reset();
    registerForm.reset();


    friendSearchInput.value = "";
    searchResults.innerHTML = "";


    showLogin();
}



/* =========================
   AUTO LOGIN
========================= */

async function checkExistingLogin() {

    const token =
        getToken();


    const savedUser =
        localStorage.getItem(
            "africhat_user"
        );


    if (
        !token ||
        !savedUser
    ) {

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/auth/me`,
                {
                    headers: authHeaders()
                }
            );


        if (!response.ok) {

            logout();

            return;
        }


        const data =
            await response.json();


        currentUser =
            data.user;


        localStorage.setItem(
            "africhat_user",
            JSON.stringify(
                currentUser
            )
        );


        await openChatScreen();


    } catch (error) {

        console.error(error);
    }
}



/* =========================
   START APPLICATION
========================= */

checkExistingLogin();
