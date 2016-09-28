(function(){
    "use strict";

    const WS_ADDR = "wss://polik94.ddns.net/gvd/ws";
    const WRAP_ID = "gvd_wrap";
    const CONTAINER_ID = "gvdContainer";

    function getCookie(name){
        var matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    ///////////////////////////////////////////

    const TEMPLATES = {
        list: `
            <div id="controlsBar">
                <a href="#" id="exitButton"><img src="${staticLink("img/logout.png")}" alt="Выход"></a>
                <input type="button" id="jumpButton" value="Создать группу">
            </div>
            <div id="jumpList"></div><div id="userList"></div>
            `,
        list_jump: `
            <div class='timer'></div><div class='info'></div>
            <button class="joinBtn">Присоединиться</button><div class="membersList"></div>
            `,
        jump: `
            <div class='timer'></div>
            <div class='info'></div>
            <div class="membersList"></div>
            <div class="jumpChat">
                <div class="chatMessages">Тут типа чат</div>
                <div class="chatForm">
                    <input type="text">
                    <input type="button" value="Send">
                </div>
            </div>
            `,
        auth: `
            <div id="loginContainer">
                <div id="loginForm" class="authForm">
                    <label for="nameInput">Имя бога:</label>
                    <input type="text" title="login" id="nameInput" value="">
                    <label for="passInput">Пароль:</label>
                    <input type="password" title="password" id="passInput" value="">
                    <div class="buttonContainer">
                        <input type="button" id="confirmButton" value="Войти">
                        <input type="button" id="signupButton" value="Регистрация">
                    </div>
                </div>
            </div>
            <div id="signupContainer" class="authForm" style="display:none">
                <div id="signupForm1" style="display:none">
                    <label for="s_nameInput">Ваш логин в Годвилле:</label>
                    <input type="text" title="login" id="s_nameInput" value="">
                </div>
                <div id="signupForm2" style="display:none">
                    <label for="s_mottoInput">Вставьте в любое место вашего девиза следующую строку:</label>
                    <input type="text" title="motto" id="s_mottoInput" readonly>
                </div>
                <div id="signupForm3" style="display:none">
                    <label for="s_passInput">Придумайте и введите пароль:</label>
                    <input type="password" title="password" id="s_passInput" value="">
                </div>
                <div class="buttonContainer">
                    <input type="button" id="signupProceed" value="Далее">
                </div>
            </div>
            `
    };

    function GVD(){
        this.users = [];
        this.jumps = [];
        this.me = null;

        this.element = document.getElementById("gvdContainer");

        let timer;

        let notifications = false;
        if ("Notification" in window)
            switch ( Notification.permission.toLowerCase() ) {
                case "granted":
                    notifications = true;
                    break;
                case "denied":
                    break;
                case "default":
                    Notification.requestPermission(permission => {
                        notifications = (permission == "granted");
                        if (notifications){
                            notify("Проверка");
                        }
                    });
            }

        this.startTimer = function(){
            let notified = new WeakMap();
            let countdownElement;
            timer = setInterval(() => {
                for (var jump of this.jumps) {
                    jump.updateTimeLeft();

                    if (!notified.has(jump)){
                        notified.set(jump, false);
                    }

                    if (jump.time_left <= 10 && !notified.get(jump) && jump.isMember(this.me)) {
                        this.jumpAlert();
                        countdownElement = document.createElement("div");
                        countdownElement.id = "GVD_Countdown";
                        document.body.appendChild(countdownElement);

                        notified.set(jump, true);
                    }

                    if (jump.time_left <= 0) {
                        if (notified.get(jump)){
                            this.highlightJump();
                            document.body.removeChild(countdownElement);
                        }
                        this.removeJump(jump);
                        return;
                    }

                    (notified.get(jump)) ? countdownElement.innerHTML = jump.time_left_str : false;
                    //(jump == this.me.jump) ? jump_el.querySelector("#jumpTimer").innerHTML = jump.time_left_str : false;
                }
            },250);
        };

        this.setState = function(state){
            document.getElementById(CONTAINER_ID).className = state;
            switch (state){
                case "jump":
                    let view = new ViewJump(this.me.jump);
                    views.addView(view);
                    views.showOnly(view);
                    tabs.bindView(1, view, "Прыжок");
                    break;
                default:
                    break;
            }
        };

        // users list handling

        this.addUser = function(user){
            this.users.push(user);
            views.redraw("UserList", this.freeUsers());
        };

        this.removeUser = function(user){
            let i = this.users.indexOf(user);
            if (~i){
                this.users.splice(i,1);
            }
            if (user.jump) user.jump.removeMember(user);
            views.redraw("UserList", this.freeUsers());
        };

        this.clearUsers = function(){
            this.users = [];
            views.redraw("UserList", this.freeUsers());
        };

        this.getUserByName = function(userName){
            for (let u of this.users){
                if (u.name == userName){
                    return u;
                }
            }
            return null;
        };

        this.freeUsers = function(){
            let filtered = [];
            for (let user of this.users){
                if (!user.online) continue;
                if (user.jump) continue;
                filtered.push(user);
            }
            return filtered;
        };

        // jumps list handling

        this.addJump = function(jump){
            this.jumps.push(jump);
            views.redraw("JumpList", this.jumps);
            views.redraw("UserList", this.freeUsers());
        };

        this.removeJump = function(jump){
            let i = this.jumps.indexOf(jump);
            if (~i){
                this.jumps.splice(i,1);
            }
            for (let user of this.users){
                if (user.jump == jump) user.jump = null;
            }
            views.redraw("JumpList", this.jumps);
            views.redraw("UserList", this.freeUsers());
        };

        this.clearJumps = function(){
            this.jumps = [];
            views.redraw("JumpList", this.jumps);
        };

        // something else

        this.jump = function(){
            if (this.checkJumpAbility() === false)
                alert("В данный момент вам недоступно подземелье.");
            else
                wson.send("jump");
        };

        this.jumpAlert = function(){
            let sound = new Audio(staticLink("sounds/jump.mp3"));
            sound.volume = 0.2;
            sound.play();

            if (notifications){
                notify("GodvilleDungeon", {
                    tag: "gvd_jump",
                    body: "Готовьтесь прыгать в подземелье!"
                });
            }
        };

        this.highlightJump = function(){
            if (!GV_ACCESS) return;

            let links = document.querySelectorAll("#actions a");

            for (let link of links){
                if (~link.innerHTML.indexOf("подземелье")){
                    link.style.background = "red";
                    link.style.color = "white";
                    link.style.fontWeight = "600";
                    link.style.padding = "1px 4px 3px";
                    link.style.margin = "2px";
                }
            }
        };

        this.getGodName = function(){
            if (!GV_ACCESS) return "";

            let links = document.querySelectorAll("#stats a");

            for (let link of links){
                if (~link.href.indexOf("/gods/")){
                    return link.href.replace(/.*\/gods\//,"");
                }
            }
        };

        this.checkJumpAbility = function(){
            if (!GV_ACCESS) return null;

            let links = document.querySelectorAll("#actions a");

            for (let link of links) {
                if (~link.innerHTML.indexOf("подземелье") && link.style.display != "none") {
                    return true
                }
            }
            return false;
        };
        
        this.activate = function(){
            this.startTimer();
            
            wson.on("jump", d => {
                let user = this.getUserByName(d["user"]);

                let jump = new Jump(d["delay"], user);
                user.jump = jump;
                this.addJump(jump);

                if (user != this.me){
                    let sound = new Audio(staticLink("sounds/invite.mp3"));
                    sound.volume = 0.2;
                    sound.play();
                    if (notifications){
                        notify("GodvilleDungeon", {
                            tag: "gvd_party",
                            body: d["user"] + " собирает команду!"
                        });
                    }
                }else{
                    this.setState("jump");
                }

                views.redraw("JumpMembers", jump);
            });

            wson.on("join", d => {
                let user = this.getUserByName(d["user"]);

                let member = this.getUserByName(d["member"]);
                let jump = member.jump;

                user.jump = jump;
                jump.addMember(user);
                
                if (user == this.me){
                    this.setState("jump");
                }

                views.redraw("UserList", this.freeUsers());
                views.redraw("JumpMembers", jump);
            });

            wson.on("user", d => {
                let user = this.getUserByName(d["name"]);
                if (d["status"] == "on"){
                    if (user == null){
                        user = new User(d["name"], true);
                        this.addUser(user);
                    }else{
                        user.online = true;
                    }
                }
                if (d["status"] == "off"){
                    if (user != null){
                        user.online = false;
                    }
                }
                if (user.jump) views.redraw("JumpMembers", user.jump);
                views.redraw("UserList", this.freeUsers());
            });

            wson.on("chat", d => {
                let user = this.getUserByName(d["user"]);
                let text = d["message"];
                if (this.me && this.me.jump)
                    this.me.jump.updateChat(user, text);
            });
            
            wson.fetch("data")
                .then(d => {
                    console.log("Data loaded!");
                    
                    this.me = null;

                    this.clearUsers();
                    for (let info of d["users"]){
                        let user = new User(info["name"], info["online"]);
                        this.addUser(user);
                        if (info["name"] == d["me"]["name"]) this.me = user;
                    }

                    this.clearJumps();
                    for (let info of d["jumps"]){
                        let user = this.getUserByName(info["initiator"]);
                        let jump = new Jump(info["delay"], user);
                        for (let name of info["members"]){
                            let member = this.getUserByName(name);
                            member.jump = jump;
                            if (member == this.me){
                                this.setState("jump");
                            }
                            jump.addMember(member);
                        }
                        this.addJump(jump);
                    }

                    views.redraw("UserList", this.freeUsers());
                });

            this.view = new ViewNormal(this);
            views.addView(this.view);
            tabs.bindView(0, this.view);
        };
        
        this.deactivate = function(){
            wson.off("jump");
            wson.off("join");
            wson.off("user");
            wson.off("chat");
            views.removeView(this.view);
            tabs.bindView(1, null);

            this.jumps = [];
            this.users = [];

            this.me = null;
            clearInterval(timer);
        };

        this.logout = function(){
            wson.send("logout");
        };

        return this;
    }

    class User {
        constructor (name, online = true){
            this.name = name;
            this.jump = null;
            this.online = online;
        }
    }

    class Jump {
        constructor (delay, initiator) {
            this.delay = delay;
            this.initiator = initiator;

            this.members = new Set([this.initiator]);
            this.chat = [];

            this.timer_start = Date.now();
            this.time_left = 0;
            this.time_left_str = "";
        }
        addMember (member) {
            this.members.add(member);
            views.redraw("JumpMembers", this);
        }

        isMember (user) {
            return this.members.has(user);
        };

        removeMember (member) {
            if (this.members.delete(member))
                views.redraw("JumpMembers", this);
        };

        updateTimeLeft () {
            let timer_delay = this.delay*1000;
            let end = new Date(this.timer_start + timer_delay);
            let now = new Date();

            let left = this.time_left = parseInt((end - now)/1000);
            this.time_left_str =
                ((left-left%60)/60<10?'0':'') + (left-left%60)/60 +
                ":" +
                (left%60<10?'0':'') + left%60;
            //timerElement ? timerElement.innerHTML = this.time_left_str : false;
            views.redraw("JumpTimer", this);
        };

        updateChat (user, message) {
            this.chat.push({name: user.name, text: message});
            views.redraw("JumpChat", this);
        };

        join () {
            wson.send("join", {member: this.initiator.name});
        };

        chatSend (text) {
            wson.send("chat", {user: gvd.me.name, message: text});
        };
    }

    ///////////////////////////////////////////

    var tabs = {
        init () {
            let container = document.getElementsByClassName("msgDockWrapper")[0];
            if (typeof container == "undefined") return false;

            this.tab = [];
            this.tab[0] = document.createElement("div");
            this.tab[0].className = "msgDock gvdBig";
            this.tab[0].style.display = "none";
            container.appendChild(this.tab[0]);
            this.tab[1] = document.createElement("div");
            this.tab[1].className = "msgDock gvdSmall";
            this.tab[1].style.display = "none";
            container.appendChild(this.tab[1]);
        },
        bindView (id, view, text = "GVD") {
            if (!this.tab[id]) throw("There is no tab with such id^ "+id);
            let btn = this.tab[id];

            if (view == null)
                btn.style.display = "none";
            else{
                btn.innerHTML = text;
                btn.style.display = "block";
                btn.onclick = () => {
                    let vis = views.isViewVisible(view);
                    if (vis === true) views.showOnly(null);
                    if (vis === false) views.showOnly(view);
                };
            }
        }
    };

    var views = {
        CONTAINER_ID: "gvdContainer",
        WRAP_ID: "gvd_wrap",
        views: [],
        addView (view) {
            let element = view.draw();
            this.views.push({
                view: view,
                element: element
            });
            document.getElementById(CONTAINER_ID).appendChild(element);
        },
        removeView (view) {
            let index = this.indexOfView(view);
            if (~index){
                let el = this.views[index].element;
                el.parentNode.removeChild(el);
                this.views.splice(index, 1);
            }
        },
        showOnly (view) {
            for (let item of this.views){
                item.element.style.display = "none";
            }
            let index = this.indexOfView(view);
            if (~index){
                this.views[index].element.style.display = "block";
                document.getElementById(WRAP_ID).style.display = "block";
            }else{
                document.getElementById(WRAP_ID).style.display = "none";
            }
        },
        isViewVisible (view) {
            let index = this.indexOfView(view);
            if (~index)
                return this.views[index].element.style.display != "none";
            else
                return null;

        },
        redraw (element) {
            Array.prototype.shift.call(arguments);
            for (let item of this.views){
                let view = item.view;
                let func = view["redraw" + element];
                if (!func){
                    throw("Active view has no handler with name 'redraw" + element + "'");
                }
                view["redraw" + element].apply(view, arguments);
            }
        },
        indexOfView (view) {
            for (let i = 0; i < this.views.length; i++){
                if (this.views[i].view == view){
                    return i;
                }
            }
            return -1;
        }
    };

    class View{
        constructor () {
            this.jump_elements = [];
            this.user_elements = [];
        }

        draw () {}

        getJumpElement (jump) {
            for (let pair of this.jump_elements){
                if (pair["jump"] == jump){
                    return pair["element"];
                }
            }
            return null;
        }
        getUserElement (user) {
            for (let pair of this.user_elements){
                if (pair["user"] == user){
                    return pair["element"];
                }
            }
            return null;
        }
        redrawUserList () {};
        redrawUser (user) {};
        redrawUserState (user) {};
        redrawJumpList () {};
        redrawJump (jump) {};
        redrawJumpTimer (jump) {};
        redrawJumpMembers (jump) {};
        redrawJumpChat (jump) {};
    }
    class ViewNormal extends View {
        constructor (gvd) {
            super();
            this.gvd = gvd;
        }
        draw () {
            this.element = document.createElement("div");
            this.element.innerHTML = TEMPLATES["list"];
            this.element.querySelector("#jumpButton").onclick = () => {
                this.gvd.jump();
            };
            this.element.querySelector("#exitButton").onclick = () => {
                this.gvd.logout();
            };
            //this.redrawUserList();
            //this.redrawJumpList();
            return this.element;
        }
        redrawJumpList (jumps) {
            let list = this.element.querySelector("#jumpList");

            let unchanged = [];
            for (let i = this.jump_elements.length - 1; i >= 0; i--) {
                let index = jumps.indexOf(this.jump_elements[i]["jump"]);
                if (!~index) {
                    list.removeChild(this.jump_elements[i]["element"]);
                    this.jump_elements.splice(i, 1);
                } else {
                    unchanged.push(jumps[index]);
                }
            }

            for (let jump of jumps) {
                if (~unchanged.indexOf(jump)) continue;
                let element = document.createElement("div");
                this.jump_elements.push({jump: jump, element: element});
                this.redrawJump(jump, element);
                list.appendChild(element);
            }
        };
        redrawJump (jump, element = this.getJumpElement(jump)) {
            if (element == null) return;

            if (element.innerHTML == "") {
                element.className = "jumpBlock";
                element.innerHTML = TEMPLATES["list_jump"];
                element.querySelector(".info").innerHTML = jump.initiator.name;
                element.querySelector(".joinBtn").onclick = () => {
                    jump.join();
                };
            }
            element.querySelector(".timer").innerHTML = jump.time_left_str;
            this.redrawJumpTimer(jump, element);
            this.redrawJumpMembers(jump, element);
        };
        redrawJumpTimer (jump, element = this.getJumpElement(jump)) {
            if (element == null) return;
            element.querySelector(".timer").innerHTML = jump.time_left_str;
        };
        redrawJumpMembers (jump, element = this.getJumpElement(jump)) {
            if (element == null) return;
            element = element.querySelector(".membersList");
            element.innerHTML = "";
            for (let user of jump.members) {
                if (!user.online) continue;
                element.innerHTML += `<div class='userInfo'>${user.name}</div>`;
            }
        };
        redrawUserList (users) {
            let list = this.element.querySelector("#userList");

            let unchanged = [];
            for (let i = this.user_elements.length - 1; i >= 0; i--) {
                let index = users.indexOf(this.user_elements[i]["user"]);
                if (!~index) {
                    list.removeChild(this.user_elements[i]["element"]);
                    this.user_elements.splice(i, 1);
                } else {
                    unchanged.push(users[index]);
                }
            }

            for (let user of users) {
                if (~unchanged.indexOf(user)) continue;
                let element = document.createElement("div");
                this.user_elements.push({user: user, element: element});
                this.redrawUser(user, element);
                list.appendChild(element);
            }
        };
        redrawUser (user, element = this.getUserElement(user)) {
            if (element == null) return;

            if (element.innerHTML == "") {
                element.className = "userInfo";
                element.innerHTML = `<div class='stateMarker'></div><span class='name'></span>`;
            }
            element.querySelector(".name").innerHTML = user.name;
            this.redrawUserState(user, element);
        };
        redrawUserState (user, element = this.getUserElement(user)) {
            if (element == null) return;

            let marker = element.querySelector(".stateMarker");
        };
    }
    class ViewJump extends View {
        constructor (jump) {
            super();
            this.jump = jump;
        }
        draw () {
            this.element = document.createElement("div");
            this.element.innerHTML = TEMPLATES["jump"];

            let chatElement = this.element.querySelector(".jumpChat");
            let chatInput = chatElement.querySelector("input[type=text]");
            let chatBtn = chatElement.querySelector("input[type=button]");

            chatBtn.onclick = () => {
                this.jump.chatSend(chatInput.value);
                chatInput.value = "";
                chatInput.focus();
            };

            chatInput.onkeydown = event => {
                if (event.keyCode != 13) return;
                this.jump.chatSend(chatInput.value);
                chatInput.value = "";
            };

            return this.element;
        }
        redrawJump (jump, element = this.getJumpElement(jump)) {
            if (jump != this.jump) return;
            this.redrawJumpTimer(jump, element);
            this.redrawJumpMembers(jump, element);
        };
        redrawJumpTimer (jump) {
            if (jump != this.jump) return;
            this.element.querySelector(".timer").innerHTML = jump.time_left_str;
        };
        redrawJumpMembers (jump) {
            if (jump != this.jump) return;
            let element = this.element.querySelector(".membersList");
            element.innerHTML = "";
            for (let user of jump.members) {
                if (!user.online) continue;
                element.innerHTML += `<div class='userInfo'>${user.name}</div>`;
            }
        };
        redrawJumpChat (jump) {
            if (jump != this.jump) return;
            let chatMessages = this.element.querySelector(".chatMessages");
            chatMessages.innerHTML = "";
            for (let msg of jump.chat){
                chatMessages.innerHTML += `<div class='chatItem fr_msg_l'>${msg['name']}: ${msg['text']}</div>`;
            }
        }
    }
    class ViewAuth extends View {
        constructor (auth_mgr) {
            super();
            this.auth_mgr = auth_mgr;
        }
        draw () {
            this.element = document.createElement("div");
            this.element.innerHTML = TEMPLATES["auth"];

            let loginForm = this.element.querySelector("#loginForm");
            let passInput = loginForm.querySelector("#passInput");
            let nameInput = loginForm.querySelector("#nameInput");

            loginForm.onkeydown = (e => {
                if(e.keyCode==13)
                    this.element.querySelector("#confirmButton").click();
            });

            nameInput.value = gvd.getGodName();
            if (nameInput.value == "") nameInput.focus();
            else passInput.focus();

            this.element.querySelector("#confirmButton").onclick = () => {
                let name = nameInput.value;
                let pass = passInput.value;
                this.auth_mgr.sendCredentials(name, pass);
            };
            this.element.querySelector("#signupButton").onclick = () => this.auth_mgr.signup();

            return this.element;
        }
    }

    ///////////////////////////////////////////

    function LoginManager(){

        var loginHandler = function(){};
        var logoutHandler = function(){};

        this.onlogin = function(h){
            loginHandler = h;
        };

        this.onlogout = function(h){
            logoutHandler = h;
        };
        
        this.auth = function(sid){
            var date = new Date;
            date.setDate(date.getDate() + 365);
            document.cookie = "sid=" + sid + "; path=/; expires=" + date.toUTCString();
            console.log("Success auth");

            var t = this;
            wson.on("logout", function(){
                t.logout();
            });
            
            this.deactivate();
            loginHandler();
        };

        this.logout = function(){
            logoutHandler();
            wson.off("logout");
            this.activate();
        };
        
        this.sendCredentials = function(name, pass){
            Promise.resolve()
                .then(() => wson.fetch("salt"))
                .then( d => Sha1.hash(Sha1.hash(pass) + d["salt"]))
                .then( hash => wson.fetch("auth", {login: name, password: hash}))
                .then( d => {
                    if (d.status != "success") {
                        alert("Неверный логин или пароль");
                        return;
                    }
                    this.auth(d["sid"]);
                });
        };

        this.showLoginForm = function(){
            this.view = new ViewAuth(this);
            views.addView(this.view);
            views.showOnly(this.view);
            tabs.bindView(0, this.view);
        };

        this.signup = function(){
            let loginContainer = document.getElementById("loginContainer");
            let signupContainer = document.getElementById("signupContainer");

            let proceedBtn = signupContainer.querySelector("#signupProceed");

            let signupForm1 = signupContainer.querySelector("#signupForm1");
            let nameInput = signupContainer.querySelector("#s_nameInput");

            let signupForm2 = signupContainer.querySelector("#signupForm2");
            let mottoInput = signupContainer.querySelector("#s_mottoInput");

            let signupForm3 = signupContainer.querySelector("#signupForm3");
            let passInput = signupContainer.querySelector("#s_passInput");

            signupContainer.onkeydown = (e => {
                if(e.keyCode==13)
                    proceedBtn.click();
            });

            let testMotto = function(){
                return new Promise(resolve => {
                    proceedBtn.onclick = () => {
                        wson.fetch("motto")
                            .then(d => {
                                if (d["status"] != "accepted") {
                                    alert("Девиз в API еще не обновился. Попробуйте через минутку.");
                                    return;
                                }
                                resolve();
                            })
                    };
                })
            };

            Promise.resolve()
                .then(() => {
                    loginContainer.style.display = "none";
                    signupContainer.style.display = "block";
                    signupForm1.style.display = "block";
                    nameInput.value = gvd.getGodName();
                    nameInput.focus();
                    return new Promise(resolve => proceedBtn.onclick = resolve)
                })
                .then(() => wson.fetch("sign", {login: nameInput.value}))
                .then(d => {
                    signupForm1.style.display = "none";
                    signupForm2.style.display = "block";
                    mottoInput.value = d["motto"];
                    mottoInput.onclick = mottoInput.select;
                    mottoInput.focus();
                    return testMotto()
                })
                .then(() => {
                    signupForm2.style.display = "none";
                    signupForm3.style.display = "block";
                    passInput.focus();
                    return new Promise(resolve => proceedBtn.onclick = resolve)
                })
                .then(() => wson.fetch("password", {"password": passInput.value}))
                .then(() => {
                    signupForm3.style.display = "none";
                    signupContainer.style.display = "none";
                    loginContainer.style.display = "block";
                })
                .catch(() => {
                    this.signup();
                });

        };

        this.activate = function() {
            var sid = getCookie("sid");

            if (sid === undefined) {
                console.log("No SID to send.");
                this.showLoginForm();
            } else {
                console.log("Checking sid...");
                wson.fetch("sid", {sid: sid})
                    .then(d => {
                        if (d["status"] == "accepted") {
                            console.log("SID accepted!");
                            this.auth(sid);
                        }else{
                            console.log("Wrong sid");
                            this.showLoginForm();
                        }
                    });
            }
        };
        
        this.deactivate = function(){
            views.removeView(this.view);
        };

        return this;
    }

    ///////////////////////////////////////////

    var wson, gvd, login;
    
    window.GVD_run = function(){

        wson = new WSON(WS_ADDR);

        gvd = new GVD();
        login = new LoginManager();

        login.onlogin(function () {
            gvd.activate();
        });

        login.onlogout(function () {
            gvd.deactivate();
        });

        tabs.init();

        wson.onopen(function () {
            console.log('Connected');
            login.activate();
        });

        wson.onclose(function (event) {
            if (event["wasClean"]) {
                console.log('Connection closed');
            } else {
                console.log('Connection lost');
            }
            console.log('Code: ' + event.code + '; reason: ' + event.reason);
        });

    };

})();
