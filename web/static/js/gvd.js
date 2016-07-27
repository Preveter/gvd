(function(){
    "use strict";

    const WS_ADDR = "wss://polik94.ddns.net/gvd/ws";


    function getCookie(name){
        var matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    ////////////////////////////////////////////////////

    function GVD(){
        this.users = [];
        this.jumps = [];
        this.me = null;

        var el = this.element = document.getElementById("listContainer");
        
        el.querySelector("#jumpButton").onclick = () => {
            if (this.checkJumpAbility() === false)
                alert("В данный момент вам недоступно подземелье.");
            else
                wson.send("jump");
        };
        el.querySelector("#exitButton").onclick = () => {
            wson.send("logout");
        };

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

        // users list handling

        this.addUser = function(user){
            this.users.push(user);
            this.redrawUsers();
        };

        this.removeUser = function(user){
            let i = this.users.indexOf(user);
            if (~i){
                this.users.splice(i,1);
            }
            if (user.jump) user.jump.removeMember(user);
            this.redrawUsers();
        };

        this.clearUsers = function(){
            this.users = [];
            this.redrawUsers();
        };

        this.redrawUsers = function(){
            let element = el.querySelector("#userList");
            element.innerHTML = "";
            for (let user of this.users){
                if (user.jump || user.online == false) continue; // skip users in jump and offline
                element.appendChild(user.element);
            }
            for (let jump of this.jumps){
                jump.redrawMembers();
            }
        };

        this.getUserByName = function(userName){
            for (let u of this.users){
                if (u.name == userName){
                    return u;
                }
            }
            return null;
        };

        // jumps list handling

        this.addJump = function(jump){
            this.jumps.push(jump);
            this.redrawJumps();
        };

        this.removeJump = function(jump){
            let i = this.jumps.indexOf(jump);
            if (~i){
                this.jumps.splice(i,1);
            }
            for (let user of this.users){
                if (user.jump == jump) user.jump = null;
            }
            this.redrawJumps();
            this.redrawUsers();
        };

        this.clearJumps = function(){
            this.jumps = [];
            this.redrawJumps();
        };

        this.redrawJumps = function(){
            let element = el.querySelector("#jumpList");
            element.innerHTML = "";
            for (let jump of this.jumps){
                element.appendChild(jump.element);
            }
        };

        // something else

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

        this.reset = function(){
            while (this.jumps.length > 0){
                let jump = this.jumps.pop();
                jump.reset();
            }

            this.users = [];

            this.me = null;
        };
        
        this.activate = function(){
            this.element.style.display = "block";
            
            wson.on("jump", d => {
                let user = this.getUserByName(d["user"]);

                let jump = new Jump(d["delay"], user);
                this.addJump(jump);
                user.jump = jump;

                if (user != this.me){
                    let sound = new Audio(staticLink("sounds/invite.mp3"));
                    sound.volume = 0.2;
                    sound.play();if (notifications){
                        notify("GodvilleDungeon", {
                            tag: "gvd_party",
                            body: d["user"] + " собирает команду!"
                        });
                    }
                }
            });

            wson.on("join", d => {
                let user = this.getUserByName(d["user"]);

                let member = this.getUserByName(d["member"]);
                let jump = member.jump;

                user.jump = jump;
                jump.addMember(user);
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
                this.redrawUsers();
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
                        this.addJump(jump);
                        for (let name of info["members"]){
                            let member = this.getUserByName(name);
                            member.jump = jump;
                            jump.addMember(member);
                        }
                    }

                    this.redrawUsers();
                });
        };
        
        this.deactivate = function(){
            this.element.style.display = "none";
            wson.off("jump");
            wson.off("ready");
            wson.off("user");
            this.reset();
        };

        return this;
    }

    function User(name, online = true){
        this.name = name;
        this.jump = null;
        this.online = online;

        var el = this.element = document.createElement("div");
        el.className = "userInfo";
        el.id = name;

        this.draw = function(){
            el.innerHTML = this.name;
        };

        this.draw();
        return this;
    }

    function Jump(delay, initiator){
        this.delay = delay;
        this.initiator = initiator;

        let members = [this.initiator];

        var timer;

        var el = this.element = document.createElement("div");
        el.className = "jumpBlock";

        var timerElement = document.createElement("div");
        timerElement.className = "timer";
        el.appendChild(timerElement);
        var infoElement = document.createElement("div");
        infoElement.className = "info";
        el.appendChild(infoElement);

        var joinBtn = document.createElement("button");
        joinBtn.className = "joinBtn";
        joinBtn.innerHTML = "Присоединиться";
        el.appendChild(joinBtn);

        var membersList = document.createElement("div");
        membersList.className = "membersList";
        el.appendChild(membersList);
        joinBtn.onclick = () => {
            this.join();
        };

        this.startTimer = function(){
            let timer_start = Date.now();
            let timer_delay = this.delay*1000;
            let timer_end = new Date(timer_start + timer_delay);
            let notified = false;
            let countdownElement = null;
            timer = setInterval(() => {
                var now = new Date();

                if (now > timer_end){
                    clearInterval(timer);
                    gvd.highlightJump();
                    timerElement ? timerElement.innerHTML = "" : false;
                    notified ? document.body.removeChild(countdownElement) : false;
                    gvd.removeJump(this);
                    return;
                }

                if (now > timer_end - 10000 && !notified){
                    if (~members.indexOf(gvd.me)) gvd.jumpAlert();
                    notified = true;

                    countdownElement = document.createElement("div");
                    countdownElement.id = "GVD_Countdown";
                    document.body.appendChild(countdownElement);
                }

                let left = parseInt((timer_end - now)/1000);
                let left_str =
                    ((left-left%60)/60<10?'0':'') + (left-left%60)/60 +
                    ":" +
                    (left%60<10?'0':'') + left%60;
                timerElement ? timerElement.innerHTML = left_str : false;
                notified ? countdownElement.innerHTML = left_str : false;
            },300)
        };

        this.addMember = function(member){
            members.push(member);
            this.redrawMembers();
        };

        this.removeMember = function(member){
            let i = members.indexOf(member);
            if (~i){
                members.splice(i,1);
            }
            this.redrawMembers();
        };

        this.redrawMembers = function(){
            membersList.innerHTML = "";
            for (let user of members){
                if (!user.online) continue;
                membersList.appendChild(user.element)
            }
        };

        this.join = function(){
            wson.send("join", {member: this.initiator.name});
        };

        this.draw = function(){
            timerElement.innerHTML = this.delay;
            infoElement.innerHTML = this.initiator.name;

            this.redrawMembers();
        };

        this.reset = function(){
            clearInterval(timer);
        };

        this.draw();
        this.startTimer();
        return this;
    }


    function LoginManager(){

        var el = this.element = document.getElementById("loginContainer");

        var loginForm = el.querySelector("#loginForm");
        var passInput = loginForm.querySelector("#passInput");
        var nameInput = loginForm.querySelector("#nameInput");

        loginForm.onkeydown = (e => {
            if(e.keyCode==13)
                this.element.querySelector("#confirmButton").click();
        });
        nameInput.value = gvd.getGodName();
        if (nameInput.value == "") nameInput.focus();
        else passInput.focus();

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
        
        this.send = function(){
            Promise.resolve()
                .then(() => wson.fetch("salt"))
                .then( d => Sha1.hash(Sha1.hash(passInput.value) + d["salt"]))
                .then( hash => wson.fetch("auth", {login: nameInput.value, password: hash}))
                .then( d => {
                    if (d.status != "success") {
                        alert("Неверный логин или пароль");
                        return;
                    }

                    loginForm.style.display = "none";
                    this.auth(d["sid"]);
                });
        };
        
        this.showLoginForm = function(){
            loginForm.style.display = "block";

            this.element.querySelector("#confirmButton").onclick = this.send.bind(this);
            this.element.querySelector("#signupButton").onclick = this.signup.bind(this);
        };

        this.signup = function(){
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
                    loginForm.style.display = "none";
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
                    this.showLoginForm();
                })
                .catch(() => {
                    this.signup();
                });

        };

        this.activate = function() {
            this.element.style.display = "block";
            
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
                        } else {
                            console.log("Wrong sid");
                            this.showLoginForm();
                        }
                    });
            }
        };
        
        this.deactivate = function(){
            this.element.style.display = "none";
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