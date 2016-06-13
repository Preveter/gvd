(function(){

    function getCookie(name){
        var matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    ////////////////////////////////////////////////////

    function GVD(){
        this.users = [];
        this.me = {
            name: "",
            ready: false
        };

        var el = this.element = document.getElementById("listContainer");
        
        el.querySelector("#jumpButton").onclick = function(){
            wson.send("jump");
        };
        el.querySelector("#exitButton").onclick = function(){
            wson.send("logout");
        };

        var timer_start = 0,
            timer_delay = 0;
        var timer;
        var timerElement = el.querySelector("#timer");
        

        this.setMyName = function(name){
            this.me.name = name;
        };

        this.setMyStatus = function(val){
            this.me.ready = val;
        };

        this.addUser = function(user){
            this.users.push(user);
            this.redrawUsers();
        };

        this.removeUser = function(user){
            var i = this.users.indexOf(user);
            if (~i){
                this.users.splice(i,1);
            }
            this.redrawUsers();
        };

        this.clearUsers = function(){
            this.users = [];
            this.redrawUsers();
        };

        this.redrawUsers = function(){
            var lst = el.querySelector("#userList");
            lst.innerHTML = "";
            this.users.forEach(function(user){
                lst.appendChild(user.element);
            });
        };

        this.getUserByName = function(userName){
            for (var i = 0; i < this.users.length; i++){
                var u = this.users[i];
                if (u.name == userName){
                    return u;
                }
            }
        };

        this.startTimer = function(delay){
            timer_start = Date.now();
            timer_delay = delay*1000;
            timer = setInterval(function(){
                var now = new Date();
                if (now > timer_start + timer_delay){
                    clearInterval(timer);
                    timerElement ? timerElement.innerHTML = "" : false;
                    if (gvd.me.ready) alert("ПРЫГ!");
                }else{
                    var jt = new Date(timer_start + timer_delay);
                    var left = parseInt((jt - now)/1000);
                    var left_str =
                        ((left-left%60)/60<10?'0':'') + (left-left%60)/60 +
                        ":" +
                        (left%60<10?'0':'') + left%60;
                    timerElement ? timerElement.innerHTML = left_str : false;
                }
            },300)
        };

        this.reset = function(){
            this.users = [];
            this.me = {
                name: "",
                ready: false
            };

            timer_start = 0;
            timer_delay = 0;
            
            clearInterval(timer);
        };
        
        this.activate = function(){
            this.element.style.display = "block";
            
            var t = this;
            
            wson.on("jump", function(d){
                t.startTimer(d["delay"]);
                var u = t.getUserByName(d["user"]);
                u.setReady(true);
                if (d["user"] == t.me.name){
                    t.setMyStatus(true);
                }else{
                    alert(d["user"] + " has created a party!");
                }
            });

            wson.on("ready", function(d){
                var u = t.getUserByName(d["user"]);
                u.setReady(true);
                if (d["user"] == t.me.name)
                    t.setMyStatus(true);
            });

            wson.on("user", function(d){
                if (d["status"] == "on"){
                    var u = new User(d["name"]);
                    t.addUser(u);
                }
                if (d["status"] == "off"){
                    t.removeUser(t.getUserByName(d["name"]));
                }
            });
            
            wson.fetch("data")
                .then(d => {
                    console.log("Data loaded!");

                    this.setMyName(d["me"]["name"]);
                    this.setMyStatus(d["me"]["ready"]);

                    this.clearUsers();
                    d["users"].forEach(name => this.addUser(new User(name)));

                    if (d["jump"]["active"]){
                        this.startTimer(d["jump"]["delay"]);
                        var users = d["jump"]["ready"];
                        users.forEach(name => this.getUserByName(name).setReady(true));
                    }
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

    function User(name){
        this.name = name;
        var ready = false;

        var el = this.element = document.createElement("div");
        el.className = "userInfo";
        el.id = "name";

        this.setReady = function(val){
            if (ready != val){
                ready = val;
                this.draw();
            }
        };

        this.draw = function(){
            el.innerHTML = this.name;
            if (ready) el.style.background = "#88ff88";
            else el.style.background = "#ffffff";
        };

        this.draw();
        return this;
    }


    function LoginManager(){

        var el = this.element = document.getElementById("loginContainer");

        var loginForm = el.querySelector("#loginForm");
        var passInput = loginForm.querySelector("#passInput");
        var nameInput = loginForm.querySelector("#nameInput");

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
                    return new Promise(resolve => proceedBtn.onclick = resolve)
                })
                .then(() => wson.fetch("sign", {login: nameInput.value}))
                .then(d => {
                    signupForm1.style.display = "none";
                    signupForm2.style.display = "block";
                    mottoInput.value = d["motto"];
                    return new Promise(resolve => proceedBtn.onclick = resolve)
                })
                .then(() => testMotto())
                .then(() => {
                    signupForm2.style.display = "none";
                    signupForm3.style.display = "block";
                    return new Promise(resolve => proceedBtn.onclick = resolve)
                })
                .then(() => wson.fetch("password", {"password": passInput.value}))
                .then(() => {
                    signupForm3.style.display = "none";
                    signupContainer.style.display = "none";
                    this.showLoginForm();
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
    
    window.run = function(){
        
        wson = new WSON("ws://127.0.0.1:8765/");

        gvd = new GVD();
        login = new LoginManager();

        login.onlogin(function(){
            gvd.activate();
        });

        login.onlogout(function(){
            gvd.deactivate();
        });

        wson.onopen(function(){
            console.log('Connected');
            login.activate();
        });
    
        wson.onclose(function(event) {
            if (event.wasClean){
                console.log('Connection closed');
            }else{
                console.log('Connection lost');
            }
            console.log('Code: ' + event.code + '; reason: ' + event.reason);
        });

    };

})();